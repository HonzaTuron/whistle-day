package oauth

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/security"
	"github.com/pocketbase/pocketbase/tools/types"
)

// AccessTokenLifetime and RefreshTokenLifetime are short and long on purpose:
// an access token is what travels on every MCP call, so a leaked one (a
// transcript, a log) stops mattering within the hour; a refresh token is what
// a connected agent actually holds day to day, and 60 days is long enough
// that a client that refreshes on every use is never bothered by it, while
// still being a date rather than "forever".
const (
	AccessTokenLifetime  = time.Hour
	RefreshTokenLifetime = 60 * 24 * time.Hour

	accessTokenLength  = 40
	refreshTokenLength = 40
)

func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// MintTokenPair issues a fresh, unrelated access/refresh pair.
//
// "Unrelated" matters: this is the entry point for a brand new grant (an
// authorization-code exchange), not a rotation, so the new row has no
// `parent` — there is nothing to walk back to if it is ever replayed.
//
// Bound to canonicalResource(app) unconditionally rather than trusting a
// caller-supplied resource string — RFC 8707 audience binding is then a
// property of every token this function ever produces, not something a call
// site can get wrong by passing the wrong value through.
func MintTokenPair(app core.App, user, client *core.Record, scope string) (access, refresh string, err error) {
	return mintTokenPair(app, user, client, scope, nil)
}

// RotateTokenPair retires `old` and mints its replacement, both in one
// transaction — a crash between the two would otherwise leave a token that
// still works sitting next to one that looks retired, which is worse than
// either failure alone.
func RotateTokenPair(app core.App, old, user, client *core.Record) (access, refresh string, err error) {
	err = app.RunInTransaction(func(tx core.App) error {
		old.Set("revoked", true)
		if err := tx.Save(old); err != nil {
			return err
		}
		a, r, mintErr := mintTokenPair(tx, user, client, old.GetString("scope"), old)
		if mintErr != nil {
			return mintErr
		}
		access, refresh = a, r
		return nil
	})
	return access, refresh, err
}

func mintTokenPair(app core.App, user, client *core.Record, scope string, parent *core.Record) (access, refresh string, err error) {
	collection, err := app.FindCollectionByNameOrId("oauth_tokens")
	if err != nil {
		return "", "", err
	}

	access = "wd_at_" + security.RandomString(accessTokenLength)
	refresh = "wd_rt_" + security.RandomString(refreshTokenLength)
	now := types.NowDateTime()

	r := core.NewRecord(collection)
	r.Set("user", user.Id)
	r.Set("client", client.Id)
	r.Set("access_token_hash", hashToken(access))
	r.Set("refresh_token_hash", hashToken(refresh))
	r.Set("scope", scope)
	r.Set("resource", canonicalResource(app))
	r.Set("access_expires", now.Add(AccessTokenLifetime))
	r.Set("refresh_expires", now.Add(RefreshTokenLifetime))
	r.Set("revoked", false)
	if parent != nil {
		r.Set("parent", parent.Id)
	}

	if err := app.Save(r); err != nil {
		return "", "", err
	}
	return access, refresh, nil
}

// ResolveAccessToken is the other half of mcp/auth.go's caller(): a raw
// Authorization: Bearer value in, the real user it belongs to out.
//
// One sentence for expired, revoked and never-existed alike, matching
// caller()'s existing session_token error — the difference is only ever
// useful to somebody guessing.
func ResolveAccessToken(app core.App, raw string) (*core.Record, error) {
	if raw == "" {
		return nil, fmt.Errorf("no token")
	}

	row, err := app.FindFirstRecordByFilter("oauth_tokens",
		"access_token_hash = {:h} && revoked = false",
		map[string]any{"h": hashToken(raw)})
	if err != nil || row == nil {
		return nil, fmt.Errorf("that access token is not valid any more")
	}

	expires := row.GetDateTime("access_expires")
	if !expires.IsZero() && expires.Time().Before(time.Now()) {
		return nil, fmt.Errorf("that access token is not valid any more")
	}

	// RFC 8707 audience binding: every token minted here (see mintTokenPair)
	// is written with the canonical resource, never whatever a client asked
	// for, so this can never fail for a token this server issued honestly —
	// it exists to fail loudly instead of silently for one that somehow
	// wasn't, rather than to do the binding itself.
	if row.GetString("resource") != canonicalResource(app) {
		return nil, fmt.Errorf("that access token is not valid any more")
	}

	return app.FindRecordById("users", row.GetString("user"))
}

// FindTokenByRefreshHash looks a grant up by its refresh token. The caller
// decides what to do with what it finds — expired, revoked (reuse) and fine
// are three different reactions at the token endpoint, not one.
func FindTokenByRefreshHash(app core.App, raw string) (*core.Record, error) {
	if raw == "" {
		return nil, fmt.Errorf("no token")
	}
	return app.FindFirstRecordByFilter("oauth_tokens",
		"refresh_token_hash = {:h}", map[string]any{"h": hashToken(raw)})
}

// RevokeChain kills every token descended from the same original grant as
// `start`, in both directions.
//
// Called when a refresh token is redeemed a second time — reuse, which OAuth
// 2.1 treats as theft regardless of which copy is the thief's: the honest
// client and the attacker cannot be told apart from here, so both lose
// access and the honest one has to reconnect. The alternative, revoking only
// the replayed token, leaves whichever copy wins the race still working.
func RevokeChain(app core.App, start *core.Record) error {
	seen := map[string]bool{}
	queue := []*core.Record{start}

	for len(queue) > 0 {
		cur := queue[0]
		queue = queue[1:]
		if seen[cur.Id] {
			continue
		}
		seen[cur.Id] = true

		if !cur.GetBool("revoked") {
			cur.Set("revoked", true)
			if err := app.Save(cur); err != nil {
				return err
			}
		}

		children, err := app.FindRecordsByFilter("oauth_tokens",
			"parent = {:p}", "", 0, 0, map[string]any{"p": cur.Id})
		if err == nil {
			queue = append(queue, children...)
		}

		if parentID := cur.GetString("parent"); parentID != "" && !seen[parentID] {
			if parentRow, err := app.FindRecordById("oauth_tokens", parentID); err == nil {
				queue = append(queue, parentRow)
			}
		}
	}
	return nil
}
