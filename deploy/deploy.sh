#!/usr/bin/env bash
#
# Put what is on master onto the server, from here.
#
#   bun run deploy
#
# There is no key to production in GitHub and nothing deploys on a push. The
# gate still runs on every push in CI, and it runs again here, because the
# thing worth protecting is not the convenience — it is that a release is a
# commit somebody else can check out, not whatever happens to be in this
# working tree.
#
# Which is why the first two checks are about git rather than about the code.
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Where to. Put these in a `.env` at the repo root — it is gitignored.
#
#   WHISTLEDAY_HOST=whistle.day
#   WHISTLEDAY_DEPLOY_USER=deploy
# shellcheck source=/dev/null  # it is a local secrets file; there is nothing to follow
[[ -f .env ]] && set -a && . ./.env && set +a
HOST=${WHISTLEDAY_HOST:-}
USER_=${WHISTLEDAY_DEPLOY_USER:-deploy}
BRANCH=${WHISTLEDAY_BRANCH:-master}
SKIP_CHECK=${SKIP_CHECK:-}

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() { printf '\n\033[31m%s\033[0m\n\n' "$*" >&2; exit 1; }

[[ -n $HOST ]] || die "No WHISTLEDAY_HOST. Put it in .env or pass it in the environment."

# ---------------------------------------------------------------------------
say "Is this a release, or is it your desk?"
# ---------------------------------------------------------------------------
[[ -z $(git status --porcelain) ]] ||
	die "The working tree is dirty. A release has to be a commit, or nobody can
tell later what was deployed — including you, in a hall, on a Saturday."

git fetch --quiet origin "$BRANCH"

HEAD_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git rev-parse "origin/$BRANCH")

[[ $HEAD_SHA == "$REMOTE_SHA" ]] ||
	die "HEAD is not origin/$BRANCH.
  here:   $(git log --oneline -1 HEAD)
  remote: $(git log --oneline -1 "origin/$BRANCH")
Push first. Deploying something that is not on the branch means the next
person to look cannot reproduce what is running."

echo "  $(git log --oneline -1 HEAD)"

# ---------------------------------------------------------------------------
if [[ -n $SKIP_CHECK ]]; then
	say "Skipping the gate (SKIP_CHECK is set)"
else
	say "The gate"
	# Typecheck, the web tests, go vet, the Go tests, and the smoke suite
	# against a real PocketBase — a whole group stage, a double elimination
	# and a Swiss played out to the end.
	bun run check
fi

# ---------------------------------------------------------------------------
say "Building for the server"
# ---------------------------------------------------------------------------
# Both of these cross-compile, so this works from macOS on an M-series laptop
# as well as from Linux. The Go build is CGO_ENABLED=0 because PocketBase uses
# modernc's SQLite, and the web build puts Bun's runtime inside the binary —
# so neither needs anything installed on the server beside it.
rm -rf release && mkdir -p release

(cd backend && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
	go build -trimpath -ldflags="-s -w" -o ../release/pocketbase .)

(cd apps/web && bun run build)
bun build --compile --target=bun-linux-x64 \
	apps/web/dist/server/server.js --outfile release/whistleday-web
cp -r apps/web/dist/client release/client

du -sh release/* | sed 's/^/  /'

# ---------------------------------------------------------------------------
say "About to deploy to $HOST"
# ---------------------------------------------------------------------------
# A restart is a second of downtime, which is a wall that goes dark. Worth one
# keypress, because the person who knows whether a tournament is being played
# right now is standing here.
if [[ -t 0 ]]; then
	read -r -p "  Is anything being played right now? Deploy anyway? [y/N] " reply
	[[ $reply == [yY] ]] || die "Stopped."
fi

# ---------------------------------------------------------------------------
say "Shipping"
# ---------------------------------------------------------------------------
ssh "$USER_@$HOST" 'rm -rf /srv/whistleday/staging && mkdir -p /srv/whistleday/staging'
rsync -az --delete release/ "$USER_@$HOST:/srv/whistleday/staging/"
scp -q deploy/release.sh "$USER_@$HOST:/srv/whistleday/release.sh"
ssh "$USER_@$HOST" 'chmod +x /srv/whistleday/release.sh && /srv/whistleday/release.sh'

# ---------------------------------------------------------------------------
say "Checking the real thing, from outside"
# ---------------------------------------------------------------------------
# Through Caddy and TLS, which is the only version of "it works" that counts.
failed=0
for path in / /8-team-single-elimination-bracket /api/health; do
	code=$(curl -sS -o /dev/null -w '%{http_code}' -m 15 "https://$HOST$path" || echo "---")
	printf '  %-40s %s\n' "$path" "$code"
	[[ $code == 200 ]] || failed=1
done

if [[ $failed -eq 1 ]]; then
	die "It is up but not answering properly. Rolling back:
  ssh $USER_@$HOST
  sudo -u whistleday cp /srv/whistleday/pocketbase.previous /srv/whistleday/pocketbase
  sudo -u whistleday cp /srv/whistleday/whistleday-web.previous /srv/whistleday/whistleday-web
  sudo systemctl restart whistleday-api whistleday-web"
fi

say "Deployed — $(git log --oneline -1 HEAD)"
