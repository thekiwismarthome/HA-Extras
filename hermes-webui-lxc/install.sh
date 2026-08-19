#!/usr/bin/env bash
#
# Installs Hermes WebUI (https://github.com/nesquena/hermes-webui) natively
# on a Debian/Ubuntu host — designed to run INSIDE the LXC container created
# by create-lxc.sh, but works standalone on any Debian 12+/Ubuntu 22.04+ box
# (Proxmox LXC, VM, bare metal — anywhere with systemd and apt).
#
# Run as root. Re-running is safe: it pulls the latest hermes-webui code
# and restarts the service.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/thekiwismarthome/HA-Extras/main/hermes-webui-lxc/install.sh | bash
#   WEBUI_PASSWORD='change-me' bash install.sh

set -euo pipefail

HERMES_USER="${HERMES_USER:-hermes}"
HERMES_INSTALL_DIR="${HERMES_INSTALL_DIR:-/opt/hermes-webui}"
HERMES_HOME_DIR="${HERMES_HOME_DIR:-/home/${HERMES_USER}}"
HERMES_STATE_HOME="${HERMES_STATE_HOME:-${HERMES_HOME_DIR}/.hermes}"

WEBUI_PORT="${WEBUI_PORT:-8787}"
WEBUI_HOST="${WEBUI_HOST:-0.0.0.0}"
WEBUI_PASSWORD="${WEBUI_PASSWORD:-}"

SERVICE_NAME="hermes-webui"
SYSTEMD_UNIT="/etc/systemd/system/${SERVICE_NAME}.service"
REPO_URL="https://github.com/nesquena/hermes-webui.git"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this as root." >&2
  exit 1
fi

ENV_FILE="${HERMES_INSTALL_DIR}/.env"

# Preserve a previously-set password across re-runs (e.g. updates) so it
# isn't silently wiped just because this invocation didn't pass one in.
if [ -z "$WEBUI_PASSWORD" ] && [ -f "$ENV_FILE" ]; then
  EXISTING_PASSWORD="$(grep -m1 '^HERMES_WEBUI_PASSWORD=' "$ENV_FILE" 2>/dev/null | cut -d= -f2-)"
  if [ -n "$EXISTING_PASSWORD" ]; then
    WEBUI_PASSWORD="$EXISTING_PASSWORD"
  fi
fi

if [ -z "$WEBUI_PASSWORD" ] && [ "$WEBUI_HOST" != "127.0.0.1" ]; then
  echo "WARNING: WEBUI_HOST=$WEBUI_HOST with no WEBUI_PASSWORD set — the UI will be" >&2
  echo "         reachable, unauthenticated, to anything on that network." >&2
fi

echo "==> Installing base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  python3 python3-venv python3-pip git curl ca-certificates sudo

echo "==> Ensuring service user '${HERMES_USER}' exists"
if ! id -u "$HERMES_USER" >/dev/null 2>&1; then
  useradd --create-home --home-dir "$HERMES_HOME_DIR" --shell /usr/sbin/nologin "$HERMES_USER"
fi
mkdir -p "$HERMES_HOME_DIR"
chown "$HERMES_USER":"$HERMES_USER" "$HERMES_HOME_DIR"

echo "==> Stopping existing service (if any) before update"
if systemctl list-unit-files "${SERVICE_NAME}.service" >/dev/null 2>&1 \
   && systemctl is-active --quiet "$SERVICE_NAME"; then
  systemctl stop "$SERVICE_NAME"
fi

echo "==> Fetching hermes-webui into ${HERMES_INSTALL_DIR}"
mkdir -p "$(dirname "$HERMES_INSTALL_DIR")"
if [ -d "${HERMES_INSTALL_DIR}/.git" ]; then
  sudo -u "$HERMES_USER" git -C "$HERMES_INSTALL_DIR" pull --ff-only
else
  git clone "$REPO_URL" "$HERMES_INSTALL_DIR"
  chown -R "$HERMES_USER":"$HERMES_USER" "$HERMES_INSTALL_DIR"
fi

echo "==> Writing ${HERMES_INSTALL_DIR}/.env"
{
  echo "HERMES_HOME=${HERMES_STATE_HOME}"
  echo "HERMES_WEBUI_HOST=${WEBUI_HOST}"
  echo "HERMES_WEBUI_PORT=${WEBUI_PORT}"
  echo "HERMES_WEBUI_SKIP_ONBOARDING=1"
  if [ -n "$WEBUI_PASSWORD" ]; then
    echo "HERMES_WEBUI_PASSWORD=${WEBUI_PASSWORD}"
  fi
} > "$ENV_FILE"
chown "$HERMES_USER":"$HERMES_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "==> Running first-time bootstrap (creates venv, installs deps + Hermes Agent)"
echo "    NOTE: this pulls and runs NousResearch/hermes-agent's own install script"
echo "    (github.com/NousResearch/hermes-agent) — a separate, third-party project."
sudo -u "$HERMES_USER" env -i \
  HOME="$HERMES_HOME_DIR" \
  PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
  HERMES_HOME="$HERMES_STATE_HOME" \
  HERMES_WEBUI_SKIP_ONBOARDING=1 \
  ${WEBUI_PASSWORD:+HERMES_WEBUI_PASSWORD="$WEBUI_PASSWORD"} \
  bash -c "cd '$HERMES_INSTALL_DIR' && python3 bootstrap.py '$WEBUI_PORT' --host '$WEBUI_HOST' --no-browser"

echo "==> Stopping the ad-hoc bootstrap instance (systemd will own it from here)"
sudo -u "$HERMES_USER" env -i \
  HOME="$HERMES_HOME_DIR" \
  PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
  HERMES_HOME="$HERMES_STATE_HOME" \
  bash -c "cd '$HERMES_INSTALL_DIR' && ./ctl.sh stop" || true

echo "==> Installing systemd service"
cat > "$SYSTEMD_UNIT" <<EOF
[Unit]
Description=Hermes WebUI
After=network-online.target
Wants=network-online.target

[Service]
Type=forking
User=${HERMES_USER}
Group=${HERMES_USER}
WorkingDirectory=${HERMES_INSTALL_DIR}
Environment=HOME=${HERMES_HOME_DIR}
Environment=HERMES_HOME=${HERMES_STATE_HOME}
ExecStart=${HERMES_INSTALL_DIR}/ctl.sh start
ExecStop=${HERMES_INSTALL_DIR}/ctl.sh stop
PIDFile=${HERMES_STATE_HOME}/webui.pid
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"

echo ""
echo "==> Hermes WebUI installed and running as the '${SERVICE_NAME}' systemd service."
echo "    URL:      http://$(hostname -I | awk '{print $1}'):${WEBUI_PORT}"
echo "    Logs:     journalctl -u ${SERVICE_NAME} -f   (or: tail -f ${HERMES_STATE_HOME}/webui.log)"
echo "    Status:   systemctl status ${SERVICE_NAME}"
echo "    Config:   ${ENV_FILE}"
echo ""
echo "    Add your AI provider API key(s) from inside the web UI on first login."
