#!/usr/bin/env bash
#
# Put a release on the server. Runs *on the server*, on an already-uploaded
# staging directory; `.github/workflows/deploy.yml` builds and uploads, then
# calls this.
#
# The order matters and is the whole point of the file:
#
#   1. back up the database before a migration can touch it
#   2. migrate
#   3. swap the binaries and the static files
#   4. restart
#
# Backing up first is not belt and braces. A migration that half-applies is
# the one failure here that a rollback of the binaries does not fix, because
# the schema has moved and the old binary does not know about it.
set -euo pipefail

ROOT=/srv/whistleday
STAGE=${1:-$ROOT/staging}
KEEP_BACKUPS=10

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

[[ -x $STAGE/pocketbase ]] || { echo "no pocketbase binary in $STAGE"; exit 1; }
[[ -x $STAGE/whistleday-web ]] || { echo "no web binary in $STAGE"; exit 1; }
[[ -d $STAGE/client ]] || { echo "no client/ in $STAGE"; exit 1; }

# ---------------------------------------------------------------------------
say "Backing up the database"
# ---------------------------------------------------------------------------
mkdir -p "$ROOT/backups"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
# SQLite's own backup, not `cp`: the server is running and a copied file can
# land mid-write. This is the one that restores.
sqlite3 "$ROOT/pb_data/data.db" ".backup '$ROOT/backups/data-$STAMP.db'"
echo "  $ROOT/backups/data-$STAMP.db"

# Keep the last few. A box with a full disk cannot serve a tournament either.
#
# `ls` rather than `find`, because the ordering is the point and these are
# names this script wrote: data-<utc timestamp>.db, no spaces to mishandle.
# shellcheck disable=SC2012
ls -1t "$ROOT"/backups/data-*.db 2>/dev/null | tail -n "+$((KEEP_BACKUPS + 1))" | xargs -r rm --

# ---------------------------------------------------------------------------
say "Applying migrations"
# ---------------------------------------------------------------------------
# With the new binary, because the migrations are compiled into it, and while
# the old one is still serving — PocketBase migrations are additive and the
# running server does not have to be stopped to apply them.
"$STAGE/pocketbase" migrate up --dir="$ROOT/pb_data"

# ---------------------------------------------------------------------------
say "Swapping in the release"
# ---------------------------------------------------------------------------
# The previous binaries are kept next door, so a rollback is two moves and a
# restart rather than a rebuild.
for binary in pocketbase whistleday-web; do
	[[ -f $ROOT/$binary ]] && cp -f "$ROOT/$binary" "$ROOT/$binary.previous"
	install -m 0755 "$STAGE/$binary" "$ROOT/$binary.incoming"
	mv -f "$ROOT/$binary.incoming" "$ROOT/$binary"
done

# The static files are swapped by rename rather than written in place, so no
# request can ever see half a deploy: the old directory serves every byte
# until the instant the new one takes its name.
rm -rf "$ROOT/client.previous"
[[ -d $ROOT/client ]] && mv "$ROOT/client" "$ROOT/client.previous"
mv "$STAGE/client" "$ROOT/client"

# What is running, so `cat /srv/whistleday/RELEASE` answers it without needing
# a remote, a laptop or a memory.
if [[ -f $STAGE/RELEASE ]]; then
	[[ -f $ROOT/RELEASE ]] && cp -f "$ROOT/RELEASE" "$ROOT/RELEASE.previous"
	mv -f "$STAGE/RELEASE" "$ROOT/RELEASE"
	sed 's/^/  /' "$ROOT/RELEASE"
fi

# ---------------------------------------------------------------------------
say "Restarting"
# ---------------------------------------------------------------------------
# A second of downtime, which is a wall that blinks. Do not deploy into a
# tournament that is being played.
sudo systemctl restart whistleday-api
sudo systemctl restart whistleday-web

# ---------------------------------------------------------------------------
say "Checking it came back"
# ---------------------------------------------------------------------------
for _ in $(seq 1 30); do
	api=$(curl -sS -o /dev/null -w '%{http_code}' -m 3 http://127.0.0.1:8090/api/health || true)
	web=$(curl -sS -o /dev/null -w '%{http_code}' -m 3 http://127.0.0.1:3000/new || true)
	if [[ $api == 200 && $web == 200 ]]; then
		echo "  api $api, web $web"
		rm -rf "$STAGE"
		say "Done — $STAMP"
		exit 0
	fi
	sleep 1
done

echo "  api ${api:-none}, web ${web:-none}"
echo
echo "It did not come back. The previous binaries are at:"
echo "  $ROOT/pocketbase.previous"
echo "  $ROOT/whistleday-web.previous"
echo "and the database as it was before the migration is at:"
echo "  $ROOT/backups/data-$STAMP.db"
exit 1
