package oauth

import (
	"crypto/sha256"
	"encoding/base64"
	"testing"
)

func challengeFor(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func TestVerifyS256(t *testing.T) {
	verifier := "a-verifier-at-least-forty-three-characters-long"
	challenge := challengeFor(verifier)

	if !VerifyS256(verifier, challenge) {
		t.Fatal("the right verifier was rejected")
	}
	if VerifyS256("wrong-verifier", challenge) {
		t.Fatal("the wrong verifier was accepted")
	}
	if VerifyS256("", challenge) {
		t.Fatal("an empty verifier was accepted")
	}
	if VerifyS256(verifier, "") {
		t.Fatal("an empty challenge was accepted")
	}
}
