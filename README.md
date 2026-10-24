# HA-Extras
This is a place for all my Scripts, Automations and Cards and extra stuff I want to keep so I don't have to go looking in the future

## Contents

| Folder | What it is |
|--------|------------|
| [`ksh-style-buttons/`](ksh-style-buttons/) | **KSH Style Buttons** — the Kiwi Smart Home button design system + a library of ready-to-use `button-card` tiles (one YAML per button), a shared `ksh_tap_beep` behaviour template, and a full reference dashboard. Working toward an installable add-on. |
| [`button-style/`](button-style/) | Original design-system write-up + reference dashboard (superseded by [`ksh-style-buttons/`](ksh-style-buttons/)). |
| [`find-my-phone/`](find-my-phone/) | Find-my-phone automation + script. |
| [`hermes-webui-lxc/`](hermes-webui-lxc/) | Proxmox LXC install scripts for [Hermes WebUI](https://github.com/nesquena/hermes-webui) (native systemd service, no Docker). |
| [`nspanel-view-assist/`](nspanel-view-assist/) | NSPanel View Assist automation. |
| [`stock-alerts/`](stock-alerts/) | **Stock threshold alerts** — add/remove "notify me when a ticker goes above/below X" rules from a dashboard card, no YAML at runtime (To-do list + helpers + one automation). |

## Home Assistant MCP server (Claude)

[`.mcp.json`](.mcp.json) connects Claude Code to Home Assistant's
[MCP Server](https://www.home-assistant.io/integrations/mcp_server/) integration
so Claude can read and control exposed entities.

1. In HA: **Settings → Devices & services → Add integration → Model Context Protocol Server**,
   then choose which entities to expose under **Settings → Voice assistants → Expose**.
2. Create a long-lived access token (**Profile → Security**).
3. Set the env vars before starting Claude Code in this folder (keep them out of git):
   ```bash
   export HA_URL="https://<your-instance>.ui.nabu.casa"   # no trailing slash
   export HA_TOKEN="<long-lived-access-token>"
   ```

For claude.ai / Claude Code on the web, add it instead as a custom connector at
<https://claude.ai/customize/connectors> with URL `https://<your-instance>.ui.nabu.casa/api/mcp`
(signs in with OAuth, no token needed). Note: the MCP endpoint is `/api/mcp`, not a `/api/webhook/...` URL.
