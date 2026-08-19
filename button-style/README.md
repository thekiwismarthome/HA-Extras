# The Kiwi Smart Home — Button Style

A design system for Home Assistant `custom:button-card` tiles: **animated,
colour-coded SVG line-art on a black dashboard, every tap giving a haptic buzz and a
soft click**. This is the canonical reference — any new button or dashboard "in this
style" follows the rules below.

The complete, working source is **[`example-dashboard.yaml`](example-dashboard.yaml)**
(a 4-column grid of every card type). This README explains the patterns in it.

> **Prompt shortcut:** "make me a *\<thing\>* button in my style" → a
> `custom:button-card`: square, transparent card, one `currentColor` line-icon on a
> `240×240` viewBox centred at ~110%, colour + glow driven by entity state, and the
> standard **haptic + click-beep tap wrapper** (§3).

---

## 1. Design principles

1. **Icon-only.** No name, no state text, no MDI icon. The graphic *is* the control.
2. **Line-art, not fills.** Hollow strokes with rounded ends; concentric rings, thin
   detail lines, a single accent path. Depth comes from a faint inner glow, never shading.
3. **One colour, driven by state.** The whole icon is a single `--*-color` var. State
   (or brightness) recolours the *entire* icon — never just part of it.
4. **Light = glow.** Active/on states add a `drop-shadow` glow in the icon's own colour
   plus a soft inner halo. Off/idle is flat white or dim grey with no glow.
5. **Transparent cards.** Tiles use `background-color: transparent`, `box-shadow: none`,
   `border: none`, `padding: 0`. The dashboard/background provides the black.
6. **Square and oversized.** `aspect_ratio: 1/1`; icon absolutely centred and sized
   `100–110%` so it fills the tile edge-to-edge.
7. **Every tap speaks.** Tap → `haptic: heavy` + a synthesized click beep, then the
   action (§3). Hold → more-info (or none for nav).
8. **Motion means active.** Animations run only in working states, gated by CSS
   custom properties. Idle tiles are still. Keep motion subtle.

---

## 2. Layout wrapper

Cards live in a square grid:

```yaml
square: true
type: grid
columns: 4
cards:
  - type: custom:button-card    # tiles below…
```

Tiles that should only appear in certain conditions are wrapped in a `conditional`
card (see §9) — e.g. the washer/dryer tiles show only while a cycle is running.

---

## 3. The tap wrapper (haptic + click beep) — REQUIRED

Every interactive tile uses `action: javascript` so it can fire haptics **and** an
audible click before doing its job. This block is identical on every card — only the
last line(s) (the actual action) change:

```yaml
tap_action:
  action: javascript
  haptic: heavy
  javascript: |
    [[[
      try {
        const ctx = window.__haClickCtx || (window.__haClickCtx = new (window.AudioContext || window.webkitAudioContext)());
        if (ctx.state === 'suspended') ctx.resume();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 900;
        g.gain.setValueAtTime(0.25, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
        o.connect(g); g.connect(ctx.destination);
        o.start(); o.stop(ctx.currentTime + 0.05);
      } catch (e) {}
      hass.callService('light', 'toggle', { entity_id: entity.entity_id });   // ← the action
    ]]]
hold_action:
  action: more-info
```

- A single shared `AudioContext` is cached on `window.__haClickCtx` (900 Hz, 50 ms,
  exponential fade — a soft tick). Wrapped in `try/catch` so audio never blocks the action.
- The action is a **`hass.callService(domain, service, { entity_id })`** call, not the
  `call-service` action. Common bodies:
  - **Toggle:** `hass.callService('light', 'toggle', { entity_id: entity.entity_id });`
  - **State-aware:** `const svc = entity.state === 'off' ? 'turn_on' : 'turn_off'; hass.callService('climate', svc, …);`
  - **Multi-branch (vacuum):** pick `pause`/`locate`/`start` from `entity.state`.
  - **With params (sofa):** `turn_on` with `{ entity_id, effect: 'solid' }`.
- **Navigation** (music/alarm tiles) instead pushes a view without a service call:
  ```js
  const dashboard = window.location.pathname.split('/')[1] || 'lovelace';
  history.pushState(null, '', '/' + dashboard + '/music');
  window.dispatchEvent(new Event('location-changed'));
  ```
- **Open more-info from JS** (washer/dryer, which also refresh first):
  ```js
  hass.callService('homeassistant', 'update_entity', { entity_id: entity.entity_id });
  const ev = new Event('hass-more-info', { bubbles: true, composed: true });
  ev.detail = { entityId: entity.entity_id };
  (document.querySelector('home-assistant') || window).dispatchEvent(ev);
  ```

---

## 4. SVG icon conventions

| Attribute            | Value                                                    |
|----------------------|----------------------------------------------------------|
| `viewBox`            | `0 0 240 240` (the standard grid)                        |
| `fill`               | `none` for line-art; `var(--card-background-color, #000)` for hollow bodies that must read as cut-outs |
| `stroke`             | `var(--x-color)` (one colour var per icon)               |
| `stroke-width`       | `3.4–3.5` main outline · `2.5` secondary · `0.8–1.2` faint detail (`opacity` 0.2–0.5) |
| `stroke-linecap`     | `round`                                                  |
| `stroke-linejoin`    | `round`                                                  |
| sizing               | `class="x-svg"` + `.x-svg { width:100%; height:100%; display:block; }` in `extra_styles` |

Composition recipe (seen across light/TV/music/alarm/washer):

- **Outer halo** — a big filled `circle r≈110` at low `opacity` (0.06–0.14) in the icon
  colour, often animated to breathe when active.
- **Ring frame** — `circle r=94` (main stroke) + `circle r=86` (thin, ~0.45 opacity).
- **The subject** — drawn hollow with `--card-background-color` fills so overlaps read
  as cut-outs, plus thin inner detail lines at low opacity.
- **Accent/glow** — an inner filled shape (aperture, screen-glow) whose opacity scales
  with brightness/state.

Set `--card-background-color: '#000000'` in each field's `styles` so those hollow fills
stay black even though the *card* is transparent.

---

## 5. Colour palette

| Meaning                       | Hex        |
|-------------------------------|------------|
| Off / neutral (white)         | `#FFFFFF`  |
| Off / idle (dim grey)         | `#6B6E70` · `#D2D2D2` · `#9BA0A3` |
| Returning / muted active      | `#7E8083`  |
| Warm light "on" (base amber)  | `#FFC65C`  |
| Heat                          | `#FF6B35`  |
| Cool / running / info         | `#00A1E4`  |
| Dry / delayed                 | `#26C6DA`  |
| Auto / ready / success        | `#34C759`  |
| Warning / paused / bin-full   | `#FF9F0A`  |
| End-of-cycle / special        | `#B06BFF`  |
| Error / ringing / alert       | `#FF3B30`  |
| Hue-cycle accents (ambilight) | `#FFC65C → #FF6B8A → #B06BFF → #00A1E4 → #26C6DA → #34C759` |

**Dimmable warm light** interpolates a cool-white→warm-amber ramp from `brightness`
(0–255) rather than a fixed hex:

```js
const p = (entity.attributes.brightness || 255) / 255;
return 'rgb(' + Math.round(224 + p*31) + ',' + Math.round(140 + p*100) + ',' + Math.round(30 + p*166) + ')';
```

RGB lights (sofa) prefer the entity's own `rgb_color` when present, falling back to that
ramp — and the glow `drop-shadow` uses the same colour.

Glow is always the icon colour at low alpha: `drop-shadow(0 0 <blur>px rgba(R,G,B,<a>))`,
blur ~8–16 px, alpha ~0.4–0.55, scaling up with brightness/intensity.

---

## 6. Brightness / continuous drive (JS templates)

Continuous values (dimmer brightness) drive colour, stroke weight, detail opacity, inner
glow, halo size, and the `drop-shadow` via per-field `[[[ … ]]]` templates that read
`entity.attributes.brightness`. The light tile exposes CSS vars the SVG consumes:
`--light-color`, `--stroke-main`, `--stroke-fine`, `--fine-op`, `--aperture-op`,
`--halo-op`, `--halo-r`, plus `filter`. Off → white, thin, no glow; brighter → warmer,
heavier stroke, wider brighter halo. Attribute changes re-render the card, so no
`triggers_update` is needed for the entity's own attributes.

---

## 7. State-driven colour + animation

Discrete states use a `state:` block that sets the colour var, flips animation
`--*-play` vars to `running`, reveals layers via `--*-op`, and adds a `filter` glow:

```yaml
state:
  - value: cool
    styles:
      custom_fields:
        mode_graphic:
          - --climate-color: '#00A1E4'
          - --wave-play: running
          - --wave-op: 1
          - filter: drop-shadow(0 0 8px rgba(0, 161, 228, 0.55))
```

Use `operator: template` for derived states (e.g. a linked bin-full sensor), and
`triggers_update:` to re-render when a *related* entity changes (vacuum bin sensor;
washer/dryer time-remaining).

---

## 8. JS-generated SVG (glyph switching + embedded text)

When the icon must change shape or show text, build the **whole SVG in a JS template**
that returns a markup string (alarm, washer, dryer). This lets you:

- swap the centre glyph by state — e.g. a pause bars / hourglass / warning dot, or a
  clock face;
- render live **text inside the SVG** (time-remaining `HH:MM`) with `<text>` +
  `.time-lg` / `.time-sm` classes styled in `extra_styles` (using HA's
  `--paper-font-body1_-_font-family`);
- inline per-state values into the SVG (e.g. `style="--alarm-color:…;--ring-play:…"`).

Guard text sources against `unknown`/`unavailable`/`none` and fall back to `--:--`.

---

## 9. Conditional tiles

Wrap a card in `conditional` to show it only when relevant — keeps the grid clean:

```yaml
- type: conditional
  conditions:
    - condition: state
      entity: sensor.washing_machine_appliance_state
      state_not: Idle
  card:
    type: custom:button-card
    …
```

Used for the TV (only while `remote…` is `on`) and the washer/dryer (only while not
`Idle`).

---

## 10. Interaction summary

| Gesture | Behaviour |
|---------|-----------|
| **Tap** | `haptic: heavy` + 900 Hz click beep, then the action: `hass.callService(...)`, a `pushState` view navigation, or a JS-dispatched more-info. |
| **Hold**| `more-info` on entity tiles; `none` on pure navigation tiles. |

---

## 11. Reference cards in `example-dashboard.yaml`

| Tile (entity) | Pattern it demonstrates |
|---------------|-------------------------|
| Recessed light (`light.lounge_dimmer_2`, `…office_play_room…`) | brightness → colour/stroke/halo/glow via JS-var templates |
| AC (`climate.ac_living_room`) | discrete `state:` colour map + airflow animation + templated on/off |
| Vacuum (`vacuum.wall_e`) | full animation system (spin, particles, dock/return) + bin-full template state |
| Ambilight (`light.ambilight_living_room`) | hue-cycling accent + LED-strip breathe + spill glow |
| TV (`remote.tv_samsung_led65`) | `conditional` on remote state; power-glyph reveal |
| Music (no entity) | `pushState` view navigation; static EQ glyph |
| Alarm (`sensor.view_assist_timer_state`) | JS-generated SVG, ring animation, nav to alarms |
| Sofa (`light.sofa_lights`) | `rgb_color`-aware colour + glow; `turn_on` with `effect` |
| Washer / Dryer (`sensor.*_appliance_state`) | `conditional`; JS SVG with live `HH:MM` text + glyph switching + rich per-state colours |

---

*Style: The Kiwi Smart Home. Transparent canvas · 240-grid line-art · one colour per
state · light means glow · every tap clicks · motion means active.*
