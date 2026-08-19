#!/usr/bin/env bash
#
# Creates a Debian 12 LXC container on a Proxmox VE host and installs
# Hermes WebUI (https://github.com/nesquena/hermes-webui) inside it as a
# systemd service. Run this ON THE PROXMOX HOST (as root, in the Proxmox
# shell) — it uses `pct`, which only exists there.
#
# Usage:
#   ./create-lxc.sh                                # auto-picks the next free CTID, prompts for a password
#   CTID=910 WEBUI_PASSWORD='change-me' ./create-lxc.sh   # fully non-interactive
#
# All settings can be overridden via environment variables before running.

set -euo pipefail

# ---- Container settings (override via env) --------------------------------
CTID="${CTID:-}"                             # blank = auto-pick the next free ID
CT_HOSTNAME="${CT_HOSTNAME:-hermes-webui}"
DISK_SIZE_GB="${DISK_SIZE_GB:-8}"
MEMORY_MB="${MEMORY_MB:-2048}"
SWAP_MB="${SWAP_MB:-512}"
CORES="${CORES:-2}"
STORAGE="${STORAGE:-local-lvm}"
BRIDGE="${BRIDGE:-vmbr0}"
NET_CONFIG="${NET_CONFIG:-ip=dhcp}"          # or: ip=192.168.1.50/24,gw=192.168.1.1
UNPRIVILEGED="${UNPRIVILEGED:-1}"

# Template — check `pveam available | grep debian-12` if this version has
# aged out of the Proxmox template repo and bump it.
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-local}"
TEMPLATE="${TEMPLATE:-debian-12-standard_12.7-1_amd64.tar.zst}"

# ---- Hermes WebUI settings (passed through to install.sh) -----------------
WEBUI_PORT="${WEBUI_PORT:-8787}"
WEBUI_HOST="${WEBUI_HOST:-0.0.0.0}"          # 0.0.0.0 so it's reachable on the LAN
WEBUI_PASSWORD="${WEBUI_PASSWORD:-}"         # strongly recommended when WEBUI_HOST != 127.0.0.1

INSTALL_SCRIPT_URL="${INSTALL_SCRIPT_URL:-https://raw.githubusercontent.com/thekiwismarthome/HA-Extras/main/hermes-webui-lxc/install.sh}"

# -----------------------------------------------------------------------------

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this as root on the Proxmox host." >&2
  exit 1
fi

if ! command -v pct >/dev/null 2>&1; then
  echo "pct not found — this script must run on a Proxmox VE host, not inside a container." >&2
  exit 1
fi

if [ -z "$WEBUI_PASSWORD" ] && [ "$WEBUI_HOST" != "127.0.0.1" ]; then
  if [ -t 0 ]; then
    echo "Set a password for Hermes WebUI (it'll be reachable on your LAN at ${WEBUI_HOST}:${WEBUI_PORT})."
    while true; do
      read -r -s -p "Password (leave blank to skip, not recommended): " WEBUI_PASSWORD
      echo
      if [ -z "$WEBUI_PASSWORD" ]; then
        echo "WARNING: continuing with no password." >&2
        break
      fi
      read -r -s -p "Confirm password: " WEBUI_PASSWORD_CONFIRM
      echo
      if [ "$WEBUI_PASSWORD" = "$WEBUI_PASSWORD_CONFIRM" ]; then
        break
      fi
      echo "Passwords didn't match, try again." >&2
    done
    unset WEBUI_PASSWORD_CONFIRM
  else
    echo "WARNING: WEBUI_HOST=$WEBUI_HOST exposes the UI on the LAN with no password set." >&2
    echo "         Pass WEBUI_PASSWORD='...' when running non-interactively (e.g. curl | bash)." >&2
    sleep 5
  fi
fi

if [ -z "$CTID" ]; then
  CTID="$(pvesh get /cluster/nextid)"
  echo "==> No CTID given, using next free ID: $CTID"
fi

if pct status "$CTID" >/dev/null 2>&1; then
  echo "Container $CTID already exists. Pick a different CTID or remove it first." >&2
  exit 1
fi

echo "==> Ensuring template ${TEMPLATE} is present in storage ${TEMPLATE_STORAGE}"
if ! pveam list "$TEMPLATE_STORAGE" 2>/dev/null | grep -q "$TEMPLATE"; then
  pveam update
  pveam download "$TEMPLATE_STORAGE" "$TEMPLATE"
fi

echo "==> Creating container $CTID ($CT_HOSTNAME)"
pct create "$CTID" "${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE}" \
  --hostname "$CT_HOSTNAME" \
  --cores "$CORES" \
  --memory "$MEMORY_MB" \
  --swap "$SWAP_MB" \
  --rootfs "${STORAGE}:${DISK_SIZE_GB}" \
  --net0 "name=eth0,bridge=${BRIDGE},${NET_CONFIG},firewall=1" \
  --unprivileged "$UNPRIVILEGED" \
  --onboot 1 \
  --start 1

echo "==> Waiting for container network..."
for _ in $(seq 1 30); do
  if pct exec "$CTID" -- getent hosts github.com >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

# The base Debian template ships without curl/wget, so fetch install.sh here
# on the host (which has curl) and push it in, rather than relying on the
# fresh container being able to fetch it itself.
echo "==> Fetching installer"
TMP_INSTALL="$(mktemp)"
trap 'rm -f "$TMP_INSTALL"' EXIT
curl -fsSL "$INSTALL_SCRIPT_URL" -o "$TMP_INSTALL"

echo "==> Copying installer into the container"
pct push "$CTID" "$TMP_INSTALL" /root/install.sh
pct exec "$CTID" -- chmod +x /root/install.sh

echo "==> Running installer inside the container"
pct exec "$CTID" -- env \
  WEBUI_PORT="$WEBUI_PORT" \
  WEBUI_HOST="$WEBUI_HOST" \
  WEBUI_PASSWORD="$WEBUI_PASSWORD" \
  bash /root/install.sh

CT_IP="$(pct exec "$CTID" -- hostname -I | awk '{print $1}')"
echo ""
echo "==> Done. Hermes WebUI should be reachable at: http://${CT_IP}:${WEBUI_PORT}"
echo "    Container: pct enter ${CTID}   |   Service: systemctl status hermes-webui (inside the CT)"
