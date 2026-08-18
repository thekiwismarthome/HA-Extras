# The Kiwi Smart Home — Button Style

A design system for Home Assistant `custom:button-card` tiles built from **animated,
colour-coded SVG line-art on a black dashboard**. This is the canonical reference:
any new button or dashboard "in this style" follows the rules below.

> **Prompt shortcut:** "make me a *\<thing\>* button in my style" → build a
> `custom:button-card` per this spec — square, black, no chrome, a single
> `currentColor` line-icon centred at 85%, colour + glow driven by entity state.

---

## 1. Design principles

1. **Icon-only.** No name, no state text, no MDI icon. The graphic *is* the control.
2. **Line-art, not fills.** One continuous-looking stroke drawing, rounded ends,
   hollow. Reads like a single pen stroke.
3. **One colour, driven by state.** The whole icon is `currentColor` (or a single
   `--*-color` CSS var). State changes recolour the *entire* icon — never partial.
4. **Light = glow.** "On / active" states add a `drop-shadow` glow in the icon's own
   colour. "Off / idle" is a flat dim grey with no glow.
5. **Black canvas.** Cards sit on `#000000` (or transparent when floating over a
   background). No borders, no shadows, no padding.
6. **Square and centred.** `aspect_ratio: 1/1`, icon absolutely centred, sized as a
   percentage of the tile so it scales with any grid.
7. **Tap toggles, hold informs.** `tap_action` does the obvious thing; `hold_action`
   opens more-info. Always.
8. **Motion is meaningful, and it's opt-in per state.** Animation only runs to signal
   an active state (cleaning, working). Idle tiles are still. Respect calm.

---

## 2. The canonical skeleton

Copy this and swap the entity, the SVG paths, and the state colours.

```yaml
type: custom:button-card
entity: light.example            # your entity
aspect_ratio: 1/1
show_name: false
show_state: false
show_icon: false

# Tap = the obvious action. Hold = more-info. Always.
tap_action:
  action: toggle
hold_action:
  action: more-info

# The icon, defined ONCE. currentColor / a CSS var lets each state recolour it.
custom_fields:
  graphic: |
    <svg viewBox="0 0 100 100" fill="none" stroke="currentColor"
         stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"
         style="width:100%;height:100%">
      <!-- line-art paths here -->
    </svg>

styles:
  card:
    - padding: 0px
    - background-color: "#000000"    # transparent when floating on a background
  grid:
    - position: relative
  custom_fields:
    graphic:
      - position: absolute
      - top: 50%
      - left: 50%
      - transform: translate(-50%, -50%)
      - width: 85%                   # 60% for small nav/utility icons
      - height: 85%
      - color: "#6B6E70"             # default = off / dim grey
```

Add per-state colour/glow with a `state:` block (see §5) or JS templates in the
`styles` (see §6).

---

## 3. SVG icon conventions

Every icon is authored to the same recipe so a whole dashboard looks like one set.

| Attribute            | Value                                             |
|----------------------|---------------------------------------------------|
| `viewBox`            | `0 0 100 100` (simple icons) — larger, e.g. `0 0 240 240`, only when detail/animation needs the room |
| `fill`               | `none`                                            |
| `stroke`             | `currentColor` (or `var(--x-color)` for multi-part / animated icons) |
| `stroke-width`       | `4.5` on the 100×100 grid (scale proportionally on bigger viewBoxes: ~2.5 on 240) |
| `stroke-linecap`     | `round`                                           |
| `stroke-linejoin`    | `round`                                           |
| sizing               | `style="width:100%;height:100%"` on the `<svg>`   |

Drawing rules:

- **Keep it to a handful of paths.** A recognisable silhouette in 4–8 strokes.
- **Centre the mass** roughly in the viewBox so the 85% placement looks balanced.
- **No text, no fills, no gradients.** Depth comes from the glow, not shading.
- For **multi-part / animated** icons, colour parts with `var(--x-color)` and use
  `var(--card-background-color, #fff)` (forced to `#000`) for "hollow" fills that
  should read as cut-outs on the black card.

---

## 4. Colour palette

The shared state palette. Reuse these exact hexes so every tile agrees.

| Meaning                     | Hex        | Swatch |
|-----------------------------|------------|--------|
| Off / idle / default (grey) | `#6B6E70`  | dim slate |
| Off (alt, lighter grey)     | `#D2D2D2`  | for nav/light-off icons |
| Returning / muted active    | `#7E8083`  | |
| Docked / neutral white      | `#FFFFFF`  | |
| Warm light "on"             | `#FFC65C`  | amber |
| Heat                        | `#FF6B35`  | orange |
| Cool                        | `#00A1E4`  | blue |
| Dry / info                  | `#26C6DA`  | cyan |
| Auto / success / on         | `#34C759`  | green |
| Warning / bin-full          | `#FF9F0A`  | amber-orange |
| Error / alert               | `#FF3B30`  | red |

Glow is always the icon colour at low alpha:
`drop-shadow(0 0 8px rgba(R,G,B, 0.5))` — bump blur/alpha for "brighter".

---

## 5. State-driven colour (the common pattern)

Recolour (and optionally glow) per entity state with a `state:` block. Example
(AC / climate):

```yaml
state:
  - value: heat
    styles:
      custom_fields:
        graphic:
          - color: "#FF6B35"
          - filter: drop-shadow(0 0 8px rgba(255, 107, 53, 0.55))
  - value: cool
    styles:
      custom_fields:
        graphic:
          - color: "#00A1E4"
          - filter: drop-shadow(0 0 8px rgba(0, 161, 228, 0.55))
```

The default (off / unlisted state) uses the grey set in the base `styles`.

Use `operator: template` for derived states (e.g. a linked sensor):

```yaml
  - operator: template
    value: "[[[ return states['binary_sensor.x'].state === 'on'; ]]]"
    styles: { ... }
```

---

## 6. Brightness / continuous glow (JS templates)

When a value is continuous (a dimmer's brightness), drive colour, opacity, and glow
with JS templates that read the attribute — no extra states needed. Pattern from the
ceiling light:

```yaml
custom_fields:
  graphic:
    - color: |
        [[[ return entity.state === 'on' ? '#FFC65C' : '#6B6E70'; ]]]
    - opacity: |
        [[[
          if (entity.state !== 'on') return '1';
          const b = entity.attributes.brightness || 255;
          return (0.55 + (b / 255) * 0.45).toFixed(2);   // fade at low dim
        ]]]
    - filter: |
        [[[
          if (entity.state !== 'on') return 'none';
          const b = entity.attributes.brightness || 255;
          const p = b / 255;
          const blur = (4 + p * 12).toFixed(1);           // glow grows with brightness
          const op = (0.25 + p * 0.5).toFixed(2);
          return 'drop-shadow(0 0 ' + blur + 'px rgba(255,198,92,' + op + '))';
        ]]]
```

Attribute changes on the entity re-render the card, so no `triggers_update` needed
for its own attributes.

---

## 7. Animation conventions

For active-state motion (see `vacuum-button-card.yaml` as the reference build):

- Animations live in **`extra_styles`** (injected into the card's shadow DOM).
- Each animation's `animation-play-state` is driven by a **CSS custom property**
  (e.g. `--brush-play`), defaulting to `paused`.
- A `state:` block flips the property to `running` (and sets any `--*-op` visibility
  vars) only in the states where the motion belongs.
- **The `"--name": value` keys MUST stay quoted** in YAML — a leading `-` otherwise
  trips the parser.
- Use `transform-box: fill-box` (or `view-box` for whole-body pivots) + a
  `transform-origin` so rotations spin about the right point.
- Keep it subtle: slow glows, gentle wiggles, particles that fade. Never frantic.

---

## 8. Interaction conventions

| Gesture | Action |
|---------|--------|
| **Tap**  | The obvious control — `toggle`, or a JS-templated service call that picks the right service for the current state. |
| **Hold** | `more-info` (or `none` for pure nav buttons). |

Templated tap example (do the context-right thing):

```yaml
tap_action:
  action: call-service
  service: |
    [[[ return entity.state === 'off' ? 'climate.turn_on' : 'climate.turn_off'; ]]]
  target:
    entity_id: climate.ac_living_room
```

Navigation buttons auto-detect the current dashboard from the URL so they're
copy-paste portable (see `back-button-card.yaml`):

```yaml
tap_action:
  action: navigate
  navigation_path: |
    [[[ return '/' + window.location.pathname.split('/')[1] + '/home'; ]]]
```

---

## 9. Dashboard conventions

- **Black background**, tiles on a square grid, generous gaps — icons breathe.
- Mix these button tiles freely; the shared palette + line weight makes them a set.
- Floating controls (back arrows, overlays) use `background-color: transparent`,
  `box-shadow: none`, `border: none` and a smaller icon (~60%).
- Requires [`custom:button-card`](https://github.com/custom-cards/button-card) via HACS.

---

## 10. Reference builds

| File | Shows off |
|------|-----------|
| `ceiling-light-button-card.yaml` | continuous brightness → colour/opacity/glow via JS templates |
| `ac-button-card.yaml`            | discrete `state:` colour mapping + templated tap |
| `vacuum-button-card.yaml`        | full animation system (CSS vars + `extra_styles`) |
| `back-button-card.yaml`          | transparent floating nav button, URL auto-detect |
| `vacuum.svg`                     | standalone minimal vacuum icon |

---

*Style: The Kiwi Smart Home. Black canvas · one-stroke line-art · one colour per
state · light means glow · motion means active.*
