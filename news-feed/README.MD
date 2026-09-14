# RNZ News Reader for Home Assistant

A master/detail news dashboard for Home Assistant, built in the Kiwi Smart Home
style (black canvas, Antonio font). Channel tabs down the top, a headline list on
the left, and the live story webpage on the right — with per-story **read-aloud**
(full article via Home Assistant Cloud TTS) and a **play button** for the latest
RNZ News audio bulletin.

Designed for a wall tablet running **VACA** (View Assist Companion App), and tested
there. News comes from RNZ's public RSS feeds; the story pane loads the real RNZ
page.

---

## Features

- **Channel tabs** — National, World, Politics, Business, Sport, Pacific,
  Te Ao Māori, Education (each backed by its own RSS feed). Tap a tab to switch.
- **Headline list, newest first** — with relative age ("5m ago", "2h ago"),
  refreshed every minute.
- **Latest story auto-opens** on load and when you change channels.
- **Click-to-read** — tap a headline and the real RNZ page loads in the right pane
  (50/50 split, each side scrolls, the card never runs past the bottom of the screen).
- **Weather warnings** — MetService warnings pinned in amber at the top of every
  channel.
- **Per-row read-aloud** — a play triangle on each story reads the full article
  aloud through your VACA media player (HA Cloud TTS). Tap the glowing one to stop.
- **Audio bulletin button** (optional) — plays the latest RNZ News audio bulletin,
  URL auto-scraped so it's always current.

---

## Files

### Core (needed)

| File | Goes to | What it is |
|------|---------|------------|
| `news-reader-card.js` | `<config>/www/community/news-reader-card/` | The custom Lovelace card (tabs + list + webpage + per-row read-aloud). |
| `news-reader-view.yaml` | dashboard (paste as a view) | Panel-mode view with the card configured. |
| `news-banner-sensors.yaml` | `entities/sensors/` | National feed → `sensor.news_headlines`. |
| `rnz-world-sensor.yaml` … `rnz-education-sensor.yaml` | `entities/sensors/` | The other channel feeds. |
| `metservice-warnings-sensor.yaml` | `entities/sensors/` | MetService warnings → `sensor.metservice_warnings`. |

### Read-aloud (optional but recommended)

| File | Goes to | What it is |
|------|---------|------------|
| `rnz_read_aloud.py` | `<config>/pyscript/` | pyscript service `pyscript.rnz_read_aloud` — fetches the story, extracts the body, speaks it. |
| `rnz-read-aloud.yaml` | reference | pyscript enable note (do it in the UI instead). The `input_text` helper is only needed for the standalone read-aloud button. |
| `rnz-read-aloud-button-card.yaml` | dashboard (optional) | A single "read the story that's showing" button. Superseded by the per-row buttons. |

### Audio bulletin (optional)

| File | Goes to | What it is |
|------|---------|------------|
| `rnz-bulletin-audio-sensor.yaml` | `entities/sensors/` | REST scrape → `sensor.rnz_latest_bulletin` (current bulletin MP3 URL). |
| `rnz-bulletin-button-card.yaml` | dashboard | Play button for the latest bulletin. |

### Alternates (pick one style, not both)

| File | What it is |
|------|------------|
| `news-feeds-sensors.yaml` | All feed sensors in ONE file, as an HA **package** (instead of the per-file versions in `entities/sensors/`). |
| `news-banner-card.yaml` | The original horizontal scrolling ticker banner (superseded by the full reader). |

---

## Requirements

- **HACS** integrations: `custom:button-card`, `feedparser`, and (for read-aloud)
  `pyscript`.
- **Home Assistant Cloud** (Nabu Casa) for TTS — `tts.home_assistant_cloud`.
- A **media_player** for read-aloud/bulletin — here the VACA player
  `media_player.office_vaca_office_tablet_media_player` (use your own).

---

## Installation

### 1. Feed sensors

Copy the per-channel files into your `entities/sensors/` folder (loaded via
`sensor: !include_dir_list`, so each file is **one sensor as a plain mapping** — no
`sensor:` key, no `- ` dash). Then **restart HA** (new platform sensors need a full
restart).

Entities created: `sensor.news_headlines`, `sensor.rnz_world`,
`sensor.rnz_politics`, `sensor.rnz_business`, `sensor.rnz_sport`,
`sensor.rnz_pacific`, `sensor.rnz_te_ao_maori`, `sensor.rnz_education`,
`sensor.metservice_warnings`.

### 2. The card

1. Copy `news-reader-card.js` to `<config>/www/community/news-reader-card/`.
2. Settings → Dashboards → ⋮ → **Resources** → Add
   `/local/community/news-reader-card/news-reader-card.js` as a **JavaScript module**.
   (Bump `?v=N` on the URL whenever you replace the file, so the tablet reloads it.)
3. Add `news-reader-view.yaml` as a new view (edit dashboard → raw config), or paste
   its `custom:news-reader-card` card into a full-width / panel slot.

### 3. Read-aloud (pyscript + HA Cloud)

1. HACS → install **pyscript** → restart HA.
2. Settings → Devices & Services → **+ Add Integration** → **Pyscript Python
   scripting** → add → **Configure** → tick **Allow all imports** + **Hass is
   global**. (Do this in the UI *or* YAML, not both.)
3. Copy `rnz_read_aloud.py` to `<config>/pyscript/rnz_read_aloud.py`.
4. In the card config set `tts_player` to your media_player (and `tts_service` stays
   `pyscript.rnz_read_aloud`). Each story row then shows a play button that reads it.
5. Reload: Developer Tools → Actions → `pyscript.reload` (or restart HA).

### 4. Audio bulletin button (optional)

1. Copy `rnz-bulletin-audio-sensor.yaml` to `entities/sensors/`, restart HA.
2. Add `rnz-bulletin-button-card.yaml` to the dashboard and set your VACA player in
   all three places.

---

## Card configuration

```yaml
type: custom:news-reader-card
title: RNZ News
channels:
  - { label: National,      entity: sensor.news_headlines }
  - { label: World,         entity: sensor.rnz_world }
  - { label: Politics,      entity: sensor.rnz_politics }
  - { label: Business,      entity: sensor.rnz_business }
  - { label: Sport,         entity: sensor.rnz_sport }
  - { label: Pacific,       entity: sensor.rnz_pacific }
  - { label: "Te Ao Māori", entity: sensor.rnz_te_ao_maori }
  - { label: Education,     entity: sensor.rnz_education }
warnings_entity: sensor.metservice_warnings     # pinned amber on every channel
tts_player: media_player.office_vaca_office_tablet_media_player  # enables per-row read-aloud
tts_service: pyscript.rnz_read_aloud            # called with {player, url}
default_url: ""                                 # page shown before any selection
split: 50                                       # left list width (%)
bottom_gap: 8                                   # px kept clear below the card
open_newest_on_load: true                       # show newest story by default
```

| Option | Default | Notes |
|--------|---------|-------|
| `channels` | — | List of `{label, entity}`. Also accepts a single `news_entity`. |
| `warnings_entity` | none | Pinned amber at the top of every channel. |
| `tts_player` | none | media_player for per-row read-aloud. Omit to hide the play buttons. |
| `tts_service` | `pyscript.rnz_read_aloud` | `"<domain>.<service>"`, called with `{player, url}`. |
| `split` | 50 | Left list width in %. Lower = bigger webpage. |
| `bottom_gap` | 8 | Pixels kept clear below the card. |
| `open_newest_on_load` | false | Auto-open newest story on load / channel switch. |
| `title` | "News" | Header text; `""` hides it. |

### Adding more channels

RNZ has more section feeds. Add a sensor file for the section (copy an existing
`rnz-*-sensor.yaml`, change `name` and the `feed_url` slug) and add a
`{ label, entity }` line to `channels`. Known-good extra slugs: `health`,
`environment`, `country`, `in-depth` → *In Depth*, `ldr` → *Local Democracy*,
`weather`.

---

## Notes & gotchas (things that cost real time)

- **RNZ framing:** article pages have no `X-Frame-Options` (they embed fine), but
  **section pages send `X-Frame-Options: SAMEORIGIN`** and refuse to frame — that's
  why channel browsing is done via tabs (per-section RSS) instead of RNZ's own menu.
- **Android WebView blank iframe:** don't put a `sandbox` attribute on the iframe —
  Android WebView renders sandboxed cross-origin pages blank. The card omits it.
- **Dark-mode white-on-white:** with the tablet in dark mode, WebView "force dark"
  wrecks RNZ (no dark theme). The card sets `color-scheme: light` on the iframe to
  stop it; the fallback is Android Developer Options → *Override force-dark* → OFF.
- **Relative time showed "1304w":** feedparser's default `date_format` omits the
  year, and JS reads a year-less date as 2001. Every sensor sets
  `date_format: "%a, %d %b %Y %H:%M:%S %z"` so the year + timezone survive.
- **TTS silent on long text:** HA Cloud TTS silently drops long messages (~2000+
  chars). The read-aloud caps the message at ~1500 chars.
- **pyscript quirks:** `task.executor` only runs *plain* Python functions (not
  pyscript-defined ones — so only the native `urllib` calls go in the executor);
  pyscript has **no generator expressions** (use plain loops); image captions live
  in `<figcaption>` and are stripped before extraction so they aren't read aloud.

---

## Credits

Built for **The Kiwi Smart Home**. Feeds © RNZ (rnz.co.nz) and MetService, used via
their public feeds. Kiwi button/dashboard style throughout.
