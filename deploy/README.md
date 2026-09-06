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

## Once, on the server

```bash
# A user that owns nothing else.
sudo useradd --system --home /srv/whistleday --shell /usr/sbin/nologin whistleday
sudo mkdir -p /srv/whistleday/{pb_data,backups,client}
sudo chown -R whistleday:whistleday /srv/whistleday

# The backup in release.sh is SQLite's own, not `cp`.
sudo apt install -y sqlite3 caddy

sudo cp deploy/whistleday-api.service deploy/whistleday-web.service /etc/systemd/system/
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo mkdir -p /var/log/caddy && sudo chown caddy:caddy /var/log/caddy

sudo systemctl daemon-reload
sudo systemctl enable --now whistleday-api whistleday-web
sudo systemctl reload caddy
```

The deploy user needs to restart the two services and nothing else:

```
# /etc/sudoers.d/whistleday-deploy
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart whistleday-api, /usr/bin/systemctl restart whistleday-web
```

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

## Once, in GitHub

Four secrets, used by `.github/workflows/deploy.yml`:

| | |
|---|---|
| `DEPLOY_HOST` | the server |
| `DEPLOY_USER` | the deploy user |
| `DEPLOY_SSH_KEY` | its private key |
| `DEPLOY_KNOWN_HOSTS` | `ssh-keyscan <host>`, pinned rather than trusted blindly |

## Every deploy

Push to `master`. The workflow runs `bun run check` first — typecheck, the web
tests, `go vet`, the Go tests and the smoke suite against a real PocketBase —
so nothing reaches the server that has not played a whole group stage, a
double elimination and a Swiss out to the end.

Then it builds both binaries, ships them to `staging/`, and runs `release.sh`,
which does the four things that have to happen in this order:

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
