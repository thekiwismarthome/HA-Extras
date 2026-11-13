/*
 * KSH Icon Cards — Kiwi Smart Home
 * Modular "full icon" line-art device cards for Home Assistant.
 * MIT licence — free to use, change and share, forever.
 *
 * Every icon is its own card type, so each one can be dropped on any dashboard:
 *   type: custom:ksh-ceiling-light-card
 *   entity: light.lounge_dimmer_2
 *
 * Or use the generic card and pick the drawing:
 *   type: custom:ksh-icon-card
 *   entity: light.wled_path_to_spa
 *   icon: path-lights
 *
 * Off: thin line art in the theme's text colour. On: the device's own colour,
 * a soft halo, and (where it means something) a thin ring for brightness,
 * battery or progress. Follows the HA theme's light/dark mode.
 * Tap = the device's main action, hold = more-info.
 */
const KSH_ICON_VERSION = '1.0.0';

/* ----------------------------------------------------------------- helpers */
const BAD = new Set(['unknown', 'unavailable', 'none', 'None', '']);
const num = (v) => { if (v === null || v === undefined || BAD.has(String(v))) return null; const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1).replace(/_/g, ' ') : '');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* --------------------------------------------------------------- drawings
 * 100×100 viewBox, stroke = currentColor. Classes:
 *   fil   – the "lit" part (filament, LEDs): faint when off, full when on
 *   wash  – light falling on a surface
 *   glass – a diffuser that fills with colour when on
 *   dot   – solid detail
 */
const CAR_BODY = 'M8 64H13A12 12 0 0 1 37 64H64A12 12 0 0 1 88 64H93Q96 64 96 60V55.5Q96 50.6 91 49Q80 46 68.5 44L57.5 35Q55 32.8 51 32.4L40.5 32.2Q28 33 13.5 41.4Q9 43.2 7 46.4L5.6 52.5V60Q5.6 64 8 64Z';
function wheel(cx) {
  let sp = '';
  for (let i = 0; i < 5; i++) {
    const a = i * 1.2566;
    const p = (r, o = 0) => `${(cx + r * Math.cos(a + o)).toFixed(2)} ${(64 + r * Math.sin(a + o)).toFixed(2)}`;
    sp += `<path d="M${p(2)}Q${p(4.6, 0.5)} ${p(5.8, 0.25)}" stroke-width="1.3"/>`;
  }
  return `<circle cx="${cx}" cy="64" r="9.6"/><circle cx="${cx}" cy="64" r="6.4" stroke-width="1.5"/>${sp}<circle cx="${cx}" cy="64" r="1.3" class="dot"/>`;
}
const CAR = `<path d="${CAR_BODY}"/>`
  + '<path d="M15.5 43.2Q28 36.4 40.6 35.4H50.6Q53.4 35.4 55.4 37.4L62.6 44Q38 43.4 15.5 43.2Z" stroke-width="1.7"/>'
  + '<path d="M42.4 35.6 41.6 43.5" stroke-width="1.5"/><path d="M7.6 50.2Q50 47.6 93 50.8" stroke-width="1.2" opacity=".5"/>'
  + '<path d="M38.5 58.4 63.5 57.6" stroke-width="1.2" opacity=".45"/><path d="M46.5 48.2h5.4" stroke-width="1.7"/>'
  + '<path class="lightbar" d="M85.5 48.2 95.4 51.2"/><path class="tail" d="M6 47.6 12.6 46.2"/>'
  + wheel(25) + wheel(76)
  + '<path d="M10 77h82" stroke-width="1.4" opacity=".28"/>'
  + '<g class="charge"><rect x="10" y="51" width="6" height="5" rx="1.4" stroke-width="1.4"/><path class="bolt" d="M19 22l-5 8h5l-4 8" stroke-width="2.2"/></g>';

const HP_BODY = '<rect x="10" y="20" width="80" height="32" rx="10"/><path d="M20 44h60" opacity=".55"/><circle cx="78" cy="30" r="1.8" class="dot"/>';
const HP_MODES = {
  off: { c: null, label: 'Off', air: '', g: '' },
  heat: { c: '#FF7A45', label: 'Heating', air: '<path class="air" d="M26 58q-4 6 0 12t0 12M74 58q4 6 0 12t0 12"/>', g: '<path class="g" d="M50 60c7 6 10 11 10 16a10 10 0 0 1-20 0c0-4 3-8 6-10 1 3 2 4 4 5 0-4-2-7 0-11Z"/>' },
  cool: { c: '#4CC9FF', label: 'Cooling', air: '<path class="air dash" d="M26 58v24M74 58v24"/>', g: '<path class="g" d="M50 60v32M37 68l26 16M37 84l26-16M46 62l4 4 4-4M46 90l4-4 4 4"/>' },
  dry: { c: '#7BD88F', label: 'Dry', air: '<path class="air" d="M26 58q-3 12 0 24M74 58q3 12 0 24"/>', g: '<path class="g" d="M50 60c6 8 10 13 10 18a10 10 0 0 1-20 0c0-5 4-10 10-18Z"/>' },
  eco: { c: '#7BD88F', label: 'Eco', air: '<path class="air" d="M26 58q-3 12 0 24M74 58q3 12 0 24"/>', g: '<path class="g" d="M38 90c0-16 12-26 26-26 0 16-10 26-26 26ZM38 90l16-14"/>' },
  auto: { c: '#B794FF', label: 'Auto', air: '<path class="air dash" d="M26 58q-4 6 0 12M74 70v12"/>', g: '<path class="g" d="M37 78a13 13 0 0 1 23-8M63 78a13 13 0 0 1-23 8M57 64l3 6-6 1M43 92l-3-6 6-1"/>' },
  fan_only: { c: '#94A3B8', label: 'Fan', air: '<path class="air" d="M26 58q8 10 0 24M74 58q-8 10 0 24"/>', g: '<path class="g" d="M50 77c-4-10 0-16 7-14s3 10-7 14Zm0 0c10-3 15 2 12 8s-11 2-12-8Zm0 0c-8 6-15 4-15-3s9-8 15 3Z"/>' },
};
HP_MODES.heat_cool = HP_MODES.auto;

const ICONS = {
  // ---- lights
  'ceiling-light': { kind: 'light', name: 'Ceiling light', svg: '<path d="M50 14a24 24 0 0 1 14 43.5q-4 3.5-4 9.5H40q0-6-4-9.5A24 24 0 0 1 50 14Z"/><path class="fil" d="M43 40v8M50 36v12M57 40v8M41 48q9 7 18 0"/><path d="M40 74h20M42 81h16M45 88h10"/>' },
  'pendant-light': { kind: 'light', name: 'Pendant light', svg: '<path d="M50 8v18"/><path d="M28 54a22 22 0 0 1 44 0Z"/><path class="fil" d="M44 54a6 6 0 0 0 12 0"/><path class="wash" d="M34 66l-4 8M50 68v10M66 66l4 8"/>' },
  'bedside-lamp': { kind: 'light', name: 'Bedside lamp', svg: '<path class="glass" d="M28 82V22q0-12 12-12h20q12 0 12 12v60Z"/><path d="M22 82h56q0 8-8 8H30q-8 0-8-8Z"/><rect class="fil" x="45" y="44" width="10" height="30" rx="5"/><circle cx="50" cy="36" r="1.8" class="dot"/>' },
  nightlight: { kind: 'light', name: 'Nightlight', svg: '<path class="glass" d="M30 82V52q0-12 12-12h16q12 0 12 12v30Z"/><path d="M24 82h52q0 8-8 8H32q-8 0-8-8Z"/><rect class="fil" x="45.5" y="56" width="9" height="20" rx="4.5"/><path class="fil" d="M60 26a9 9 0 1 1-10-9 7 7 0 0 0 10 9Z"/>' },
  'table-lamp': { kind: 'light', name: 'Table lamp', svg: '<path class="glass" d="M30 22h40l9 30H21Z"/><path d="M50 52v28M36 86h28M40 80h20"/><circle class="fil" cx="50" cy="58" r="5"/>' },
  'floor-lamp': { kind: 'light', name: 'Floor lamp', svg: '<path d="M30 88h22M41 88V40Q41 16 66 16q10 0 14 8"/><path class="glass" d="M70 26h20l-4 12H74Z"/><path class="fil" d="M76 46l-3 8M80 47v9M84 46l3 8"/>' },
  'path-lights': { kind: 'strip', name: 'Path lights', svg: '<path d="M36 94Q46 60 48 24M66 94Q55 60 52 24" opacity=".7"/><rect x="16" y="56" width="9" height="30" rx="2"/><path d="M14 56h13"/><rect class="fil" x="18" y="60" width="5" height="5" rx="1"/><path class="wash" d="M12 92l8-24M30 92l-6-24"/><rect x="74" y="48" width="7" height="24" rx="2"/><path d="M72.5 48h10"/><rect class="fil" x="75.5" y="51" width="4" height="4" rx="1"/><path class="wash" d="M70 78l6-20M86 78l-5-20"/><rect x="30" y="30" width="5" height="16" rx="1.5"/><path d="M29 30h7"/><rect class="fil" x="31" y="32" width="3" height="3" rx=".8"/>' },
  'under-glow': { kind: 'strip', name: 'Under-glow', svg: '<path d="M18 46V36q0-8 8-8h48q8 0 8 8v10"/><path d="M12 48q0-6 6-6t6 6v14h52V48q0-6 6-6t6 6v18H12Z"/><path d="M20 66v6M80 66v6"/><path class="fil" d="M18 78h64"/><path class="wash" d="M16 84h68M24 90h52"/>' },
  'wall-wash': { kind: 'strip', name: 'Wall wash', svg: '<path d="M10 40h80M10 56h80M10 72h80M30 40v16M60 40v16M18 56v16M46 56v16M76 56v16M30 72v16M60 72v16M10 88h80"/><path class="wash" d="M24 88l-8-50M24 88l8-50M76 88l-8-50M76 88l8-50"/><g class="fil"><circle cx="24" cy="88" r="2.6"/><circle cx="76" cy="88" r="2.6"/></g>' },
  'wardrobe-light': { kind: 'strip', name: 'Wardrobe', svg: '<rect x="24" y="12" width="52" height="78" rx="4"/><path d="M50 18v66M45 50v6M55 50v6"/><path class="fil" d="M30 18h40"/><path class="wash" d="M32 22l-4 14M50 22v14M68 22l4 14"/>' },
  'light-bar': { kind: 'strip', name: 'Light bar', svg: '<rect x="10" y="30" width="80" height="10" rx="5"/><g class="fil"><circle cx="22" cy="35" r="1.8"/><circle cx="36" cy="35" r="1.8"/><circle cx="50" cy="35" r="1.8"/><circle cx="64" cy="35" r="1.8"/><circle cx="78" cy="35" r="1.8"/></g><path class="wash" d="M16 48l-6 34M50 48v36M84 48l6 34M33 48l-3 35M67 48l3 35"/>' },
  'led-strip': { kind: 'strip', name: 'LED strip', svg: '<path d="M10 58q10-16 20 0t20 0 20 0 20 0"/><g class="fil"><circle cx="20" cy="51" r="2.2"/><circle cx="40" cy="65" r="2.2"/><circle cx="60" cy="51" r="2.2"/><circle cx="80" cy="65" r="2.2"/></g>' },
  ambilight: { kind: 'light', name: 'Ambilight', color: '#B48CFF', svg: '<rect x="22" y="32" width="56" height="34" rx="4"/><path d="M44 74h12M50 66v8"/><path class="fil" d="M14 30l-6-4M14 49H6M14 68l-6 4M86 30l6-4M86 49h8M86 68l6 4M36 24l-3-7M64 24l3-7"/>' },
  // ---- appliances
  'heat-pump': { kind: 'climate', name: 'Heat pump', svg: '' },
  vacuum: { kind: 'vacuum', name: 'Vacuum', color: '#4BE3A6', svg: '<circle cx="50" cy="52" r="32"/><path d="M27 34a32 32 0 0 1 46 0"/><circle cx="50" cy="36" r="5"/><circle class="fil spin" cx="50" cy="60" r="10"/><path class="fil spin" d="M50 52v-3" />' },
  tv: { kind: 'switch', name: 'TV', color: '#B48CFF', svg: '<rect x="14" y="22" width="72" height="46" rx="5"/><path d="M38 80h24M50 68v12"/><path class="fil" d="M44 38l14 8-14 8Z"/>' },
  washer: { kind: 'appliance', name: 'Washer', color: '#62A8FF', svg: '<rect x="20" y="14" width="60" height="74" rx="9"/><path d="M20 30h60"/><circle cx="30" cy="22" r="2"/><circle cx="50" cy="58" r="20"/><g class="drum"><path class="fil" d="M34 60q8-6 16 0t16 0"/></g>' },
  dryer: { kind: 'appliance', name: 'Dryer', color: '#62A8FF', svg: '<rect x="20" y="14" width="60" height="74" rx="9"/><path d="M20 30h60"/><circle cx="30" cy="22" r="2"/><circle cx="50" cy="58" r="20"/><g class="drum"><path class="fil" d="M50 46a12 12 0 1 1-10 6"/></g>' },
  'ev-car': { kind: 'car', name: 'Car', svg: CAR },
};
// friendly card-picker names → card element names
const CARD_TYPES = {
  'ceiling-light': 'ksh-ceiling-light-card', 'pendant-light': 'ksh-pendant-light-card', 'bedside-lamp': 'ksh-bedside-lamp-card',
  nightlight: 'ksh-nightlight-card', 'table-lamp': 'ksh-table-lamp-card', 'floor-lamp': 'ksh-floor-lamp-card',
  'path-lights': 'ksh-path-lights-card', 'under-glow': 'ksh-under-glow-card', 'wall-wash': 'ksh-wall-wash-card',
  'wardrobe-light': 'ksh-wardrobe-light-card', 'light-bar': 'ksh-light-bar-card', 'led-strip': 'ksh-led-strip-card',
  ambilight: 'ksh-ambilight-card', 'heat-pump': 'ksh-heat-pump-card', vacuum: 'ksh-vacuum-card', tv: 'ksh-tv-card',
  washer: 'ksh-washer-card', dryer: 'ksh-dryer-card', 'ev-car': 'ksh-ev-car-card',
};
const DEFAULT_ICON = { light: 'ceiling-light', climate: 'heat-pump', vacuum: 'vacuum', switch: 'tv', media_player: 'tv', sensor: 'washer', fan: 'heat-pump' };
const WARM = [255, 196, 107];
const IDLE = new Set(['off', 'idle', 'inactive', 'standby', 'docked', 'unavailable', 'unknown', 'none', 'ready', 'paused', 'stopped', 'finished', 'end', 'ended', 'complete', 'completed']);

/* --------------------------------------------------------------------- card */
class KshIconCard extends HTMLElement {
  static get iconKey() { return null; }

  static getConfigForm() {
    const fixed = this.iconKey;
    const k = fixed && ICONS[fixed].kind;
    const extra = [];
    if (k === 'car') extra.push({ name: 'range_entity', selector: { entity: { domain: 'sensor' } } }, { name: 'charging_entity', selector: { entity: {} } });
    if (k === 'vacuum') extra.push({ name: 'battery_entity', selector: { entity: { domain: 'sensor' } } });
    if (k === 'appliance' || !fixed) extra.push({ name: 'remaining_entity', selector: { entity: { domain: 'sensor' } } }, { name: 'progress_entity', selector: { entity: { domain: 'sensor' } } });
    return {
      schema: [
        { name: 'entity', required: true, selector: { entity: {} } },
        { name: 'name', selector: { text: {} } },
        ...(fixed ? [] : [{ name: 'icon', selector: { select: { mode: 'dropdown', options: Object.keys(ICONS).map((v) => ({ value: v, label: ICONS[v].name })) } } }]),
        ...extra,
        {
          type: 'expandable', name: '', flatten: true, title: 'Appearance and actions',
          schema: [
            { name: 'color', selector: { text: {} } },
            { name: 'show_ring', selector: { boolean: {} } },
            { name: 'show_state', selector: { boolean: {} } },
            { name: 'tap_action', selector: { select: { options: ['auto', 'toggle', 'more-info', 'navigate', 'none'] } } },
            { name: 'navigation_path', selector: { text: {} } },
            { name: 'click_sound', selector: { boolean: {} } },
          ],
        },
      ],
      computeLabel: (s) => ({
        entity: 'Entity', name: 'Name (optional)', icon: 'Drawing', range_entity: 'Range sensor', charging_entity: 'Charging sensor',
        battery_entity: 'Battery sensor', remaining_entity: 'Time remaining sensor', progress_entity: 'Progress % sensor',
        color: 'Colour when on (e.g. #FFC46B, blank = automatic)', show_ring: 'Show ring (brightness, battery, progress)',
        show_state: 'Show state text', tap_action: 'Tap action', navigation_path: 'Navigate to (for tap action navigate)', click_sound: 'Click sound',
      }[s.name] || s.name),
    };
  }

  static getStubConfig(hass) {
    const key = this.iconKey;
    const kind = key ? ICONS[key].kind : 'light';
    const dom = { light: 'light', strip: 'light', climate: 'climate', vacuum: 'vacuum', switch: 'switch', appliance: 'sensor', car: 'sensor' }[kind] || 'light';
    const id = hass && Object.keys(hass.states).find((e) => e.startsWith(`${dom}.`));
    return { entity: id || '' };
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setConfig(c) {
    if (!c || !c.entity) throw new Error('Pick an entity');
    const key = this.constructor.iconKey || c.icon || DEFAULT_ICON[c.entity.split('.')[0]] || 'ceiling-light';
    if (!ICONS[key]) throw new Error(`Unknown icon "${key}". Options: ${Object.keys(ICONS).join(', ')}`);
    this._c = { show_ring: true, show_state: true, tap_action: 'auto', click_sound: true, ...c, icon: key };
    this._sig = null;
    if (this._hass) this._render();
  }

  set hass(h) {
    this._hass = h;
    const c = this._c;
    if (!c) return;
    const ids = [c.entity, c.range_entity, c.charging_entity, c.battery_entity, c.remaining_entity, c.progress_entity].filter(Boolean);
    const sig = ids.map((i) => h.states[i]).concat(h.themes && h.themes.darkMode);
    if (this._sig && sig.every((v, i) => v === this._sig[i])) return;
    this._sig = sig;
    this._render();
  }

  getCardSize() { return 3; }
  getGridOptions() { return { columns: 3, rows: 3, min_columns: 2, min_rows: 2 }; }

  connectedCallback() {
    if (this._wired) return;
    this._wired = true;
    const root = this.shadowRoot;
    const clear = () => { clearTimeout(this._holdT); this._holdT = null; root.querySelector('ha-card')?.classList.remove('pressed'); };
    root.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('ha-card')) return;
      clear();
      this._held = false;
      root.querySelector('ha-card').classList.add('pressed');
      this._holdT = setTimeout(() => { this._held = true; clear(); this._haptic(); this._moreInfo(); }, 500);
    });
    root.addEventListener('pointerup', () => {
      const pending = !!this._holdT;
      clear();
      if (pending && !this._held) this._tap();
    });
    root.addEventListener('pointercancel', clear);
    root.addEventListener('pointerleave', clear);
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    root.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._tap(); } });
  }

  /* ------------------------------------------------------------ model */
  _st(id) { return id && this._hass ? this._hass.states[id] : undefined; }

  _model() {
    const c = this._c, key = c.icon, def = ICONS[key];
    const st = this._st(c.entity);
    const m = { svg: def.svg, on: false, na: !st || st.state === 'unavailable', color: null, ring: null, state: '', badge: '', anim: '' };
    m.name = c.name || st?.attributes.friendly_name || def.name;
    if (!st) { m.state = 'Not found'; return m; }
    if (st.state === 'unavailable') { m.state = 'Unavailable'; return m; }
    const a = st.attributes, dom = c.entity.split('.')[0];

    if (def.kind === 'light' || def.kind === 'strip') {
      m.on = st.state === 'on';
      const b = num(a.brightness);
      const p = b === null ? 1 : b / 255;
      if (m.on) {
        let rgb = WARM;
        const colourful = ['hs', 'rgb', 'rgbw', 'rgbww', 'xy'].includes(a.color_mode);
        if (Array.isArray(a.rgb_color) && (colourful || def.kind === 'strip')) rgb = a.rgb_color;
        m.color = c.color || def.color || `rgb(${rgb.join(',')})`;
        m.glow = 0.18 + p * 0.42;
        m.state = b !== null ? `On · ${Math.round(p * 100)}%` : 'On';
        if (b !== null && c.show_ring) m.ring = p;
        if (a.effect && !BAD.has(a.effect) && a.effect !== 'Solid') m.state = cap(a.effect);
      } else m.state = 'Off';
    } else if (def.kind === 'climate') {
      const mode = st.state;
      const preset = String(a.preset_mode || '').toLowerCase();
      const md = (preset === 'eco' && mode !== 'off') ? HP_MODES.eco : HP_MODES[mode] || HP_MODES.auto;
      m.svg = HP_BODY + md.air + md.g;
      m.on = mode !== 'off';
      m.color = m.on ? c.color || md.c : null;
      const tgt = num(a.temperature), cur = num(a.current_temperature);
      const act = a.hvac_action && !['idle', 'off'].includes(a.hvac_action) ? cap(a.hvac_action) : md.label;
      m.state = m.on ? `${act}${tgt !== null ? ` · ${tgt}°` : ''}` : 'Off';
      if (cur !== null) m.badge = `${Math.round(cur * 10) / 10}°`;
      m.anim = m.on ? 'flow' : '';
    } else if (def.kind === 'vacuum') {
      m.on = ['cleaning', 'returning'].includes(st.state);
      m.color = c.color || def.color;
      m.state = cap(a.status || st.state);
      const bat = num(a.battery_level) ?? num(this._st(c.battery_entity)?.state);
      if (bat !== null && c.show_ring) { m.ring = bat / 100; m.ringAlways = true; }
      if (bat !== null) m.state += ` · ${Math.round(bat)}%`;
      m.anim = m.on ? 'spin' : '';
    } else if (def.kind === 'car') {
      // entity = battery % sensor
      const bat = num(st.state);
      const rng = num(this._st(c.range_entity)?.state);
      const chs = this._st(c.charging_entity);
      const charging = chs ? ['on', 'charging', 'true'].includes(String(chs.state).toLowerCase()) : false;
      m.color = c.color || (bat !== null && bat < 10 ? '#FF5A5A' : bat !== null && bat < 20 ? '#FFB347' : '#4ADE80');
      m.on = charging;
      m.charging = charging;
      if (bat !== null && c.show_ring) { m.ring = bat / 100; m.ringAlways = true; }
      m.state = bat === null ? cap(st.state) : charging ? `Charging · ${Math.round(bat)}%` : `${Math.round(bat)}%${rng !== null ? ` · ${Math.round(rng)} km` : ''}`;
      m.tint = true;
    } else if (def.kind === 'appliance') {
      const s = String(st.state);
      const v = num(s);
      m.on = c.active !== undefined ? !!c.active : (v === null && !IDLE.has(s.toLowerCase()));
      m.color = c.color || def.color;
      const rem = this._st(c.remaining_entity);
      const prog = num(this._st(c.progress_entity)?.state);
      m.state = cap(s);
      if (m.on && rem && !BAD.has(rem.state) && !/^0?0:00(:00)?$/.test(rem.state)) m.state = `${rem.state.replace(/:00$/, '')} left`;
      if (prog !== null && c.show_ring) m.ring = prog / 100;
      m.anim = m.on ? 'spin' : '';
    } else {
      // switch / media / anything with on-off
      m.on = ['on', 'playing', 'open', 'heat', 'cool'].includes(st.state);
      m.color = c.color || def.color || '#B48CFF';
      m.state = dom === 'media_player' && m.on ? (a.media_title || 'Playing') : cap(st.state);
    }
    return m;
  }

  /* ------------------------------------------------------------ render */
  _render() {
    if (!this._hass || !this._c) return;
    const m = this._model();
    const dark = this._c.theme ? this._c.theme === 'dark' : !!(this._hass.themes && this._hass.themes.darkMode);
    const R = 46, C = 2 * Math.PI * R;
    const ring = m.ring !== null && m.ring !== undefined && (m.on || m.ringAlways)
      ? `<svg class="ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${R}" class="rt"/><circle cx="50" cy="50" r="${R}" class="ra" stroke-dasharray="${(C * clamp(m.ring, 0, 1)).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 50 50)"/></svg>`
      : '';
    const cls = ['card', m.on ? 'on' : '', m.na ? 'na' : '', m.anim, m.charging ? 'charging' : '', m.tint ? 'tint' : '', dark ? 'dark' : 'light', `k-${ICONS[this._c.icon].kind}`, `i-${this._c.icon}`].filter(Boolean).join(' ');
    this.shadowRoot.innerHTML = `<style>${CSS}</style>
      <ha-card class="${cls}" style="${m.color ? `--c:${m.color};` : ''}${m.glow ? `--glow:${m.glow.toFixed(2)};` : ''}" role="button" tabindex="0"
        aria-label="${esc(m.name)}: ${esc(m.state)}" aria-pressed="${m.on}">
        <div class="ico"><div class="sq"><i class="halo"></i>${ring}
          <svg class="li" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${m.svg}</svg>
          ${m.badge ? `<span class="badge">${esc(m.badge)}</span>` : ''}</div></div>
        <div class="tn">${esc(m.name)}</div>
        ${this._c.show_state ? `<div class="ts">${esc(m.state)}</div>` : ''}
      </ha-card>`;
  }

  /* ------------------------------------------------------------ actions */
  _haptic() { window.dispatchEvent(new CustomEvent('haptic', { detail: 'light' })); }
  _click() {
    this._haptic();
    if (!this._c.click_sound) return;
    try {
      const ctx = window.__haClickCtx || (window.__haClickCtx = new (window.AudioContext || window.webkitAudioContext)());
      if (ctx.state === 'suspended') ctx.resume();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 900;
      g.gain.setValueAtTime(0.35, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
      o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.05);
    } catch (e) { /* no audio */ }
  }
  _moreInfo(id = this._c.entity) {
    const ev = new Event('hass-more-info', { bubbles: true, composed: true });
    ev.detail = { entityId: id };
    this.dispatchEvent(ev);
  }
  _tap() {
    const c = this._c, H = this._hass, st = this._st(c.entity);
    let act = c.tap_action || 'auto';
    if (act === 'none') return;
    this._click();
    if (act === 'more-info') { this._moreInfo(); return; }
    if (act === 'navigate') {
      if (!c.navigation_path) return;
      history.pushState(null, '', c.navigation_path);
      window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
      return;
    }
    if (!st || st.state === 'unavailable') { this._moreInfo(); return; }
    const dom = c.entity.split('.')[0], id = { entity_id: c.entity };
    const kind = ICONS[c.icon].kind;
    if (act === 'auto' && (kind === 'car' || kind === 'appliance' || dom === 'sensor' || dom === 'binary_sensor')) { this._moreInfo(); return; }
    if (dom === 'climate') { H.callService('climate', st.state === 'off' ? 'turn_on' : 'turn_off', id); return; }
    if (dom === 'vacuum') { H.callService('vacuum', ['cleaning', 'returning'].includes(st.state) ? 'pause' : 'start', id); return; }
    if (dom === 'media_player') { H.callService('media_player', st.state === 'off' ? 'turn_on' : 'media_play_pause', id); return; }
    if (dom === 'script' || dom === 'scene') { H.callService(dom, 'turn_on', id); return; }
    if (dom === 'button') { H.callService('button', 'press', id); return; }
    H.callService('homeassistant', 'toggle', id);
  }
}

/* --------------------------------------------------------------------- CSS */
const CSS = `
:host{display:block;height:100%;-webkit-tap-highlight-color:transparent}
ha-card{--off:var(--primary-text-color,#e8eaee);height:100%;min-height:120px;box-sizing:border-box;padding:6px 4px 10px;display:flex;flex-direction:column;align-items:center;
  background:none;border:none;box-shadow:none;cursor:pointer;user-select:none;-webkit-user-select:none;outline:none;overflow:visible;
  transition:transform .18s cubic-bezier(.2,.8,.2,1)}
ha-card:focus-visible .sq{outline:2px solid var(--primary-color,#7CC4FF);outline-offset:4px;border-radius:50%}
ha-card.pressed{transform:scale(.94)}
.ico{flex:1;min-height:0;width:100%;container-type:size;display:flex;align-items:center;justify-content:center}
.sq{position:relative;width:min(100cqw,100cqh);height:min(100cqw,100cqh);display:flex;align-items:center;justify-content:center}
.li{position:relative;width:74%;height:74%;color:var(--off);overflow:visible;transition:color .45s ease,filter .45s ease}
.k-car .li{width:92%;height:92%}
.halo{position:absolute;inset:4%;border-radius:50%;background:radial-gradient(circle,var(--c) 0%,transparent 68%);opacity:0;transition:opacity .6s ease}
.on .halo{opacity:var(--glow,.5)}
.light.on .halo{opacity:calc(var(--glow,.5) * .65)}
.on .li{color:var(--c);filter:drop-shadow(0 0 4px var(--c)) drop-shadow(0 0 14px color-mix(in srgb,var(--c) 55%,transparent))}
.light.on .li{color:color-mix(in srgb,var(--c) 72%,#000);filter:drop-shadow(0 0 4px color-mix(in srgb,var(--c) 60%,transparent))}
.fil,.wash,.air,.g{opacity:.32;transition:opacity .45s}
.on .fil,.on .air,.on .g{opacity:1}
.on .wash{opacity:.7}
.glass{fill:transparent;transition:fill .45s}
.on .glass{fill:color-mix(in srgb,var(--c) 24%,transparent)}
.dot{fill:currentColor}
.na{opacity:.3;cursor:default}
.ring{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.rt{fill:none;stroke:color-mix(in srgb,var(--off) 12%,transparent);stroke-width:1.6}
.ra{fill:none;stroke:var(--c,var(--off));stroke-width:2.6;stroke-linecap:round;transition:stroke-dasharray .6s ease}
.on .ra{filter:drop-shadow(0 0 3px var(--c))}
.tint .ra{stroke:var(--c)}
.light.tint .ra{stroke:color-mix(in srgb,var(--c) 78%,#000)}
.badge{position:absolute;top:6%;right:2%;font-size:clamp(10px,9cqmin,13px);font-weight:600;padding:2px 7px;border-radius:9px;background:color-mix(in srgb,var(--off) 10%,transparent);color:var(--primary-text-color)}
.tn{font-size:var(--ksh-icon-name-size,15px);font-weight:600;line-height:1.2;margin-top:2px;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--primary-text-color)}
.ts{font-size:var(--ksh-icon-state-size,12.5px);line-height:1.3;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--secondary-text-color)}
.on .ts,.tint .ts{color:var(--c)}
.light.on .ts,.light.tint .ts{color:color-mix(in srgb,var(--c) 62%,#000)}
/* car details */
.k-car .tail{stroke:#ff4d5e;stroke-width:2.6}.light.k-car .tail{stroke:#d92638}
.k-car .lightbar{stroke-width:2.6}
.k-car .charge{display:none}.k-car.charging .charge{display:inline;stroke:#FFD54A}
.k-car.charging .bolt{animation:pulse 1.6s ease-in-out infinite}
/* motion (only when the device is doing something) */
.flow .air.dash{stroke-dasharray:4 5;animation:dash 1.4s linear infinite}
.flow .air:not(.dash){stroke-dasharray:6 4;animation:dash 2.2s linear infinite}
.spin .drum{transform-origin:50px 58px;animation:rot 2.4s cubic-bezier(.45,0,.55,1) infinite}
.i-vacuum.spin .spin{transform-origin:50px 60px;animation:rot 3s linear infinite}
.on .halo{animation:breathe 5s ease-in-out infinite}
@keyframes dash{to{stroke-dashoffset:-18}}
@keyframes rot{to{transform:rotate(360deg)}}
@keyframes pulse{50%{opacity:.35}}
@keyframes breathe{50%{transform:scale(1.06)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
`;

/* ----------------------------------------------------------------- register */
if (!customElements.get('ksh-icon-card')) customElements.define('ksh-icon-card', class extends KshIconCard {});
window.customCards = window.customCards || [];
const reg = (type, name, description) => { if (!window.customCards.some((x) => x.type === type)) window.customCards.push({ type, name, description, preview: true, documentationURL: '' }); };
reg('ksh-icon-card', 'KSH · Icon (any device)', 'Full-icon line-art card; choose the drawing');
for (const [key, type] of Object.entries(CARD_TYPES)) {
  if (!customElements.get(type)) customElements.define(type, class extends KshIconCard { static get iconKey() { return key; } });
  reg(type, `KSH · ${ICONS[key].name}`, `Full-icon line-art card for a ${ICONS[key].name.toLowerCase()}`);
}
window.KshIconCards = { version: KSH_ICON_VERSION, icons: Object.keys(ICONS), types: CARD_TYPES };
console.info(`%c KSH ICONS %c v${KSH_ICON_VERSION} · ${Object.keys(CARD_TYPES).length} cards `, 'background:#FFC46B;color:#000;font-weight:700', 'background:#111;color:#fff');
