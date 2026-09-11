package oauth

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
)

// VerifyS256 checks a PKCE code_verifier against the code_challenge an
// /oauth/authorize call carried.
//
// S256 only — OAuth 2.1 drops the "plain" method entirely, and this server
// never accepts it either (see authorize() in oauth.go). A verifier that
// hashes to the challenge is the caller proving it is the same party that
// started the flow, without the authorization code alone being enough: a
// code that leaked in a redirect (a browser history, a referrer header) is
// useless without the verifier, which never leaves the client that minted it.
func VerifyS256(verifier, challenge string) bool {
	if verifier == "" || challenge == "" {
		return false
	}
	sum := sha256.Sum256([]byte(verifier))
	computed := base64.RawURLEncoding.EncodeToString(sum[:])
	return subtle.ConstantTimeCompare([]byte(computed), []byte(challenge)) == 1
}
