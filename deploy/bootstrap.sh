#!/usr/bin/env bash
#
# Turn a fresh Ubuntu box into the one Whistle.day runs on. Run once, as root:
#
#   scp -r deploy root@<host>:/tmp/
#   ssh root@<host> 'bash /tmp/deploy/bootstrap.sh'
#
# It installs Caddy, makes the users and directories, puts the service files
# in place and opens the firewall. It does not start the two services, because
# their binaries do not exist yet — the first deploy puts them there and
# starts them.
#
# Idempotent: run it again after changing the Caddyfile and it will reload.
set -euo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=/srv/whistleday
DEPLOY_USER=deploy

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

[[ $EUID -eq 0 ]] || { echo "run this as root"; exit 1; }

# ---------------------------------------------------------------------------
say "Packages"
# ---------------------------------------------------------------------------
apt-get update -qq
# sqlite3 is not optional: release.sh backs up with SQLite's own .backup, not
# cp, because the server is running and a copied file can land mid-write.
apt-get install -y -qq curl rsync sqlite3 ufw debian-keyring debian-archive-keyring apt-transport-https

if ! command -v caddy >/dev/null; then
	curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
		| gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
	curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
		| tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
	apt-get update -qq
	apt-get install -y -qq caddy
fi
caddy version

# ---------------------------------------------------------------------------
say "Users and directories"
# ---------------------------------------------------------------------------
# The service account owns the tournament and nothing else. It has no shell:
# nothing should ever log in as it.
id whistleday &>/dev/null || useradd --system --home "$ROOT" --shell /usr/sbin/nologin whistleday

# The deploy account is what CI logs in as. Separate from the service account
# so a leaked deploy key is a way to push a release, not a way to be the
# process that holds the database open.
id "$DEPLOY_USER" &>/dev/null || useradd --create-home --shell /bin/bash "$DEPLOY_USER"

mkdir -p "$ROOT"/{pb_data,backups,client,staging}
chown -R whistleday:whistleday "$ROOT"
# The deploy user writes into staging/ and renames things into place, so it
# needs the directory itself, not just what is in it.
chown "$DEPLOY_USER":whistleday "$ROOT" "$ROOT/staging"
chmod 0775 "$ROOT" "$ROOT/staging"
usermod -aG whistleday "$DEPLOY_USER"

mkdir -p /var/log/caddy
chown caddy:caddy /var/log/caddy

# Secrets that must not be in git — the OAuth2 client ids and anything else.
# Created empty so the service file's EnvironmentFile has something to read.
touch "$ROOT/.env"
chown whistleday:whistleday "$ROOT/.env"
chmod 0600 "$ROOT/.env"

# ---------------------------------------------------------------------------
say "Services"
# ---------------------------------------------------------------------------
install -m 0644 "$HERE/whistleday-api.service" /etc/systemd/system/
install -m 0644 "$HERE/whistleday-web.service" /etc/systemd/system/
install -m 0644 "$HERE/Caddyfile" /etc/caddy/Caddyfile

# Exactly two commands, and no others. A deploy key that can restart a service
# should not also be a root shell.
cat > /etc/sudoers.d/whistleday-deploy <<EOF
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart whistleday-api, /usr/bin/systemctl restart whistleday-web
EOF
chmod 0440 /etc/sudoers.d/whistleday-deploy
visudo -c -f /etc/sudoers.d/whistleday-deploy

systemctl daemon-reload
# Enabled but not started: the binaries arrive with the first deploy, and a
# unit restart-looping against a missing file fills the journal with nothing
# worth reading. `systemctl restart` in release.sh starts them.
systemctl enable whistleday-api whistleday-web >/dev/null

caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy || systemctl restart caddy

# ---------------------------------------------------------------------------
say "Firewall"
# ---------------------------------------------------------------------------
# 8090 and 3000 are deliberately not here. Both services bind to loopback, and
# the only thing that should reach them is Caddy on this box.
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ufw status verbose | head -12

# ---------------------------------------------------------------------------
say "Done"
# ---------------------------------------------------------------------------
cat <<EOF

Next, in this order:

  1. Add CI's public key so it can log in:
       ssh-copy-id -i <key>.pub $DEPLOY_USER@\$(hostname -f)
     or paste it into /home/$DEPLOY_USER/.ssh/authorized_keys

  2. Point DNS at $(curl -fsS4 --max-time 5 ifconfig.me 2>/dev/null || echo '<this box>')
     A whistle.day  and  A www.whistle.day  — DNS only, grey cloud.
     Caddy gets its certificate by answering on this host; an orange-clouded
     record answers somewhere else, and it closes the projector's stream.

  3. Push to master, or run the deploy workflow by hand.

  4. Then, once the binaries are here, make a superuser:
       sudo -u whistleday $ROOT/pocketbase superuser upsert \\
         you@example.com 'a-real-password' --dir=$ROOT/pb_data

  5. And set the Application URL to https://whistle.day in the dashboard,
     which handoff links are built from. Reach it over a tunnel:
       ssh -L 8090:127.0.0.1:8090 $DEPLOY_USER@<host>
       then http://127.0.0.1:8090/_/

EOF
