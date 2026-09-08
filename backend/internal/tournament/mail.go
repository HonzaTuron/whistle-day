package tournament

import (
	"os"
	"strconv"

	"github.com/pocketbase/pocketbase/core"
)

/*
Pointing PocketBase's mailer at a relay.

A one-box PocketBase has no way to send mail on its own — there is no MTA next
to it and its default sendmail path goes nowhere. So account-claim email is
still deferred (see routes.go) and, more to the point here, nothing this
server wants to tell an operator can leave the box.

The relay is Brevo. Its host, port and login are not secret — they are useless
without the key — so they sit here as defaults and only the key comes from the
environment, in `/srv/whistleday/.env`, which the API unit already reads and
git does not. Every value is overridable by an env var, so moving to another
provider is an edit to that file and a restart, not a build.
*/

const (
	defaultSMTPHost = "smtp-relay.brevo.com"
	defaultSMTPPort = 587
	defaultSMTPUser = "b85905001@smtp-brevo.com"

	// The address mail is sent as. `whistle.day` is the domain authenticated
	// in Brevo — `brevo1`/`brevo2._domainkey.whistle.day` and its DMARC record
	// — so Brevo will actually send from it and the message is DKIM-signed.
	// Sending from a subdomain Brevo has not authenticated is accepted at the
	// relay and then silently dropped.
	defaultMailFrom     = "no-reply@whistle.day"
	defaultMailFromName = "Whistle.day"

	// What handoff and recovery links are built from. `go run` on a laptop can
	// point it elsewhere with WHISTLEDAY_APP_URL.
	defaultAppURL = "https://whistle.day"
)

// RegisterMail configures the SMTP relay from the environment on every boot.
//
// From the environment rather than a migration because the key is a secret and
// belongs in `/srv/whistleday/.env`, not baked into `pb_data` or written into
// a file in the repo — and rotating it should be an edit and a restart, not a
// new migration. Applied every boot, so the environment is the source of
// truth and a dashboard edit does not silently outlive the next restart.
//
// With no WHISTLEDAY_SMTP_PASS the mailer stays disabled: `go run` on a laptop
// has no relay and no reason to want one, and a disabled mailer makes every
// send a logged no-op rather than an error.
func RegisterMail(app core.App) {
	app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
		if err := e.Next(); err != nil {
			return err
		}

		pass := os.Getenv("WHISTLEDAY_SMTP_PASS")
		port := mailEnvInt("WHISTLEDAY_SMTP_PORT", defaultSMTPPort)

		s := e.App.Settings()

		// {APP_NAME} and {APP_URL} in the recovery email templates — and the
		// base every handoff `/claim/...` link is built from. Both ship as
		// PocketBase defaults ("Acme", "http://localhost:8090") that no step
		// here has ever overridden, so a verification link would point at
		// localhost. Set from code, past the default only: a deliberate
		// dashboard change still wins.
		if s.Meta.AppName == "" || s.Meta.AppName == "Acme" {
			s.Meta.AppName = defaultMailFromName
		}
		if s.Meta.AppURL == "" || s.Meta.AppURL == "http://localhost:8090" {
			s.Meta.AppURL = mailEnv("WHISTLEDAY_APP_URL", defaultAppURL)
		}

		s.Meta.SenderName = mailEnv("WHISTLEDAY_MAIL_FROM_NAME", defaultMailFromName)
		s.Meta.SenderAddress = mailEnv("WHISTLEDAY_MAIL_FROM", defaultMailFrom)

		s.SMTP.Enabled = pass != ""
		s.SMTP.Host = mailEnv("WHISTLEDAY_SMTP_HOST", defaultSMTPHost)
		s.SMTP.Port = port
		s.SMTP.Username = mailEnv("WHISTLEDAY_SMTP_USER", defaultSMTPUser)
		s.SMTP.Password = pass
		s.SMTP.AuthMethod = "PLAIN"
		// 465 is implicit TLS; 587 (and 25) connect in the clear and issue
		// STARTTLS, which is what `TLS: false` means to PocketBase's mailer.
		s.SMTP.TLS = port == 465

		if err := e.App.Save(s); err != nil {
			return err
		}

		if s.SMTP.Enabled {
			e.App.Logger().Info("mail: relay configured",
				"host", s.SMTP.Host, "port", s.SMTP.Port, "from", s.Meta.SenderAddress)
		} else {
			e.App.Logger().Warn("mail: WHISTLEDAY_SMTP_PASS is unset, sending disabled")
		}
		return nil
	})
}

func mailEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func mailEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return fallback
}
