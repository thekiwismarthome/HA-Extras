# KSH Style Buttons

**The Kiwi Smart Home button style for Home Assistant** — a small design system and a
library of ready‑to‑use `custom:button-card` tiles: animated, colour‑coded **SVG
line‑art on a black canvas**, where every tap gives a haptic buzz and a soft click.

Icon‑only. One colour per state. Light means glow. Motion means active.

> **Goal:** make these buttons trivial to reuse across my own dashboards *and* easy for
> anyone else to drop into theirs — ultimately packaged as an installable add‑on
> (see [Roadmap](#roadmap)).

---

## What's in here

```
ksh-style-buttons/
├─ README.md                     ← you are here
├─ templates/
│  └─ ksh-style-buttons.yaml      ← reusable button_card_templates (ksh_tap_beep behaviour)
├─ buttons/                       ← one self‑contained tile per file
│  ├─ home.yaml     news.yaml     shares.yaml     ← navigation tiles (use the template)
│  ├─ byd.yaml                                    ← EV tile (static SVG): BYD wordmark, colour by battery %
│  ├─ light.yaml    climate.yaml  vacuum.yaml     ← entity tiles
│  ├─ ambilight.yaml tv.yaml      music.yaml
│  ├─ alarm.yaml    sofa.yaml
│  └─ washer.yaml   dryer.yaml
└─ example-dashboard.yaml         ← every tile in one working 4‑column grid (reference)
```

Each file in `buttons/` is a complete `custom:button-card` you can paste into a grid.
`example-dashboard.yaml` is the canonical, working source that all the docs describe.

---

## Requirements

| Need | Why |
|------|-----|
| [**custom:button-card**](https://github.com/custom-cards/button-card) (via HACS) | every tile is a `button-card` |
| **`javascript` tap actions enabled** | the click‑beep + smart actions run in `[[[ … ]]]` JS templates |
| The **Antonio** font available to the dashboard | house rule — all KSH cards use Antonio (the `news` wordmark relies on it) |
| A **dark/black dashboard background** | tiles are transparent; the background provides the black |

> **Font:** add Antonio once, e.g. a resource that `@import`s
> `https://fonts.googleapis.com/css2?family=Antonio:wght@400;600;700&display=swap`,
> or a card‑mod / theme rule. Every KSH card names `Antonio` in its font stack.

---

## Install & use

### 1. Register the template (once per dashboard)

The buttons in `buttons/home.yaml`, `news.yaml` and `shares.yaml` get their behaviour
from the **`ksh_tap_beep`** template, so register it at the **root** of the dashboard
(same level as `views:`).

**YAML‑mode dashboard:**
```yaml
button_card_templates: !include ksh-style-buttons/templates/ksh-style-buttons.yaml
views:
  - ...
```

**Storage (UI) dashboard:** *Edit dashboard → ⋮ → Raw configuration editor*, then paste
the `button_card_templates:` block from `templates/ksh-style-buttons.yaml` at the top.

### 2. Drop a button into a grid

```yaml
square: true
type: grid
columns: 4
cards:
  - !include ksh-style-buttons/buttons/home.yaml
  - !include ksh-style-buttons/buttons/news.yaml
  - !include ksh-style-buttons/buttons/shares.yaml
  - !include ksh-style-buttons/buttons/climate.yaml
```
…or just copy the file's contents inline. Set the tile's `entity:` to your own entity.

---

## The two layers

A KSH tile is **behaviour + look**:

- **Behaviour** — what a tap does. Provided by the `ksh_tap_beep` template: it plays the
  click beep + heavy haptic, then picks its action from the card's `variables`.
- **Look** — the SVG line‑art, colours, halo and animation. Lives in the card's
  `custom_fields` + `styles` + `extra_styles`.

### `ksh_tap_beep` — action switches

Add `template: ksh_tap_beep` to a card and set **one** of these `variables` (don't add a
card‑level `tap_action` — it would override the template and kill the beep):

| `variables:` | Action |
|---|---|
| `nav: shares` | Navigate to `/<current-dashboard>/shares` |
| `tap: climate` | State‑aware `climate.turn_on` / `turn_off` (needs `entity:`) |
| `tap: vacuum` | `start` / `pause` / `locate` by vacuum state (needs `entity:`) |
| `effect: <name>` | Light `turn_on` **with** that effect, else `turn_off` |
| `service: domain.service` (+ `data:`) | Call any service on `entity` |
| *(none)* | `toggle` the entity's own domain |

`hold` = `more-info`. Navigation tiles override it with `hold_action: { action: none }`.

```yaml
# behaviour + look combined in one file
type: custom:button-card
template: ksh_tap_beep
entity: climate.lounge
variables: { tap: climate }
# ...custom_fields / styles for the AC look...
```

> **Note on the two beep variants.** The `ksh_tap_beep` template plays at `gain 1` (a
> touch louder). The entity tiles in `buttons/` still carry the **inline** tap wrapper at
> `gain 0.25` from the original build — see [Migration](#migrating-the-entity-tiles).

---

## Design system

The rules every tile follows (the full annotated source is `example-dashboard.yaml`):

1. **Icon‑only.** No name, no state text, no MDI icon — the graphic *is* the control.
2. **Line‑art, not fills.** Hollow strokes, rounded caps; concentric rings + a single
   accent path. Depth comes from a faint inner glow, never shading.
3. **One colour, driven by state.** The whole icon is a single `--x-color` var; state or
   brightness recolours the *entire* icon.
4. **Light = glow.** Active/on adds a `drop-shadow` glow in the icon's colour + a soft
   inner halo. Off/idle is flat white or dim grey, no glow.
5. **Transparent cards.** `background-color: transparent`, `box-shadow/border: none`,
   `padding: 0`. The dashboard provides the black.
6. **Square & oversized.** `aspect_ratio: 1/1`; icon absolutely centred at `100–110%` so
   it fills the tile edge‑to‑edge.
7. **Every tap speaks.** Tap → `haptic: heavy` + a 900 Hz click, then the action.
8. **Motion means active.** Animations run only in working states (gated by CSS
   `--*-play` vars). Idle tiles are still.

### SVG conventions

| Attribute | Value |
|---|---|
| `viewBox` | `0 0 240 240` (the standard grid) |
| `fill` | `none` for line‑art; `var(--card-background-color, #000)` for hollow cut‑out bodies |
| `stroke` | `var(--x-color)` — one colour var per icon |
| `stroke-width` | **3.4–3.5** main · **2.5** secondary · **0.8–1.2** faint detail (opacity 0.2–0.5) |
| `stroke-linecap` / `linejoin` | `round` |
| sizing | `class="x-svg"` + `.x-svg { width:100%; height:100%; display:block; }` in `extra_styles` |

**Composition recipe:** outer filled halo (`circle r≈110`, low opacity) → ring frame
(`r=94` main + `r=86` thin) → the subject drawn hollow with `--card-background-color`
fills so overlaps read as cut‑outs → an inner accent/glow whose opacity scales with
state. Set `--card-background-color: '#000000'` per field so hollow fills stay black even
though the card is transparent.

> **Line‑art sizing gotcha (learned building `news`):** a small shape at 3.5 stroke looks
> *chunky*. Make the icon **fill the box** (features at r≈78–94) and **layer the weights**
> (3.5 outline / 2.5 grid / 0.8 faint) — that's what makes it read as fine line‑art.

### Colour palette

| Meaning | Hex |
|---|---|
| Off / neutral (white) | `#FFFFFF` |
| Off / idle (dim grey) | `#6B6E70` · `#D2D2D2` · `#9BA0A3` |
| Returning / muted | `#7E8083` |
| Warm light "on" (base) | `#FFC65C` |
| Heat | `#FF6B35` |
| Cool / running / info | `#00A1E4` |
| Dry / delayed | `#26C6DA` |
| Auto / ready / success | `#34C759` |
| Warning / paused | `#FF9F0A` |
| End‑of‑cycle / special | `#B06BFF` |
| Error / ringing / alert | `#FF3B30` |
| Hue‑cycle (ambilight) | `#FFC65C → #FF6B8A → #B06BFF → #00A1E4 → #26C6DA → #34C759` |

**Dimmable warm light** interpolates a cool→warm ramp from `brightness` (0–255):
```js
const p = (entity.attributes.brightness || 255) / 255;
return 'rgb(' + Math.round(224 + p*31) + ',' + Math.round(140 + p*100) + ',' + Math.round(30 + p*166) + ')';
```

### Halos

- **State glow** (entity tiles): `drop-shadow(0 0 <8–16>px rgba(R,G,B,<0.4–0.55>))` in the
  icon colour, scaling with brightness/intensity — plus a low‑opacity filled `circle`.
- **Static gradient halo** (nav tiles: news/shares): a `radialGradient` with stops
  `0%→1, 55%→0.9, 82%→0.4, 100%→0`, on a `circle r≈122`, strength via `--halo-op`
  (≈0.2), colour via `--halo-color`. Keep `overflow: visible` on the card + SVG so it
  isn't clipped.

> **Halo colour gotcha:** make the halo a **different** colour from the icon. A same‑colour
> glow bleeds into the strokes and softens the edges. (That's why `news` is a `#3042a1`
> globe with a `#FF6B6B` red halo.)

---

## The tiles

| Tile | Behaviour | What it demonstrates |
|---|---|---|
| **home** | `nav: home` | template‑driven navigation; house glyph + glow |
| **news** | `nav: news` | line‑art globe filling the box + Antonio wordmark; gradient halo |
| **shares** | `nav: shares` | random up/down/up bar chart; arrow tracing the tops at matching weight |
| **byd** | more‑info | EV tile off the **bydauto** integration. **Static SVG** (no JS templates) — the BYD wordmark logo recoloured by battery % via `state:` blocks (≥60 green · 30–59 amber · <30 red · non‑numeric grey), with a soft glow. Live %/gauge/charging animation is a later add‑on once JS templates are sorted |
| **light** | inline toggle | brightness → colour/stroke/halo/glow via JS‑var templates |
| **climate** | inline `turn_on`/`off` | discrete `state:` colour map + airflow animation |
| **vacuum** | inline start/pause/locate | full animation system (spin, particles, dock) + bin‑full template state |
| **ambilight** | inline toggle | hue‑cycling accent + LED‑strip breathe + spill glow |
| **tv** | inline toggle | `conditional` on remote state; power‑glyph reveal |
| **music** | inline nav (`/music`) | static EQ glyph; pushState navigation |
| **alarm** | inline nav (`/alarms`) | JS‑generated SVG; ring animation by timer state |
| **sofa** | inline `turn_on` w/ `effect` | `rgb_color`‑aware colour + glow |
| **washer / dryer** | inline update + more‑info | `conditional`; JS SVG with live `HH:MM` text + glyph switching |

### Conditional tiles

`tv`, `washer` and `dryer` are wrapped in a `conditional` card so they only show when
relevant (TV remote `on`; appliance state not `Idle`). Those files include the wrapper.

### JS‑generated SVG (alarm, washer, dryer)

When an icon must change shape or show text, the whole SVG is built in a `[[[ … ]]]`
template that returns markup — enabling glyph switching and live `<text>` `HH:MM`
(styled by `.time-lg` / `.time-sm`). Guard text sources against
`unknown`/`unavailable`/`none` and fall back to `--:--`.

> **JS template gotcha:** button‑card injects `hass`, `states`, `entity`, `user`,
> `variables` **and `html`** into `[[[ ]]]` scope. Don't declare your own `html` — name a
> markup accumulator `page`/`out`/`body` instead.

---

## Navigation & View Assist notes

- Nav tiles build the path from the **current** dashboard segment so one file works on any
  dashboard: `('/' + location.pathname.split('/')[1]) + '/<view>'`.
- On NSPanel / View Assist satellites, per‑device timeouts and current view live on the
  satellite sensor (e.g. `sensor.vaca_<device>_tablet`) — read those centrally rather than
  hard‑coding per screen.

## Performance (NSPanel Pro & low‑power tablets)

- The priciest static cost is **blur** in `drop-shadow`/`filter`. On weak panels, drop the
  glow filters first.
- Remove `@keyframes` / `animation` / `transition` on idle tiles; keep motion to active
  states only. A no‑animation variant of the grid renders noticeably lighter.

---

## Migrating the entity tiles

The `buttons/*.yaml` entity tiles currently carry the **inline** tap wrapper they were
built with. To move one onto the shared template: delete its `tap_action` block, add
`template: ksh_tap_beep`, and set the matching `variables` (e.g. `{ tap: climate }`,
`{ tap: vacuum }`, `{ effect: solid }`, or `{ service: light.toggle }`). The
washer/dryer "refresh + open more‑info" action isn't covered by the template yet, so
those stay inline for now.

---

## Roadmap

- [ ] Migrate entity tiles onto `ksh_tap_beep` (add a `moreinfo` branch for washer/dryer).
- [ ] Split *look* from *behaviour* into `look_*` templates so tiles are `template: [ksh_tap_beep, look_x]`.
- [ ] Package as an installable **add‑on** for easy reuse and sharing (HACS‑distributable
      template bundle + button library, versioned).
- [ ] More tiles: scenes, cameras, weather, per‑room shortcuts.

---

*Style: **The Kiwi Smart Home**. Transparent canvas · 240‑grid line‑art · one colour per
state · light means glow · every tap clicks · motion means active.*
