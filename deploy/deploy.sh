#!/usr/bin/env bash
#
# Put what is on master onto the server, from here.
#
#   bun run deploy
#
# Straight from this machine to the server. GitHub is not in the path: no key
# to production lives there, nothing deploys on a push, and a laptop that can
# reach the box but not github.com can still put a fix on it. CI runs the same
# gate on every push, which is worth having for the clean room and is not a
# dependency of releasing.
#
# The one hard rule is that a release must be a commit. Everything else here —
# whether it is pushed, whether a tournament is being played — is said out loud
# and left to the person running it.
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Where to. Put these in a `.env` at the repo root — it is gitignored.
#
#   WHISTLEDAY_HOST=whistle.day
#   WHISTLEDAY_DEPLOY_USER=deploy
# The environment wins over the file, so `WHISTLEDAY_HOST=somewhere-else bun
# run deploy` means what it says. Sourcing `.env` over the top would silently
# send it to production instead, which is a bad way to find out.
FROM_ENV_HOST=${WHISTLEDAY_HOST:-}
FROM_ENV_USER=${WHISTLEDAY_DEPLOY_USER:-}
FROM_ENV_BRANCH=${WHISTLEDAY_BRANCH:-}

# shellcheck source=/dev/null  # it is a local secrets file; there is nothing to follow
[[ -f .env ]] && set -a && . ./.env && set +a

HOST=${FROM_ENV_HOST:-${WHISTLEDAY_HOST:-}}
USER_=${FROM_ENV_USER:-${WHISTLEDAY_DEPLOY_USER:-deploy}}
BRANCH=${FROM_ENV_BRANCH:-${WHISTLEDAY_BRANCH:-master}}
SKIP_CHECK=${SKIP_CHECK:-}

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() { printf '\n\033[31m%s\033[0m\n\n' "$*" >&2; exit 1; }

[[ -n $HOST ]] || die "No WHISTLEDAY_HOST. Put it in .env or pass it in the environment."

# ---------------------------------------------------------------------------
say "Is this a release, or is it your desk?"
# ---------------------------------------------------------------------------
# The one hard rule, and it has nothing to do with any remote: what is running
# has to be a commit. Otherwise the only record of what is on the server is a
# working tree that has since moved on, and the question "what is actually
# deployed" has no answer — including for you, in a hall, on a Saturday.
[[ -z $(git status --porcelain) ]] ||
	die "The working tree is dirty. Commit first — a release has to be something
you can check out again."

HEAD_SHA=$(git rev-parse HEAD)
echo "  $(git log --oneline -1 HEAD)"

# Whether it is also on a remote is worth knowing and is not worth refusing
# over. GitHub is not in the path of a deploy — this goes straight from here to
# the server — and a laptop that can reach the box but not github.com should
# still be able to put a fix on it.
#
# So: fetch if we can, say so if the commit is only here, and carry on. What
# the old refusal was really protecting is handled below instead, by writing
# the sha onto the server itself.
PUSHED=no
if git fetch --quiet origin "$BRANCH" 2>/dev/null; then
	if [[ $HEAD_SHA == "$(git rev-parse "origin/$BRANCH" 2>/dev/null)" ]]; then
		PUSHED=yes
	else
		echo "  note: this commit is not on origin/$BRANCH. Deploying it anyway;"
		echo "        it exists only on this machine until you push."
	fi
else
	echo "  note: no remote reachable, so it is unknown whether this is pushed."
fi

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

# What is running, written down where it is running.
#
# This is what the old "must be pushed to origin" refusal was really for: so
# that the thing on the server could be identified later. A remote is one way
# to answer that and not the only one — the sha on the box answers it directly,
# and says whether it was ever pushed, which is the bit worth knowing when it
# turns out you need this commit back.
cat > release/RELEASE <<EOF
commit=$HEAD_SHA
subject=$(git log -1 --format=%s)
branch=$BRANCH
pushed=$PUSHED
deployed=$(date -u +%Y-%m-%dT%H:%M:%SZ)
by=$(git config user.email 2>/dev/null || whoami)
EOF

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
