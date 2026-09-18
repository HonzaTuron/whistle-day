package tournament

import (
	"os"

	"github.com/pocketbase/pocketbase/core"
)

// RegisterSocialAuth configures Google sign-in from the environment on every
// boot, the same way RegisterMail points the mailer at a relay.
//
// The client id and secret are secrets and belong in
// /srv/whistleday/.env, not in pb_data or a migration, so rotating them is an
// edit and a restart rather than a new migration.
//
// oauth.ts on the web side is already provider-agnostic: it draws whatever
// buttons users.listAuthMethods() reports as enabled and claims this device's
// tournament through whichever one is pressed. So this is the whole of it on
// the server — give the users collection a "google" provider once
// WHISTLEDAY_GOOGLE_CLIENT_ID and WHISTLEDAY_GOOGLE_CLIENT_SECRET both exist,
// and take it away the moment either does not, so a half-configured
// deployment shows no button rather than one that fails.
//
// Only the "google" entry is ever touched. Whatever else is in this
// collection's OAuth2 providers — Facebook, say, added by hand from the
// dashboard — is read back and kept exactly as it was.
func RegisterSocialAuth(app core.App) {
	app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
		if err := e.Next(); err != nil {
			return err
		}

		users, err := e.App.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		clientID := os.Getenv("WHISTLEDAY_GOOGLE_CLIENT_ID")
		clientSecret := os.Getenv("WHISTLEDAY_GOOGLE_CLIENT_SECRET")

		kept := make([]core.OAuth2ProviderConfig, 0, len(users.OAuth2.Providers)+1)
		for _, p := range users.OAuth2.Providers {
			if p.Name != "google" {
				kept = append(kept, p)
			}
		}
		if clientID != "" && clientSecret != "" {
			kept = append(kept, core.OAuth2ProviderConfig{
				Name:         "google",
				ClientId:     clientID,
				ClientSecret: clientSecret,
			})
		}
		users.OAuth2.Providers = kept
		users.OAuth2.Enabled = len(kept) > 0

		if err := e.App.Save(users); err != nil {
			return err
		}

		if clientID == "" || clientSecret == "" {
			e.App.Logger().Warn("oauth: WHISTLEDAY_GOOGLE_CLIENT_ID/SECRET unset, Google sign-in disabled")
		} else {
			e.App.Logger().Info("oauth: Google sign-in configured")
		}

		return nil
	})
}
