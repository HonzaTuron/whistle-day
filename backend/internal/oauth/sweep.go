package oauth

import (
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// RegisterSweep clears out what this package leaves behind: pending
// authorize requests nobody finished, codes nobody redeemed, and tokens that
// were revoked or outlived their refresh window. Same pattern and same hour
// as tournament.RegisterSweep — nothing else runs on a schedule, so there is
// no reason to share a minute with a backup or a certificate renewal.
func RegisterSweep(app core.App) {
	app.Cron().MustAdd("sweep-oauth", "20 4 * * *", func() {
		now := time.Now().UTC().Format("2006-01-02 15:04:05.000Z")
		sweep(app, "oauth_requests", "used = true || expires < {:now}", now)
		sweep(app, "oauth_codes", "used = true || expires < {:now}", now)
		sweep(app, "oauth_tokens", "revoked = true || refresh_expires < {:now}", now)
	})
}

func sweep(app core.App, collection, filter, now string) {
	records, err := app.FindRecordsByFilter(collection, filter, "", 0, 0, dbx.Params{"now": now})
	if err != nil {
		app.Logger().Error("oauth sweep failed", "collection", collection, "error", err)
		return
	}
	for _, r := range records {
		if err := app.Delete(r); err != nil {
			app.Logger().Error("oauth sweep delete failed",
				"collection", collection, "id", r.Id, "error", err)
		}
	}
}
