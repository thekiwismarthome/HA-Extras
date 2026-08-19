# Hermes WebUI — Proxmox LXC

Two scripts that stand up [Hermes WebUI](https://github.com/nesquena/hermes-webui)
(a self-hosted web UI for the Hermes Agent) as a native systemd service inside
a dedicated Debian 12 LXC container on Proxmox VE. No Docker involved — just
Python, a venv, and a systemd unit, which is how the upstream project is
designed to run.

> ℹ️ Hermes WebUI is a UI for **Hermes Agent**
> ([NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)),
> a separate third-party agent framework. The installer runs that project's
> own install script to pull the agent in — review it yourself if you want to
> know exactly what it does before running this.

## What you get

- A fresh unprivileged LXC container running Debian 12
- Hermes WebUI cloned to `/opt/hermes-webui`, running as an unprivileged
  `hermes` service user (not root)
- A `hermes-webui` systemd service (`systemctl status hermes-webui`),
  auto-starting on container boot, auto-restarting on failure
- Bound to `0.0.0.0:8787` by default so it's reachable from your LAN

## Quick start

Run this **on the Proxmox host** (in the Proxmox shell, as root):

```bash
curl -fsSL https://raw.githubusercontent.com/thekiwismarthome/HA-Extras/main/hermes-webui-lxc/create-lxc.sh -o create-lxc.sh
WEBUI_PASSWORD='pick-something-strong' CTID=900 bash create-lxc.sh
```

This creates the container, waits for networking, then pulls and runs
[`install.sh`](./install.sh) inside it automatically. When it finishes it
prints the URL to open, e.g. `http://192.168.1.50:8787`.

**Always set `WEBUI_PASSWORD`** — the container binds to all interfaces by
default so it's usable from your LAN, which means an unauthenticated instance
is reachable by anything else on that network.

### Settings you'll likely want to change

All via environment variables before running `create-lxc.sh`:

| Variable | Default | Notes |
|---|---|---|
| `CTID` | `900` | Proxmox container ID |
| `CT_HOSTNAME` | `hermes-webui` | Container hostname |
| `STORAGE` | `local-lvm` | Where the container disk lives |
| `BRIDGE` | `vmbr0` | Network bridge |
| `NET_CONFIG` | `ip=dhcp` | Set to e.g. `ip=192.168.1.50/24,gw=192.168.1.1` for a static IP |
| `DISK_SIZE_GB` / `MEMORY_MB` / `CORES` | `8` / `2048` / `2` | Container sizing — plenty for the WebUI itself |
| `WEBUI_PORT` | `8787` | Port the UI listens on |
| `WEBUI_HOST` | `0.0.0.0` | Set to `127.0.0.1` if you'll only ever reach it via a reverse proxy on the same box |
| `WEBUI_PASSWORD` | *(empty)* | Strongly recommended — see above |

Check `pveam available | grep debian-12` if the pinned template version in
`create-lxc.sh` (`TEMPLATE`) has aged out of the Proxmox template repo.

## Running install.sh standalone

`install.sh` doesn't need Proxmox or `create-lxc.sh` — it works on any
Debian/Ubuntu box with systemd (a plain VM, bare metal, a manually-created
LXC, etc.):

```bash
curl -fsSL https://raw.githubusercontent.com/thekiwismarthome/HA-Extras/main/hermes-webui-lxc/install.sh | WEBUI_PASSWORD='...' bash
```

## Day-to-day

Run these **inside the container** (`pct enter <CTID>` from the Proxmox host
first):

```bash
systemctl status hermes-webui       # is it up?
journalctl -u hermes-webui -f       # live logs
systemctl restart hermes-webui
```

## Updating

Re-run `install.sh` inside the container (or re-run `create-lxc.sh` against
the same `CTID` — it exits if the container already exists, so `pct enter`
and fetch/run `install.sh` directly instead):

```bash
pct enter <CTID>
curl -fsSL https://raw.githubusercontent.com/thekiwismarthome/HA-Extras/main/hermes-webui-lxc/install.sh | bash
```

It stops the running service, `git pull`s the latest hermes-webui, re-runs
bootstrap to pick up new dependencies, and restarts the service. Your `.env`
(including your password) is left untouched.

## Uninstalling

```bash
# On the Proxmox host:
pct stop <CTID>
pct destroy <CTID>
```

## Post-install

Open the URL printed at the end of setup, log in with the password you set,
and add your AI provider API key(s) (OpenAI/Anthropic/etc.) from inside the
web UI — those aren't handled by this installer.

## Files

| File | Runs where | Purpose |
|---|---|---|
| [`create-lxc.sh`](./create-lxc.sh) | Proxmox host | Creates the LXC container, then hands off to `install.sh` inside it |
| [`install.sh`](./install.sh) | Inside the container (or any Debian/Ubuntu host) | Installs Hermes WebUI + Hermes Agent, wires up the `hermes-webui` systemd service |
