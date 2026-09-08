# Deploying Whistle.day

Three processes on one box. That is not a starting point to grow out of — it
is what SQLite picks for you. The API is a single writer on a local disk, so
there is no second machine to add, and picking a host for scaling you cannot
use is how you end up paying for network storage under a database that wanted
an NVMe.

| | | |
|---|---|---|
| `caddy` | `:80`, `:443` | TLS, the static files, and the routing |
| `whistleday-api` | `127.0.0.1:8090` | PocketBase: the API, the realtime stream, MCP |
| `whistleday-web` | `127.0.0.1:3000` | renders the app screens |

The hundred and twenty-three marketing pages are rendered at build time and
served from disk; they never reach a process. Only `/t`, `/display`, `/m`,
`/join`, `/account`, `/new` and `/claim` are rendered per request.

Both services are single binaries with nothing beside them — the Go build is
`CGO_ENABLED=0` because PocketBase uses modernc's SQLite, and the web server
is `bun build --compile`, which puts its own runtime inside the file. There is
no Bun, no Node and no `node_modules` on the server to drift from the build.

## Run these

Start to finish, from a laptop with the repo checked out. `<host>` is the
server's IP until DNS has propagated.

```bash
# 1. The box. Ubuntu 24.04, in Nuremberg or Falkenstein — the audience is in
#    Central Europe and so should the box be. CX22 is 2 vCPU and 4 GB, which
#    is enormous headroom: this measures 30 MB idle and 73 MB under fifty
#    concurrent projector clients.
hcloud server create --name whistleday --type cx22 \
  --image ubuntu-24.04 --location nbg1 --ssh-key <your-key>
hcloud server ip whistleday

# 2. DNS, at Cloudflare. Both records DNS only — grey cloud, not proxied.
#    A   whistle.day       <ip>
#    A   www.whistle.day   <ip>

# 3. Set the box up. Installs Caddy, makes the users, directories, services
#    and firewall. Safe to re-run.
scp -r deploy root@<host>:/tmp/
ssh root@<host> 'bash /tmp/deploy/bootstrap.sh'

# 4. A key for deploying, kept apart from the one you log in with.
ssh-keygen -t ed25519 -f ~/.ssh/whistleday-deploy -C "whistleday deploy" -N ""
ssh-copy-id -i ~/.ssh/whistleday-deploy.pub deploy@<host>

# 5. Tell the repo where the server is. Gitignored; nothing goes to GitHub.
cat >> .env <<EOF
WHISTLEDAY_HOST=whistle.day
WHISTLEDAY_DEPLOY_USER=deploy
EOF

# 6. Deploy.
bun run deploy

# 7. Now that the binaries are on the box, a superuser:
ssh deploy@<host> "sudo -u whistleday /srv/whistleday/pocketbase superuser \
  upsert you@example.com 'a-real-password' --dir=/srv/whistleday/pb_data"

# 8. And the dashboard, over a tunnel — it is not on the internet.
ssh -L 8090:127.0.0.1:8090 deploy@<host>
#    then http://127.0.0.1:8090/_/ and set, in this order of importance:
#      - Application URL      https://whistle.day   (handoff links use it)
#      - OAuth2 on `users`    Google + Facebook, redirect
#                             https://whistle.day/account
#    Mail is not set here — the SMTP key goes in /srv/whistleday/.env
#    (WHISTLEDAY_SMTP_PASS); RegisterMail wires the rest on every boot.
```

Then check it from outside, which is the only version of "it works" that counts:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://whistle.day/
curl -sS -o /dev/null -w '%{http_code}\n' https://whistle.day/8-team-single-elimination-bracket
curl -sS -o /dev/null -w '%{http_code}\n' https://whistle.day/api/health
```

## What step 3 actually does

`bootstrap.sh`, so it is one command rather than twenty, and so running it
again after editing the Caddyfile is safe:

- installs Caddy from its own repository, plus `sqlite3` — which is not
  optional, because `release.sh` backs up with SQLite's own `.backup` rather
  than `cp`, and a copied file can land mid-write on a running server;
- makes **two** accounts. `whistleday` is the service account: no shell,
  owns the database, nothing logs in as it. `deploy` is what a deploy logs in
  as, kept separate so a leaked deploy key is a way to push a release rather
  than a way to be the process holding the database open;
- installs both unit files and the Caddyfile, and validates the Caddyfile
  before reloading — a typo there takes the site down, and `caddy validate`
  catches it while the old config is still serving;
- grants `deploy` passwordless sudo for **exactly two commands**, restarting
  the two services, and nothing else;
- enables the services without starting them, because their binaries arrive
  with the first deploy and a unit restart-looping against a missing file
  fills the journal with nothing worth reading;
- opens 22, 80 and 443. Not 8090 or 3000: both services bind to loopback and
  the only thing that should reach them is Caddy on the same box.

## Once, in DNS

An `A` record for `whistle.day` and `www.whistle.day` at the server's address,
**DNS only — grey cloud, not proxied.** Two reasons, and both bite:

- Caddy gets its own certificate by answering an ACME challenge on this host.
  An orange-clouded record has Cloudflare answer it somewhere else.
- The projector holds `/api/realtime` open for hours. Cloudflare's proxy closes
  a long idle stream, and every close is a wall that goes stale until it
  reconnects.

## Once, in the PocketBase dashboard

Reachable at `/_/`, which the Caddyfile only serves to localhost — so tunnel
in: `ssh -L 8090:127.0.0.1:8090 deploy@<host>`, then `http://127.0.0.1:8090/_/`.

- **Application URL → `https://whistle.day`.** It defaults to
  `http://localhost:8090`, and it is what handoff links are built from — every
  `/claim/…` link an agent mints would point at localhost.
- **OAuth2 on the `users` collection** — the Google and Facebook client ids and
  secrets, with the redirect URL `https://whistle.day/account`. The sign-in
  screen asks the server what is configured and draws only what comes back, so
  until this is done it is an email and a password and nothing else.
- A superuser that is not `admin@whistleday.local` / `whistledayadmin1`.

SMTP is **not** set here — `RegisterMail` (`backend/internal/tournament/mail.go`)
points PocketBase at Brevo on every boot, reading the key from the env file
below. The host, port and login are in that file in the repo; only the key is
secret. A dashboard edit to Mail settings does not survive the next restart.

## Once, in `/srv/whistleday/.env`

The gitignored env file the API unit reads (`EnvironmentFile=`). `bootstrap.sh`
creates it empty; fill in:

```bash
WHISTLEDAY_SMTP_PASS=xsmtpsib-…        # the Brevo SMTP key
# WHISTLEDAY_MAIL_FROM=alerts@mail.whistle.day   # override the default sender
```

Then restart the API. With no key the mailer stays off and every send is a
logged no-op — which is what `go run` on a laptop wants.

Mail is sent as `no-reply@mail.whistle.day`. That subdomain is the one
authenticated in Brevo — its SPF, DKIM and DMARC records live on
`mail.whistle.day` in Cloudflare, apart from the apex's mail policy — so a
message is signed and reaches an inbox rather than spam. Brevo accepting a
message at the relay is not the same as it being delivered; the domain auth is
what closes that gap.

## Once, on your laptop

A `.env` at the repo root, which is gitignored:

```bash
WHISTLEDAY_HOST=whistle.day
WHISTLEDAY_DEPLOY_USER=deploy
```

Nothing goes in GitHub. There is no key to production in a secret store, and
no workflow — or third-party action a workflow pulls in — that could reach the
server with one. What CI does hold is nothing at all: `check.yml` runs the
gate on every push and deploys nothing.

That split keeps the half that was actually worth having. The value of CI here
was never the automatic deploy, it was the clean room — `bun run check`
passing with your own toolchain, your `node_modules` and your environment is
weaker evidence than it passing on a machine that has none of them.

## Every deploy

```bash
bun run deploy
```

It refuses before it does anything if the working tree is dirty, or if `HEAD`
is not `origin/master`. Both are about the same thing: a release has to be a
commit somebody can check out later, not whatever happened to be on a laptop
at the time. Then it runs the gate again, cross-compiles both binaries —
`CGO_ENABLED=0` and `bun build --compile`, so this works from macOS as well as
Linux — and asks whether anything is being played right now before it
restarts anything.

Then it ships to `staging/` and runs `release.sh` on the server, which does
the four things that have to happen in this order:

1. **back up the database**, before a migration can touch it;
2. **migrate**, with the new binary, while the old one is still serving;
3. **swap** the binaries and rename the static directory into place, so no
   request sees half a deploy;
4. **restart**, then check both processes answer before declaring victory.

The backup is first because a half-applied migration is the one failure that
rolling the binaries back does not fix — the schema has moved and the old
binary does not know about it.

**A restart is a second of downtime, which is a wall that blinks.** Do not
deploy into a tournament that is being played.

## When it goes wrong

`release.sh` leaves the previous release next door:

```bash
sudo -u whistleday cp /srv/whistleday/pocketbase.previous /srv/whistleday/pocketbase
sudo -u whistleday cp /srv/whistleday/whistleday-web.previous /srv/whistleday/whistleday-web
sudo -u whistleday rm -rf /srv/whistleday/client && \
  sudo -u whistleday mv /srv/whistleday/client.previous /srv/whistleday/client
sudo systemctl restart whistleday-api whistleday-web
```

If a migration is what broke it, the database as it stood a moment before is
in `/srv/whistleday/backups/data-<stamp>.db`. Stop the API, move it over
`pb_data/data.db`, put the old binary back, start.

Logs: `journalctl -u whistleday-api -f`, `journalctl -u whistleday-web -f`,
`/var/log/caddy/whistleday.log`.

## What is not set up here

- **Backups leave the box.** `release.sh` writes one before every deploy and
  keeps ten, which covers a bad migration and nothing else. A disk that dies
  takes all ten. Point something at `/srv/whistleday/backups` — restic to
  object storage on a timer — and restore from it once, on purpose, before
  believing in it.
- **Nothing is rate limited.** The unauthenticated surface is the display
  token, `/api/preview`, the invite lookup, the auth endpoints and
  `create_tournament` over MCP, which is a write.
- **Nothing is watching.** No uptime check on `GET /api/display/{token}`, no
  error collection off `app.Logger()`.
