package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

/*
The two recovery emails, worded as this app and pointed at its own pages.

PocketBase ships working templates for both, and until there was a relay to
send them through that was academic. Now that there is one, two things are
worth fixing before the first one goes out:

  - the default links land on `/_/#/auth/confirm-…`, the superuser dashboard,
    which is English-only, PocketBase-branded and nothing like the rest of
    this. The app has `/reset/{token}` and `/verify/{token}` of its own, which
    render in the reader's language.
  - "Acme team" is not a sign-off anybody wants in their inbox.

Set here rather than in the dashboard, like the rate limits: the reasoning
lives next to the wording, and a rebuilt `pb_data` comes back with it. The
subject and the sign-off use `{APP_NAME}`, which `RegisterMail` sets to
"Whistle.day"; the links use `{APP_URL}`, which is the Application URL from the
dashboard (`https://whistle.day` in production).

`ConfirmEmailChangeTemplate` is left alone: nothing in the app changes an
email after it is claimed, so that flow is unreachable and its default is
fine as a fallback.
*/

const recoveryEmailStyle = `<style>
  body { font: 16px/1.5 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0b0f14; }
  .btn { display: inline-block; padding: 10px 18px; margin: 8px 0; border-radius: 8px;
         background: #0b0f14; color: #fff; text-decoration: none; font-weight: 600; }
  .muted { color: #55677a; font-size: 14px; }
</style>`

var verificationBody = recoveryEmailStyle + `
<p>Confirm this address so you can get back into your {APP_NAME} account if you
ever lose the password on this device.</p>
<p><a class="btn" href="{APP_URL}/verify/{TOKEN}" target="_blank" rel="noopener">Confirm email</a></p>
<p class="muted">If you did not set up a {APP_NAME} account, ignore this — nothing happens until the link is opened.</p>
<p class="muted">— {APP_NAME}</p>`

var resetPasswordBody = recoveryEmailStyle + `
<p>Someone asked to reset the password for the {APP_NAME} account on this
address. If that was you, choose a new one:</p>
<p><a class="btn" href="{APP_URL}/reset/{TOKEN}" target="_blank" rel="noopener">Set a new password</a></p>
<p class="muted">The link is good for a little under an hour. If it was not you, nothing has changed and you can ignore this.</p>
<p class="muted">— {APP_NAME}</p>`

// The PocketBase defaults, restored by the down migration.
const pbDefaultVerificationBody = `<p>Hello,</p>
<p>Thank you for joining us at {APP_NAME}.</p>
<p>Click on the button below to verify your email address.</p>
<p>
  <a class="btn" href="{APP_URL}/_/#/auth/confirm-verification/{TOKEN}" target="_blank" rel="noopener">Verify</a>
</p>
<p><i>If you didn't recently register, please ignore this email.</i></p>
<p>
  Thanks,<br/>
  {APP_NAME} team
</p>`

const pbDefaultResetPasswordBody = `<p>Hello,</p>
<p>Click on the button below to reset your password.</p>
<p>
  <a class="btn" href="{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}" target="_blank" rel="noopener">Reset password</a>
</p>
<p><i>If you didn't ask to reset your password, please ignore this email.</i></p>
<p>
  Thanks,<br/>
  {APP_NAME} team
</p>`

func init() {
	m.Register(func(app core.App) error {
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		users.VerificationTemplate = core.EmailTemplate{
			Subject: "Confirm your email — {APP_NAME}",
			Body:    verificationBody,
		}
		users.ResetPasswordTemplate = core.EmailTemplate{
			Subject: "Reset your {APP_NAME} password",
			Body:    resetPasswordBody,
		}

		return app.Save(users)
	}, func(app core.App) error {
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		users.VerificationTemplate = core.EmailTemplate{
			Subject: "Verify your {APP_NAME} email",
			Body:    pbDefaultVerificationBody,
		}
		users.ResetPasswordTemplate = core.EmailTemplate{
			Subject: "Reset your {APP_NAME} password",
			Body:    pbDefaultResetPasswordBody,
		}

		return app.Save(users)
	})
}
