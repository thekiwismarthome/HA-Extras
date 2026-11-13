/*
 * KSH Weather Cards — Kiwi Smart Home
 * Modular weather cards: add only the ones each screen needs.
 *
 *   ksh-weather-now-card      current conditions, clock, feels-like, chips
 *   ksh-weather-hourly-card   next 24 hours: temperature curve, rain bars, night bands
 *   ksh-weather-daily-card    7-day forecast with temperature range bars
 *   ksh-rain-radar-card       animated rain radar (RainViewer) with full-screen view
 *   ksh-wind-card             compass, speed, gusts, Beaufort
 *   ksh-uv-card               UV gauge with today's peak
 *   ksh-humidity-card         humidity ring and dew point
 *   ksh-pressure-card         barometer dial
 *   ksh-sun-moon-card         sun arc, daylight, moon phase
 *   ksh-tides-card            tide curve (NIWA-style tide sensor)
 *   ksh-air-quality-card      AQI gauge
 *
 * Follows the Home Assistant theme (card background, text colours, light/dark).
 * MIT licence — free to use, change and share, forever.
 */
const KSH_WEATHER_VERSION = '1.0.0';

/* ================================================================ helpers */
const BAD = new Set(['unknown', 'unavailable', 'none', 'None', '']);
const num = (v) => { if (v === null || v === undefined || BAD.has(String(v))) return null; const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const r1 = (n) => Math.round(n * 10) / 10;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1).replace(/_/g, ' ') : '');
const ink = (a) => `color-mix(in srgb, var(--primary-text-color) ${Math.round(a * 100)}%, transparent)`;
const fmtTime = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?([AaPp])\.?\s?[Mm]\.?/, (m, p) => ` ${p.toLowerCase()}m`);
const fmtHour = (d) => d.toLocaleTimeString([], { hour: 'numeric' }).replace(/\s?([AaPp])\.?\s?[Mm]\.?/, (m, p) => `${p.toLowerCase()}m`);
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const dur = (ms) => `${Math.floor(ms / 3600000)}h ${Math.round((ms % 3600000) / 60000)}m`;
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const COMPASS_LONG = { N: 'North', NNE: 'North-northeast', NE: 'Northeast', ENE: 'East-northeast', E: 'East', ESE: 'East-southeast', SE: 'Southeast', SSE: 'South-southeast', S: 'South', SSW: 'South-southwest', SW: 'Southwest', WSW: 'West-southwest', W: 'West', WNW: 'West-northwest', NW: 'Northwest', NNW: 'North-northwest' };
const bearingDeg = (b) => { if (b === null || b === undefined) return null; const s = String(b).trim().toUpperCase(); if (/^-?[\d.]+$/.test(s)) return parseFloat(s); const i = COMPASS.indexOf(s); return i < 0 ? null : i * 22.5; };
const bearingTxt = (d) => COMPASS[Math.round((((d % 360) + 360) % 360) / 22.5) % 16];
const TSTOPS = [[-5, [140, 160, 255]], [5, [110, 196, 255]], [11, [94, 224, 198]], [16, [168, 224, 95]], [21, [255, 205, 70]], [26, [255, 150, 55]], [32, [255, 90, 78]]];
function tColor(t) {
  if (t === null || t === undefined) return '#9aa';
  const rgb = (a) => `rgb(${a.map(Math.round).join(',')})`;
  if (t <= TSTOPS[0][0]) return rgb(TSTOPS[0][1]);
  for (let i = 1; i < TSTOPS.length; i++) {
    const [t1, c1] = TSTOPS[i];
    if (t <= t1) { const [t0, c0] = TSTOPS[i - 1]; const f = (t - t0) / (t1 - t0); return rgb(c0.map((v, k) => v + (c1[k] - v) * f)); }
  }
  return rgb(TSTOPS[TSTOPS.length - 1][1]);
}
const COND = { 'clear-night': 'Clear', cloudy: 'Cloudy', exceptional: 'Severe weather', fog: 'Fog', hail: 'Hail', lightning: 'Thunderstorms', 'lightning-rainy': 'Thunderstorms', partlycloudy: 'Partly cloudy', pouring: 'Heavy rain', rainy: 'Rain', snowy: 'Snow', 'snowy-rainy': 'Sleet', sunny: 'Sunny', windy: 'Windy', 'windy-variant': 'Windy' };
const condLabel = (c, night) => (night && c === 'sunny' ? 'Clear' : COND[c] || cap(c) || '—');
function smoothPath(pts) {
  if (!pts.length) return '';
  let d = `M${r1(pts[0][0])},${r1(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${r1(p1[0] + (p2[0] - p0[0]) / 6)},${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)},${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${r1(p2[0])},${r1(p2[1])}`;
  }
  return d;
}

/* ================================================================== icons */
const CLOUD = 'M-12 12a10 10 0 0 1-1.5-19.9A14 14 0 0 1 13-10a11 11 0 0 1 1 22Z';
function iconSun(x, y, s) {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315].map((r) => `<line x1="0" y1="-17" x2="0" y2="-23" transform="rotate(${r})"/>`).join('');
  return `<g transform="translate(${x} ${y}) scale(${s})"><g class="rays" stroke="#FFC93C" stroke-width="3.4" stroke-linecap="round">${rays}</g><circle r="12.5" fill="url(#k-sun)"/></g>`;
}
const iconMoon = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M5-18A19 19 0 1 0 19 8 15 15 0 0 1 5-18Z" fill="url(#k-moon)"/></g>`;
const iconCloud = (x, y, s, f = 'k-cloud') => `<g transform="translate(${x} ${y}) scale(${s})"><path class="cloud" d="${CLOUD}" fill="url(#${f})"/></g>`;
const drops = (xs, y = 46) => xs.map((x, i) => `<line class="drop" style="animation-delay:${(i * 0.37) % 1.1}s" x1="${x}" y1="${y}" x2="${x - 3}" y2="${y + 8}" stroke="#4FB2F5" stroke-width="3" stroke-linecap="round"/>`).join('');
const flakes = (xs, y = 48) => xs.map((x, i) => `<circle cx="${x}" cy="${y + (i % 2) * 5}" r="2.4" fill="#F4F8FF" stroke="#9fb3cc" stroke-width=".6"/>`).join('');
const BOLT = '<path d="M35 36l-9 13h7l-4 11 13-16h-7l5-8Z" fill="#FFD43B" stroke="#F59F00" stroke-width="1" stroke-linejoin="round"/>';
function iconBody(cond, night) {
  const sky = (x, y, s) => (night ? iconMoon(x, y, s) : iconSun(x, y, s));
  switch (cond) {
    case 'sunny': return sky(32, 32, 1.05);
    case 'clear-night': return iconMoon(32, 32, 1.05);
    case 'partlycloudy': return sky(23, 22, 0.78) + iconCloud(36, 38, 0.82);
    case 'cloudy': return iconCloud(24, 26, 0.62, 'k-cloud2') + iconCloud(35, 38, 0.86);
    case 'rainy': return iconCloud(32, 28, 0.92, 'k-cloud2') + drops([24, 34, 44]);
    case 'pouring': return iconCloud(32, 26, 0.92, 'k-cloudd') + drops([19, 27, 35, 43, 51], 44);
    case 'lightning': return iconCloud(32, 26, 0.92, 'k-cloudd') + BOLT;
    case 'lightning-rainy': return iconCloud(32, 26, 0.92, 'k-cloudd') + BOLT + drops([20, 48], 44);
    case 'snowy': return iconCloud(32, 28, 0.92) + flakes([22, 32, 42]);
    case 'snowy-rainy': return iconCloud(32, 28, 0.92, 'k-cloud2') + drops([22, 42]) + flakes([32]);
    case 'hail': return iconCloud(32, 28, 0.92, 'k-cloud2') + flakes([22, 32, 42], 46);
    case 'fog': return iconCloud(32, 24, 0.82, 'k-cloud2') + '<g stroke="#B9C6D6" stroke-width="3.2" stroke-linecap="round"><line x1="12" y1="44" x2="52" y2="44"/><line x1="18" y1="51" x2="46" y2="51"/><line x1="14" y1="58" x2="38" y2="58"/></g>';
    case 'windy': case 'windy-variant': return '<g fill="none" stroke="#B9C6D6" stroke-width="3.4" stroke-linecap="round"><path d="M8 36h30a6 6 0 1 0-6-6"/><path d="M8 45h40a6 6 0 1 1-6 6"/><path d="M8 54h18"/></g>';
    case 'exceptional': return '<circle cx="32" cy="32" r="22" fill="#FF6B6B"/><rect x="29" y="18" width="6" height="18" rx="3" fill="#fff"/><circle cx="32" cy="44" r="3.5" fill="#fff"/>';
    default: return iconCloud(32, 32, 0.95);
  }
}
const wicon = (cond, night = false, anim = false) => `<svg class="wi${anim ? ' anim' : ''}" viewBox="0 0 64 64" aria-hidden="true">${iconBody(cond, night)}</svg>`;
const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<radialGradient id="k-sun" cx="38%" cy="35%" r="70%"><stop offset="0" stop-color="#FFEB85"/><stop offset="1" stop-color="#FF9F1C"/></radialGradient>
<linearGradient id="k-moon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFBE3"/><stop offset="1" stop-color="#D8CEA0"/></linearGradient>
<linearGradient id="k-cloud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#D3DCE8"/></linearGradient>
<linearGradient id="k-cloud2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D2DAE5"/><stop offset="1" stop-color="#A1AEBF"/></linearGradient>
<linearGradient id="k-cloudd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#AEB9C9"/><stop offset="1" stop-color="#6F7C8F"/></linearGradient>
<linearGradient id="k-uv" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4ADE80"/><stop offset=".3" stop-color="#FACC15"/><stop offset=".55" stop-color="#FB923C"/><stop offset=".78" stop-color="#F43F5E"/><stop offset="1" stop-color="#A855F7"/></linearGradient>
<linearGradient id="k-aqi" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#22C55E"/><stop offset=".25" stop-color="#EAB308"/><stop offset=".45" stop-color="#F97316"/><stop offset=".65" stop-color="#EF4444"/><stop offset="1" stop-color="#7E22CE"/></linearGradient>
<linearGradient id="k-hum" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9BE7FF"/><stop offset="1" stop-color="#3B82F6"/></linearGradient>
<linearGradient id="k-press" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7DD3FC"/><stop offset=".5" stop-color="#C4B5FD"/><stop offset="1" stop-color="#FDBA74"/></linearGradient>
<linearGradient id="k-tide" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#38B6FF" stop-opacity=".5"/><stop offset="1" stop-color="#38B6FF" stop-opacity="0"/></linearGradient>
<radialGradient id="k-sunglow"><stop offset="0" stop-color="#FFD66B" stop-opacity=".9"/><stop offset="1" stop-color="#FFD66B" stop-opacity="0"/></radialGradient>
</defs></svg>`;
function moonInfo(date, southern) {
  const syn = 29.530588853;
  let age = ((date - Date.UTC(2000, 0, 6, 18, 14)) / 86400000) % syn;
  if (age < 0) age += syn;
  const f = age / syn;
  const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  return { f, illum: (1 - Math.cos(2 * Math.PI * f)) / 2, name: names[Math.floor(f * 8 + 0.5) % 8], southern };
}
function moonSvg(m, size) {
  const r = 15, c = 17, k = Math.cos(2 * Math.PI * m.f);
  const lit = `M${c} ${c - r}A${r} ${r} 0 0 1 ${c} ${c + r}A${r * Math.abs(k)} ${r} 0 0 ${k > 0 ? 0 : 1} ${c} ${c - r}Z`;
  let flip = m.f > 0.5;
  if (m.southern) flip = !flip;
  return `<svg viewBox="0 0 34 34" width="${size}" height="${size}" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${r}" style="fill:${ink(0.14)};stroke:${ink(0.2)}"/><path d="${lit}" fill="url(#k-moon)" ${flip ? 'transform="translate(34 0) scale(-1 1)"' : ''}/></svg>`;
}

/* =============================================================== base card */
const ENT = (domain) => ({ entity: domain ? { domain } : {} });
const LABELS = {
  entity: 'Entity', detail_entity: 'Second weather entity (dew point, UV, cloud)', feels_like_entity: 'Feels-like sensor', aqi_entity: 'Air quality sensor',
  warnings_entity: 'Warnings sensor', gust_entity: 'Wind gust sensor', uv_entity: 'UV sensor (optional)', peak_entity: 'UV peak / forecast sensor',
  title: 'Title (optional)', show_clock: 'Show clock', show_chips: 'Show rain, air and warning chips', hours: 'Hours to show', days: 'Days to show',
  zoom: 'Map zoom (4–11)', latitude: 'Latitude (blank = home)', longitude: 'Longitude (blank = home)', frames: 'Radar frames to animate', show_fullscreen: 'Show full-screen button',
  sun_entity: 'Sun entity', transparent: 'Transparent background',
};

class KshWeatherBase extends HTMLElement {
  static get defaults() { return {}; }
  static get schema() { return [{ name: 'entity', required: true, selector: ENT('weather') }]; }
  static get grid() { return { columns: 6, rows: 4, min_columns: 3, min_rows: 2 }; }
  static getConfigForm() {
    return {
      schema: [...this.schema, { type: 'expandable', name: '', flatten: true, title: 'Appearance', schema: [{ name: 'title', selector: { text: {} } }, { name: 'transparent', selector: { boolean: {} } }] }],
      computeLabel: (s) => LABELS[s.name] || cap(s.name),
    };
  }
  static getStubConfig(hass) {
    const first = (d) => hass && Object.keys(hass.states).find((e) => e.startsWith(`${d}.`));
    const s = this.schema[0];
    const dom = s.selector.entity && s.selector.entity.domain;
    return { [s.name]: (dom && first(dom)) || '' };
  }

  constructor() { super(); this.attachShadow({ mode: 'open' }); this._fc = {}; this._subs = {}; }
  setConfig(c) {
    this._c = { ...this.constructor.defaults, ...(c || {}) };
    this._validate && this._validate();
    this._sig = null;
    if (this._hass) this._render();
  }
  getGridOptions() { return this.constructor.grid; }
  getCardSize() { return this.constructor.grid.rows; }

  set hass(h) {
    this._hass = h;
    if (!this._c) return;
    this._subscribe();
    const sig = this._ids().map((i) => h.states[i]).concat(h.themes && h.themes.darkMode);
    if (this._sig && sig.every((v, i) => v === this._sig[i])) return;
    this._sig = sig;
    this._render();
  }
  _ids() { return [this._c.entity, this._c.sun_entity || 'sun.sun']; }

  connectedCallback() {
    this._ro = new ResizeObserver(() => {
      const w = Math.round(this.clientWidth), h = Math.round(this.clientHeight);
      if (!w) return;
      if (w !== this._w || Math.abs(h - (this._h || 0)) > 2) { this._w = w; this._h = h; if (this._hass && this._c) this._render(); }
    });
    this._ro.observe(this);
    this._tick = setInterval(() => this._hass && this._render(), 60000);
    this._subscribe();
  }
  disconnectedCallback() {
    this._ro && this._ro.disconnect();
    clearInterval(this._tick);
    for (const k of Object.keys(this._subs)) Promise.resolve(this._subs[k]).then((u) => typeof u === 'function' && u()).catch(() => {});
    this._subs = {};
  }

  /* forecasts */
  get _needs() { return []; }
  _subscribe() {
    const h = this._hass, id = this._c && this._c.entity;
    if (!h || !id || !h.connection || !this.isConnected) return;
    const st = h.states[id];
    if (!st) return;
    for (const type of this._needs) {
      if (Array.isArray(st.attributes[`forecast_${type}`])) continue;
      const key = `${id}:${type}`;
      if (this._subs[key]) continue;
      this._subs[key] = h.connection.subscribeMessage((m) => { this._fc[type] = m.forecast || []; this._render(); },
        { type: 'weather/subscribe_forecast', forecast_type: type, entity_id: id }).catch(() => {});
    }
  }
  _forecast(type) {
    const st = this._st(this._c.entity);
    const a = st && st.attributes[`forecast_${type}`];
    return (Array.isArray(a) ? a : this._fc[type] || []).map((f) => ({ ...f, t: new Date(f.datetime) }));
  }

  _st(id) { return id && this._hass ? this._hass.states[id] : undefined; }
  get _dark() { return !!(this._hass && this._hass.themes && this._hass.themes.darkMode); }
  _sunTimes() {
    const sun = this._st(this._c.sun_entity || 'sun.sun');
    if (!sun) return null;
    let rise = new Date(sun.attributes.next_rising);
    const set = new Date(sun.attributes.next_setting);
    if (isNaN(rise) || isNaN(set)) return null;
    if (rise > set) rise = new Date(rise - 86400000);
    return { rise, set, up: sun.state === 'above_horizon' };
  }
  _isNightAt(t, s) {
    if (!s) return false;
    let last = null;
    for (let k = -2; k <= 3; k++) for (const [ev, type] of [[+s.rise + k * 86400000, 'rise'], [+s.set + k * 86400000, 'set']]) if (ev <= +t && (!last || ev > last[0])) last = [ev, type];
    return last ? last[1] === 'set' : false;
  }
  _head(title, right = '') {
    const t = this._c.title ?? title;
    return t || right ? `<div class="ph"><span>${esc(t || '')}</span>${right ? `<span class="phr">${right}</span>` : ''}</div>` : '';
  }
  _render() {
    if (!this._hass || !this._c) return;
    const body = this._st(this._c.entity) || !this._c.entity ? this._body() : `<div class="empty">Entity not found: ${esc(this._c.entity)}</div>`;
    this.shadowRoot.innerHTML = `<style>${BASE_CSS}${this.constructor.css || ''}</style>
      <ha-card class="${this._c.transparent ? 'transparent' : ''} ${this._dark ? 'dark' : 'light'}">${DEFS}${body}</ha-card>`;
    if (!this._w && this.clientWidth) { this._w = this.clientWidth; this._h = this.clientHeight; this._render(); }
  }
  _tile(title, right, body) { return `${this._head(title, right)}<div class="tb">${body}</div>`; }
}

/* ======================================================= weather now card */
class KshWeatherNowCard extends KshWeatherBase {
  static get defaults() { return { show_clock: true, show_chips: true }; }
  static get schema() {
    return [{ name: 'entity', required: true, selector: ENT('weather') }, { name: 'detail_entity', selector: ENT('weather') }, { name: 'feels_like_entity', selector: ENT('sensor') },
      { name: 'aqi_entity', selector: ENT('sensor') }, { name: 'warnings_entity', selector: ENT('sensor') }, { name: 'show_clock', selector: { boolean: {} } }, { name: 'show_chips', selector: { boolean: {} } }];
  }
  static get grid() { return { columns: 6, rows: 5, min_columns: 4, min_rows: 3 }; }
  get _needs() { return ['hourly', 'daily']; }
  _ids() { const c = this._c; return [c.entity, c.detail_entity, c.feels_like_entity, c.aqi_entity, c.warnings_entity, c.sun_entity || 'sun.sun']; }
  connectedCallback() { super.connectedCallback(); this._clockT = setInterval(() => { const el = this.shadowRoot.querySelector('.clock'); if (el) el.innerHTML = this._clock(); }, 10000); }
  disconnectedCallback() { super.disconnectedCallback(); clearInterval(this._clockT); }
  _clock() { const t = fmtTime(new Date()); const m = t.match(/^(.*?)\s([ap]m)$/); return m ? `${esc(m[1])}<span class="ampm">${m[2]}</span>` : esc(t); }
  _body() {
    const c = this._c, w = this._st(c.entity), a = w.attributes, now = new Date();
    const sunT = this._sunTimes(), night = sunT ? !sunT.up : false;
    const temp = num(a.temperature), fl = num(this._st(c.feels_like_entity)?.state) ?? num(a.apparent_temperature);
    const daily = this._forecast('daily');
    const td = daily.find((d) => sameDay(d.t, now)) || daily[0];
    const hi = td ? num(td.temperature) : null, lo = td ? num(td.templow) : null;
    const sub = [];
    if (fl !== null) sub.push(`Feels like ${Math.round(fl)}°`);
    if (hi !== null) sub.push(`H ${Math.round(hi)}°`);
    if (lo !== null) sub.push(`L ${Math.round(lo)}°`);
    const chips = [];
    if (c.show_chips) {
      const wn = this._st(c.warnings_entity);
      if (wn && !BAD.has(String(wn.state)) && !/^(0|no|false|off|clear)$/i.test(wn.state)) chips.push(`<span class="chip warn">⚠&#xFE0E; ${esc(String(wn.state).slice(0, 34))}</span>`);
      const hourly = this._forecast('hourly').filter((x) => +x.t >= +now - 3600000).slice(0, 24);
      if (hourly.length) {
        const rain = hourly.reduce((s, x) => s + (num(x.precipitation) || 0), 0);
        chips.push(`<span class="chip"><svg viewBox="0 0 24 24" class="gl"><path fill="#3FA9F5" d="M12 2.7s-6 6.6-6 11.1a6 6 0 0 0 12 0c0-4.5-6-11.1-6-11.1Z"/></svg>${rain >= 0.1 ? `${r1(rain)} ${esc(a.precipitation_unit || 'mm')} next 24h` : 'No rain next 24h'}</span>`);
      }
      const aq = num(this._st(c.aqi_entity)?.state);
      if (aq !== null) {
        const [lbl, col] = aq <= 50 ? ['Good', '#22C55E'] : aq <= 100 ? ['Moderate', '#EAB308'] : aq <= 150 ? ['Sensitive', '#F97316'] : aq <= 200 ? ['Unhealthy', '#EF4444'] : ['Very unhealthy', '#A855F7'];
        chips.push(`<span class="chip"><i class="dot" style="background:${col}"></i>Air ${Math.round(aq)} · ${lbl}</span>`);
      }
    }
    const title = c.title || this._hass.config.location_name || '';
    return `<div class="top"><div><div class="loc">${esc(title)}</div><div class="date">${esc(now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }))}</div></div>
        ${c.show_clock ? `<div class="clock">${this._clock()}</div>` : ''}</div>
      <div class="main"><div class="bigicon">${wicon(w.state, night, true)}</div>
        <div class="txt"><div class="temp">${temp === null ? '—' : Math.round(temp)}<span class="deg">°</span></div>
        <div class="cond">${esc(condLabel(w.state, night))}</div><div class="sub">${sub.join('<span class="sep">·</span>')}</div></div></div>
      ${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}`;
  }
  static get css() {
    return `ha-card{container-type:inline-size;justify-content:space-between}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
.loc{font-size:clamp(15px,4.4cqw,19px);font-weight:600}.date{font-size:clamp(12px,3.4cqw,14px);color:var(--secondary-text-color);margin-top:2px}
.clock{font-size:clamp(24px,8cqw,38px);font-weight:300;letter-spacing:-.02em;line-height:1;white-space:nowrap}.ampm{font-size:.4em;font-weight:500;margin-left:3px;color:var(--secondary-text-color)}
.main{display:flex;align-items:center;gap:4px;flex:1;min-height:0}
.bigicon{width:clamp(70px,34cqw,150px);aspect-ratio:1;flex:none;margin-left:-8px}.bigicon .wi{width:100%;height:100%}
.txt{min-width:0}.temp{font-size:clamp(48px,24cqw,104px);font-weight:200;line-height:.95;letter-spacing:-.04em}.deg{font-size:.6em;vertical-align:top;line-height:1.2}
.cond{font-size:clamp(16px,5cqw,22px);font-weight:500}.sub{font-size:clamp(12px,3.4cqw,14.5px);color:var(--secondary-text-color);margin-top:3px}
.chips{display:flex;flex-wrap:wrap;gap:8px}`;
  }
}

/* ===================================================== weather hourly card */
class KshWeatherHourlyCard extends KshWeatherBase {
  static get defaults() { return { hours: 24 }; }
  static get schema() { return [{ name: 'entity', required: true, selector: ENT('weather') }, { name: 'hours', selector: { number: { min: 6, max: 48, mode: 'box' } } }]; }
  static get grid() { return { columns: 12, rows: 4, min_columns: 6, min_rows: 3 }; }
  get _needs() { return ['hourly']; }
  _body() {
    const now = new Date();
    const hours = this._forecast('hourly').filter((x) => +x.t >= +now - 59 * 60000).slice(0, Number(this._c.hours) || 24);
    const W = Math.max(240, (this._w || 600) - 36);
    const H = Math.max(170, (this._h ? this._h - 66 : 230));
    if (hours.length < 2) return `${this._head('Next 24 hours')}<div class="empty">Hourly forecast unavailable</div>`;
    const sunT = this._sunTimes();
    const temps = hours.map((h) => num(h.temperature)), valid = temps.filter((t) => t !== null);
    const tMin = Math.min(...valid), tMax = Math.max(...valid), iMax = temps.indexOf(tMax), iMin = temps.indexOf(tMin);
    const N = hours.length, padX = 20, step = (W - padX * 2) / (N - 1), X = (i) => padX + i * step;
    const yTop = H * 0.4, yBot = H * 0.72, span = Math.max(tMax - tMin, 4), mid = (tMax + tMin) / 2;
    const Y = (t) => yBot - ((t - (mid - span / 2)) / span) * (yBot - yTop);
    const pts = hours.map((h, i) => [X(i), Y(temps[i] ?? mid)]);
    const line = smoothPath(pts);
    const every = Math.max(1, Math.ceil(64 / step));
    const stops = hours.map((h, i) => `<stop offset="${r1((i / (N - 1)) * 100)}%" stop-color="${tColor(temps[i])}"/>`).join('');
    let bands = '', start = null;
    hours.forEach((h, i) => {
      const n = this._isNightAt(h.t, sunT);
      if (n && start === null) start = i;
      if ((!n || i === N - 1) && start !== null) {
        const end = n ? i : i - 1, x0 = Math.max(0, X(start) - step / 2), x1 = Math.min(W, X(end) + step / 2);
        bands += `<rect x="${r1(x0)}" y="2" width="${r1(Math.max(0, x1 - x0))}" height="${H - 4}" rx="12" style="fill:${ink(this._dark ? 0.05 : 0.05)}"/>`;
        start = null;
      }
    });
    const precip = hours.map((h) => num(h.precipitation) || 0), pMax = Math.max(2, ...precip), iP = precip.indexOf(Math.max(...precip));
    const base = H - 4, barH = H * 0.15;
    let bars = '';
    precip.forEach((p, i) => {
      const hg = p > 0 ? Math.max(3, (p / pMax) * barH) : 0;
      bars += hg ? `<rect x="${r1(X(i) - 4.5)}" y="${r1(base - hg)}" width="9" height="${r1(hg)}" rx="3" fill="#3FA9F5" opacity=".85"/>` : `<rect x="${r1(X(i) - 1.5)}" y="${base - 3}" width="3" height="3" rx="1.5" style="fill:${ink(0.2)}"/>`;
      if (p >= 0.1 && (i % every === 0 || i === iP)) bars += `<text x="${r1(X(i))}" y="${r1(base - hg - 5)}" class="pl">${p < 10 ? r1(p) : Math.round(p)}</text>`;
    });
    const icon = Math.min(36, H * 0.16);
    let labels = '';
    hours.forEach((h, i) => {
      const t = temps[i], lbl = i % every === 0, ext = (i === iMax || i === iMin) && !lbl;
      if (lbl) {
        labels += `<text x="${r1(X(i))}" y="15" class="hl${i === 0 ? ' now' : ''}">${i === 0 ? 'Now' : esc(fmtHour(h.t))}</text>`;
        labels += `<svg x="${r1(X(i) - icon / 2)}" y="22" width="${icon}" height="${icon}" viewBox="0 0 64 64">${iconBody(h.condition, this._isNightAt(h.t, sunT))}</svg>`;
      }
      if ((lbl || ext) && t !== null) {
        labels += `<text x="${r1(X(i))}" y="${r1(pts[i][1] - 10)}" class="tl">${Math.round(t)}°</text>`;
        labels += i === 0 ? `<circle cx="${r1(X(i))}" cy="${r1(pts[i][1])}" r="5" style="fill:var(--primary-text-color);stroke:${ink(0.3)}" stroke-width="6"/>` : `<circle cx="${r1(X(i))}" cy="${r1(pts[i][1])}" r="3.2" fill="${tColor(t)}"/>`;
      }
    });
    const at = (i) => (i === 0 ? 'now' : `at ${esc(fmtHour(hours[i].t))}`);
    const right = W > 420 ? `High ${Math.round(tMax)}° ${at(iMax)}<span class="sep">·</span>Low ${Math.round(tMin)}° ${at(iMin)}` : '';
    const area = `${line} L${r1(X(N - 1))},${H} L${r1(X(0))},${H} Z`;
    return `${this._head(`Next ${N} hours`, right)}
      <svg class="chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
        <defs><linearGradient id="hcl" gradientUnits="userSpaceOnUse" x1="${X(0)}" y1="0" x2="${X(N - 1)}" y2="0">${stops}</linearGradient>
        <linearGradient id="hcf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--primary-text-color);stop-opacity:.12"/><stop offset="1" style="stop-color:var(--primary-text-color);stop-opacity:0"/></linearGradient></defs>
        ${bands}<line x1="0" x2="${W}" y1="${base + 0.5}" y2="${base + 0.5}" style="stroke:${ink(0.08)}"/>
        <path d="${area}" fill="url(#hcf)"/><path d="${line}" fill="none" stroke="url(#hcl)" stroke-width="3.5" stroke-linecap="round"/>
        ${bars}${precip.some((p) => p > 0) ? '' : `<text x="${W / 2}" y="${base - 8}" class="norain">No rain expected</text>`}${labels}</svg>`;
  }
  static get css() {
    return `.chart{display:block;overflow:visible}.chart text{fill:var(--primary-text-color);text-anchor:middle;font-family:inherit}
.chart .hl{font-size:13px;fill:var(--secondary-text-color);font-weight:500}.chart .hl.now{fill:var(--primary-text-color);font-weight:700}
.chart .tl{font-size:14.5px;font-weight:600}.chart .pl{font-size:11px;fill:#3FA9F5;font-weight:600}.chart .norain{font-size:12px;fill:var(--secondary-text-color);opacity:.7}`;
  }
}

/* ====================================================== weather daily card */
class KshWeatherDailyCard extends KshWeatherBase {
  static get defaults() { return { days: 7 }; }
  static get schema() { return [{ name: 'entity', required: true, selector: ENT('weather') }, { name: 'days', selector: { number: { min: 3, max: 10, mode: 'box' } } }]; }
  static get grid() { return { columns: 6, rows: 6, min_columns: 4, min_rows: 3 }; }
  get _needs() { return ['daily']; }
  _body() {
    const now = new Date();
    const days = this._forecast('daily').slice(0, Number(this._c.days) || 7);
    if (!days.length) return `${this._head('7-day forecast')}<div class="empty">Daily forecast unavailable</div>`;
    const lows = days.map((d) => num(d.templow)).filter((v) => v !== null), highs = days.map((d) => num(d.temperature)).filter((v) => v !== null);
    const wMin = Math.min(...lows, ...highs), wMax = Math.max(...lows, ...highs), span = Math.max(1, wMax - wMin);
    const cur = num(this._st(this._c.entity).attributes.temperature);
    const rows = days.map((d) => {
      const hi = num(d.temperature), lo = num(d.templow), today = sameDay(d.t, now);
      const left = lo === null ? 0 : ((lo - wMin) / span) * 100, width = lo === null || hi === null ? 0 : Math.max(4, ((hi - lo) / span) * 100);
      const p = num(d.precipitation), pp = num(d.precipitation_probability);
      const rain = pp !== null && pp >= 10 ? `${Math.round(pp)}%` : p !== null && p >= 0.5 ? `${p < 10 ? r1(p) : Math.round(p)}mm` : '';
      const dot = today && cur !== null && lo !== null ? `<i class="cur" style="left:${clamp(((cur - wMin) / span) * 100, 0, 100)}%"></i>` : '';
      return `<div class="dr"><div class="dn">${today ? 'Today' : esc(d.t.toLocaleDateString([], { weekday: 'short' }))}<small>${esc(d.t.toLocaleDateString([], { day: 'numeric', month: 'short' }))}</small></div>
        <div class="di">${wicon(d.condition)}</div><div class="rn">${rain}</div><div class="lo">${lo === null ? '' : `${Math.round(lo)}°`}</div>
        <div class="tr"><i class="rg" style="left:${left}%;width:${width}%;background:linear-gradient(90deg,${tColor(lo)},${tColor(hi)})"></i>${dot}</div>
        <div class="hi">${hi === null ? '' : `${Math.round(hi)}°`}</div></div>`;
    }).join('');
    return `${this._head(`${days.length}-day forecast`)}<div class="rows">${rows}</div>`;
  }
  static get css() {
    return `ha-card{container-type:inline-size}.rows{flex:1;display:flex;flex-direction:column;justify-content:space-between;min-height:0}
.dr{display:grid;grid-template-columns:58px 34px 38px 30px minmax(0,1fr) 32px;gap:8px;align-items:center;flex:1;min-height:36px;border-top:1px solid ${ink(0.07)}}
.dr:first-child{border-top:none}
@container (max-width:330px){.dr{grid-template-columns:50px 30px 30px minmax(0,1fr) 30px}.rn{display:none}}
.dn{font-size:15px;font-weight:600;display:flex;flex-direction:column;line-height:1.1}.dn small{font-size:11px;font-weight:400;color:var(--secondary-text-color);margin-top:2px}
.di .wi{width:32px;height:32px;display:block}.rn{font-size:12px;color:#3FA9F5;font-weight:600;text-align:center}
.lo{font-size:15px;color:var(--secondary-text-color);text-align:right}.hi{font-size:15px;font-weight:600}
.tr{position:relative;height:6px;border-radius:3px;background:${ink(0.1)}}.rg{position:absolute;top:0;bottom:0;border-radius:3px}
.cur{position:absolute;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:var(--primary-text-color);box-shadow:0 0 0 3px var(--ha-card-background,var(--card-background-color,#000))}`;
  }
}

/* ========================================================= rain radar card */
const RADAR_SRC = { data: null, ts: 0, p: null };
function radarData() {
  if (RADAR_SRC.data && Date.now() - RADAR_SRC.ts < 4 * 60000) return Promise.resolve(RADAR_SRC.data);
  if (!RADAR_SRC.p) {
    RADAR_SRC.p = fetch('https://api.rainviewer.com/public/weather-maps.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((d) => { RADAR_SRC.data = d; RADAR_SRC.ts = Date.now(); RADAR_SRC.p = null; return d; })
      .catch((e) => { RADAR_SRC.p = null; throw e; });
  }
  return RADAR_SRC.p;
}
const BASEMAP = (dark, kind, z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${dark ? 'Dark' : 'Light'}_Gray_${kind}/MapServer/tile/${z}/${y}/${x}`;
const GL = {
  plus: '<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/>', minus: '<rect x="5" y="11" width="14" height="2" rx="1"/>',
  play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/>', pause: '<rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/>',
  expand: '<path d="M4 4h6v2H6v4H4V4Zm10 0h6v6h-2V6h-4V4ZM4 14h2v4h4v2H4v-6Zm14 4v-4h2v6h-6v-2h4Z"/>', close: '<path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4L12 13.4 6.4 19 5 17.6 10.6 12 5 6.4 6.4 5Z"/>',
};
const gl = (n) => `<svg class="g" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${GL[n]}</svg>`;
class RadarMap {
  constructor(host, o) {
    Object.assign(this, { host, o, zoom: o.zoom, dark: o.dark, idx: -1, playing: true, hold: 0 });
    host.innerHTML = `<div class="rm"><div class="rl base"></div><div class="rl radar"></div><div class="rl lab"></div><div class="home"><i></i></div>
      <div class="zoom"><button data-z="1" aria-label="Zoom in">${gl('plus')}</button><button data-z="-1" aria-label="Zoom out">${gl('minus')}</button></div>
      <div class="bar"><button class="pp" aria-label="Play or pause">${gl('pause')}</button><div class="track"></div><span class="time">Loading radar…</span></div>
      <div class="attr">Radar: RainViewer · Map: Esri, HERE, Garmin, © OpenStreetMap</div></div>`;
    this.el = host.firstElementChild;
    this.$ = (s) => this.el.querySelector(s);
    this.el.addEventListener('error', (e) => {
      if (e.target.tagName !== 'IMG') return;
      e.target.style.visibility = 'hidden';
      if (!this._retry && /rainviewer/.test(e.target.src)) this._retry = setTimeout(() => { this._retry = null; this.draw(); }, 65000);
    }, true);
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('button,[data-fi]');
      if (!b) return;
      e.stopPropagation();
      if (b.dataset.z) this.setZoom(this.zoom + Number(b.dataset.z));
      else if (b.classList.contains('pp')) (this.playing ? this.pause() : this.start());
      else if (b.dataset.fi) { this.pause(); this.show(Number(b.dataset.fi)); }
    });
    this.refresh();
    this._rt = setInterval(() => this.refresh(), 5 * 60000);
    this.start();
  }
  async refresh() {
    try {
      const d = await radarData();
      const past = ((d.radar && d.radar.past) || []).slice(-(this.o.frames || 8)), fut = (d.radar && d.radar.nowcast) || [];
      const key = past.concat(fut).map((f) => f.path).join();
      if (key === this._key) return;
      Object.assign(this, { _key: key, frames: past.concat(fut), nPast: past.length, src: d.host, idx: -1 });
      this.draw();
    } catch (e) { this.$('.time').textContent = 'Radar unavailable'; }
  }
  setDark(d) { if (d !== this.dark) { this.dark = d; this.draw(); } }
  setZoom(z) { this.zoom = clamp(z, 4, 11); this.draw(); }
  draw() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    const Z = this.zoom, TS = 256, world = TS * 2 ** Z, la = (clamp(this.o.lat, -85, 85) * Math.PI) / 180;
    const cx = ((this.o.lon + 180) / 360) * world, cy = ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * world;
    const x0 = cx - w / 2, y0 = cy - h / 2;
    const tiles = (size, z, url) => {
      const n = 2 ** z;
      let s = '';
      for (let ty = Math.floor(y0 / size); ty <= Math.floor((y0 + h) / size); ty++) {
        if (ty < 0 || ty >= n) continue;
        for (let tx = Math.floor(x0 / size); tx <= Math.floor((x0 + w) / size); tx++) s += `<img src="${url(z, ((tx % n) + n) % n, ty)}" style="left:${Math.round(tx * size - x0)}px;top:${Math.round(ty * size - y0)}px;width:${size}px;height:${size}px" alt="" draggable="false">`;
      }
      return s;
    };
    this.$('.base').innerHTML = tiles(TS, Z, (z, x, y) => BASEMAP(this.dark, 'Base', z, x, y));
    this.$('.lab').innerHTML = tiles(TS, Z, (z, x, y) => BASEMAP(this.dark, 'Reference', z, x, y));
    this.el.classList.toggle('light', !this.dark);
    if (!this.frames || !this.frames.length) return;
    const Zr = Math.min(Z, 7), RS = TS * 2 ** (Z - Zr);
    this.$('.radar').innerHTML = this.frames.map((f, i) => `<div class="fr" data-i="${i}">${tiles(RS, Zr, (z, x, y) => `${this.src}${f.path}/256/${z}/${x}/${y}/2/1_1.png`)}</div>`).join('');
    this.$('.track').innerHTML = this.frames.map((f, i) => `<i data-fi="${i}" class="${i >= this.nPast ? 'fut' : ''}"></i>`).join('');
    this.show(this.idx < 0 ? this.nPast - 1 : Math.min(this.idx, this.frames.length - 1));
  }
  show(i) {
    if (!this.frames || !this.frames.length) return;
    this.idx = i;
    this.el.querySelectorAll('.fr').forEach((f) => f.classList.toggle('on', Number(f.dataset.i) === i));
    this.el.querySelectorAll('.track i').forEach((t, k) => { t.classList.toggle('on', k === i); t.classList.toggle('past', k < i); });
    const f = this.frames[i], t = fmtTime(new Date(f.time * 1000)), ago = Math.round((Date.now() - f.time * 1000) / 60000);
    this.$('.time').textContent = i >= this.nPast ? `${t} · forecast` : i === this.nPast - 1 ? `${t} · latest` : `${t} · ${ago} min ago`;
  }
  start() {
    this.playing = true;
    this.$('.pp').innerHTML = gl('pause');
    clearInterval(this._at);
    this._at = setInterval(() => {
      if (!this.frames || !this.frames.length) return;
      if (this.hold > 0) { this.hold--; return; }
      const n = (this.idx + 1) % this.frames.length;
      this.show(n);
      if (n === this.nPast - 1) this.hold = 4;
    }, 600);
  }
  pause() { this.playing = false; clearInterval(this._at); this.$('.pp').innerHTML = gl('play'); }
  destroy() { clearInterval(this._at); clearInterval(this._rt); clearTimeout(this._retry); this.host.innerHTML = ''; }
}

class KshRainRadarCard extends KshWeatherBase {
  static get defaults() { return { zoom: 7, frames: 8, show_fullscreen: true }; }
  static get schema() {
    return [{ name: 'zoom', selector: { number: { min: 4, max: 11, mode: 'slider' } } }, { name: 'frames', selector: { number: { min: 3, max: 13, mode: 'box' } } },
      { name: 'latitude', selector: { number: { min: -90, max: 90, step: 0.0001, mode: 'box' } } }, { name: 'longitude', selector: { number: { min: -180, max: 180, step: 0.0001, mode: 'box' } } },
      { name: 'show_fullscreen', selector: { boolean: {} } }];
  }
  static get grid() { return { columns: 12, rows: 5, min_columns: 6, min_rows: 3 }; }
  static getStubConfig() { return {}; }
  _ids() { return []; }
  _opts(boost = 0) {
    const cfg = this._hass.config || {};
    return { lat: Number(this._c.latitude ?? cfg.latitude ?? 0), lon: Number(this._c.longitude ?? cfg.longitude ?? 0), zoom: Number(this._c.zoom) + boost, frames: Number(this._c.frames) || 8, dark: this._dark };
  }
  _render() {
    if (!this._hass || !this._c) return;
    if (!this._built) {
      this._built = true;
      this.shadowRoot.innerHTML = `<style>${BASE_CSS}${KshRainRadarCard.css}</style><ha-card class="${this._c.transparent ? 'transparent' : ''}">
        <div class="ph"><span>${esc(this._c.title ?? 'Rain radar')}</span>${this._c.show_fullscreen ? `<span class="phr"><button class="chip btn" data-act="open">${gl('expand')}Full screen</button></span>` : ''}</div>
        <div class="host"></div></ha-card><div class="ov" hidden><div class="ovp"><div class="ph"><span>Rain radar</span><span class="phr"><button class="chip btn" data-act="close">${gl('close')}Close</button></span></div><div class="host big"></div></div></div>`;
      this.shadowRoot.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        if (b.dataset.act === 'open') {
          this.shadowRoot.querySelector('.ov').hidden = false;
          requestAnimationFrame(() => { this._big = new RadarMap(this.shadowRoot.querySelector('.host.big'), this._opts(1)); });
        } else { this.shadowRoot.querySelector('.ov').hidden = true; if (this._big) { this._big.destroy(); this._big = null; } }
      });
      requestAnimationFrame(() => { this._map = new RadarMap(this.shadowRoot.querySelector('.host:not(.big)'), this._opts()); });
      this._sized = false;
      return;
    }
    if (this._map) this._map.setDark(this._dark);
    if (this._big) this._big.setDark(this._dark);
  }
  connectedCallback() {
    super.connectedCallback();
    this._ro2 = new ResizeObserver(() => { this._map && this._map.draw(); this._big && this._big.draw(); });
    this._ro2.observe(this);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this._ro2 && this._ro2.disconnect();
    if (this._map) this._map.destroy();
    if (this._big) this._big.destroy();
    this._map = this._big = null;
    this._built = false;
  }
  static get css() {
    return `ha-card{min-height:240px}
.host{position:relative;flex:1;min-height:180px;border-radius:14px;overflow:hidden}
.btn{cursor:pointer;border:none;font:inherit;color:inherit;height:28px;padding:0 10px;font-size:12px}
.btn .g{width:15px;height:15px}
.ov{position:fixed;inset:0;z-index:9;padding:18px;box-sizing:border-box;background:rgba(0,0,0,.45);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.ov[hidden]{display:none}
.ovp{height:100%;display:flex;flex-direction:column;border-radius:22px;padding:14px;box-sizing:border-box;background:var(--ha-card-background,var(--card-background-color,#111));color:var(--primary-text-color)}
.rm{position:absolute;inset:0;overflow:hidden;background:#0e1626}.rm.light{background:#e8edf3}
.rl{position:absolute;inset:0}.rl img{position:absolute;max-width:none;pointer-events:none}
.radar{opacity:.85}.rm:not(.light) .base{filter:brightness(1.45) saturate(1.1)}
.fr{position:absolute;inset:0;opacity:0}.fr.on{opacity:1}
.home{position:absolute;left:50%;top:50%}.home i{position:absolute;left:-7px;top:-7px;width:14px;height:14px;border-radius:50%;background:#FF5A4E;border:2.5px solid #fff;box-sizing:border-box;animation:pulse 2s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(255,90,78,.6)}70%{box-shadow:0 0 0 16px rgba(255,90,78,0)}100%{box-shadow:0 0 0 0 rgba(255,90,78,0)}}
.rm button{all:unset;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;background:rgba(10,18,36,.72);border:1px solid rgba(255,255,255,.18)}
.rm.light button{color:#13213a;background:rgba(255,255,255,.88);border-color:rgba(20,40,80,.12)}
.rm .g{width:18px;height:18px}
.zoom{position:absolute;right:10px;top:10px;display:flex;flex-direction:column;gap:6px}.zoom button{width:34px;height:34px;border-radius:10px}
.bar{position:absolute;left:10px;right:10px;bottom:10px;height:40px;display:flex;align-items:center;gap:10px;padding:0 12px 0 4px;border-radius:14px;background:rgba(10,18,36,.72);color:#fff;box-sizing:border-box}
.rm.light .bar{background:rgba(255,255,255,.88);color:#13213a}
.bar .pp{width:32px;height:32px;border-radius:10px;border:none;background:transparent}
.track{flex:1;display:flex;gap:3px;height:22px;align-items:center}
.track i{flex:1;height:6px;border-radius:3px;background:rgba(127,140,160,.35);cursor:pointer}.track i.past{background:rgba(63,169,245,.55)}.track i.on{background:#3FA9F5;height:12px}.track i.fut{background:rgba(167,139,250,.35)}
.time{font-size:12.5px;font-weight:600;white-space:nowrap}
.attr{position:absolute;right:12px;bottom:54px;font-size:9px;color:rgba(255,255,255,.6);text-shadow:0 1px 2px rgba(0,0,0,.6)}.rm.light .attr{color:rgba(20,30,50,.55);text-shadow:none}`;
  }
}

/* ============================================================ small tiles */
const TILE_GRID = { columns: 4, rows: 3, min_columns: 3, min_rows: 2 };

class KshWindCard extends KshWeatherBase {
  static get schema() { return [{ name: 'entity', required: true, selector: ENT('weather') }, { name: 'gust_entity', selector: ENT('sensor') }]; }
  static get grid() { return TILE_GRID; }
  _ids() { return [this._c.entity, this._c.gust_entity]; }
  _body() {
    const a = this._st(this._c.entity).attributes, unit = a.wind_speed_unit || 'km/h', spd = num(a.wind_speed), deg = bearingDeg(a.wind_bearing);
    const gs = this._st(this._c.gust_entity), gust = num(gs?.state);
    const kmh = spd === null ? null : unit === 'm/s' ? spd * 3.6 : unit === 'mph' ? spd * 1.609 : unit === 'kn' ? spd * 1.852 : spd;
    const BF = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
    const BFN = ['Calm', 'Light air', 'Light breeze', 'Gentle breeze', 'Moderate breeze', 'Fresh breeze', 'Strong breeze', 'Near gale', 'Gale', 'Strong gale', 'Storm', 'Violent storm', 'Hurricane'];
    const bf = kmh === null ? null : BF.findIndex((v) => kmh < v);
    const dir = deg === null ? '—' : bearingTxt(deg);
    let ticks = '';
    for (let i = 0; i < 72; i++) { const mj = i % 18 === 0; ticks += `<line x1="0" y1="-56" x2="0" y2="${mj ? -48 : -52}" transform="rotate(${i * 5})" style="stroke:${ink(mj ? 0.7 : i % 2 ? 0.14 : 0.3)}" stroke-width="${mj ? 2 : 1.2}"/>`; }
    const cards = [['N', 0], ['E', 90], ['S', 180], ['W', 270]].map(([t, r]) => { const rad = (r * Math.PI) / 180; return `<text x="${r1(Math.sin(rad) * 39)}" y="${r1(-Math.cos(rad) * 39 + 4)}" class="cd${t === 'N' ? ' n' : ''}">${t}</text>`; }).join('');
    const arrow = deg === null ? '' : `<g transform="rotate(${deg})"><line x1="0" y1="-50" x2="0" y2="44" style="stroke:var(--primary-text-color)" stroke-width="2.6" stroke-linecap="round"/><circle cx="0" cy="-50" r="4.2" style="fill:var(--ha-card-background,var(--card-background-color,#000));stroke:var(--primary-text-color)" stroke-width="2.4"/><path d="M0 56 L-7 42 L7 42 Z" style="fill:var(--primary-text-color)"/></g>`;
    const svg = `<svg class="compass" viewBox="-60 -60 120 120">${ticks}${cards}${arrow}<circle r="26" style="fill:var(--ha-card-background,var(--card-background-color,#000));stroke:${ink(0.12)}"/><text y="3" class="cs">${spd === null ? '—' : Math.round(spd)}</text><text y="16" class="cu">${esc(unit)}</text></svg>`;
    return this._tile('Wind', '', `<div class="row">${svg}<div class="side"><div class="big">${dir}</div><div class="mu">${deg === null ? '' : esc(COMPASS_LONG[dir] || dir)}</div>
      ${gust !== null ? `<div class="kv"><span>Gusts</span><b>${Math.round(gust)}</b><span>${esc(gs.attributes.unit_of_measurement || unit)}</span></div>` : ''}<div class="mu">${bf === null ? '' : BFN[bf < 0 ? 12 : bf]}</div></div></div>`);
  }
  static get css() { return `.compass{height:100%;max-height:130px;width:auto;aspect-ratio:1;flex:none}.compass text{fill:var(--primary-text-color);text-anchor:middle;font-family:inherit}.cd{font-size:9.5px;font-weight:600;fill:var(--secondary-text-color)!important}.cd.n{fill:#FF6B5A!important}.cs{font-size:19px;font-weight:600}.cu{font-size:8.5px;fill:var(--secondary-text-color)!important}`; }
}

class KshUvCard extends KshWeatherBase {
  static get schema() { return [{ name: 'entity', selector: ENT('weather') }, { name: 'uv_entity', selector: ENT('sensor') }, { name: 'peak_entity', selector: ENT('sensor') }]; }
  static get grid() { return TILE_GRID; }
  _ids() { return [this._c.entity, this._c.uv_entity, this._c.peak_entity]; }
  _body() {
    const uv = num(this._st(this._c.uv_entity)?.state) ?? num(this._st(this._c.entity)?.attributes.uv_index);
    const peak = num(this._st(this._c.peak_entity)?.state), v = uv ?? peak;
    const lvl = (x) => (x < 3 ? 'Low' : x < 6 ? 'Moderate' : x < 8 ? 'High' : x < 11 ? 'Very high' : 'Extreme');
    const ang = (x) => Math.PI * (1 - clamp(x, 0, 12) / 12), P = (x, r = 78) => [100 + r * Math.cos(ang(x)), 98 - r * Math.sin(ang(x))];
    const m = v === null ? null : P(v);
    const pk = peak === null ? '' : (() => { const a = P(peak, 98), b = P(peak, 89); return `<line x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}" style="stroke:var(--primary-text-color)" stroke-width="2.5" stroke-linecap="round" opacity=".75"/>`; })();
    const svg = `<svg class="gauge" viewBox="0 0 200 112"><path d="M22 98 A78 78 0 0 1 178 98" fill="none" style="stroke:${ink(0.1)}" stroke-width="13" stroke-linecap="round"/><path d="M22 98 A78 78 0 0 1 178 98" fill="none" stroke="url(#k-uv)" stroke-width="13" stroke-linecap="round"/>${pk}
      ${m ? `<circle cx="${r1(m[0])}" cy="${r1(m[1])}" r="9" style="fill:var(--primary-text-color);stroke:var(--ha-card-background,var(--card-background-color,#000))" stroke-width="4"/>` : ''}<text x="100" y="86" class="gv">${v === null ? '—' : r1(v)}</text><text x="100" y="106" class="gl2">${v === null ? '' : lvl(v)}</text></svg>`;
    return this._tile('UV index', peak !== null ? `Peak ${r1(peak)}` : '', `<div class="col">${svg}<div class="mu c">${v === null ? '' : v >= 3 ? 'Sun protection advised' : 'No protection needed'}</div></div>`);
  }
  _validate() { if (!this._c.entity && !this._c.uv_entity) throw new Error('Set a weather entity or a UV sensor'); }
}

class KshAirQualityCard extends KshWeatherBase {
  static get schema() { return [{ name: 'entity', required: true, selector: ENT('sensor') }]; }
  static get grid() { return TILE_GRID; }
  _body() {
    const st = this._st(this._c.entity), v = num(st.state);
    const lvl = v === null ? '' : v <= 50 ? 'Good' : v <= 100 ? 'Moderate' : v <= 150 ? 'Unhealthy for sensitive' : v <= 200 ? 'Unhealthy' : v <= 300 ? 'Very unhealthy' : 'Hazardous';
    const ang = (x) => Math.PI * (1 - clamp(x, 0, 300) / 300), P = (x) => [100 + 78 * Math.cos(ang(x)), 98 - 78 * Math.sin(ang(x))];
    const m = v === null ? null : P(v);
    const pol = st.attributes.dominentpol || st.attributes.dominant_pollutant;
    const svg = `<svg class="gauge" viewBox="0 0 200 112"><path d="M22 98 A78 78 0 0 1 178 98" fill="none" stroke="url(#k-aqi)" stroke-width="13" stroke-linecap="round"/>
      ${m ? `<circle cx="${r1(m[0])}" cy="${r1(m[1])}" r="9" style="fill:var(--primary-text-color);stroke:var(--ha-card-background,var(--card-background-color,#000))" stroke-width="4"/>` : ''}<text x="100" y="86" class="gv">${v === null ? '—' : Math.round(v)}</text><text x="100" y="106" class="gl2">${esc(lvl)}</text></svg>`;
    return this._tile('Air quality', pol ? `Main: ${esc(String(pol).toUpperCase())}` : '', `<div class="col">${svg}<div class="mu c">${esc(String(st.attributes.StationName || st.attributes.friendly_name || '').replace(/ Air Quality Index$/i, '').replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()))}</div></div>`);
  }
}

class KshHumidityCard extends KshWeatherBase {
  static get schema() { return [{ name: 'entity', required: true, selector: ENT('weather') }, { name: 'detail_entity', selector: ENT('weather') }]; }
  static get grid() { return TILE_GRID; }
  _ids() { return [this._c.entity, this._c.detail_entity]; }
  _body() {
    const a = this._st(this._c.entity).attributes, d = this._st(this._c.detail_entity)?.attributes || {};
    const hum = num(a.humidity) ?? num(d.humidity), dew = num(a.dew_point) ?? num(d.dew_point);
    const comfort = dew === null ? '' : dew < 10 ? 'Dry' : dew < 16 ? 'Comfortable' : dew < 19 ? 'A little humid' : dew < 22 ? 'Humid' : 'Oppressive';
    const r = 44, C = 2 * Math.PI * r, f = hum === null ? 0 : clamp(hum / 100, 0, 1);
    const svg = `<svg class="ring" viewBox="0 0 110 110"><circle cx="55" cy="55" r="${r}" fill="none" style="stroke:${ink(0.1)}" stroke-width="11"/><circle cx="55" cy="55" r="${r}" fill="none" stroke="url(#k-hum)" stroke-width="11" stroke-linecap="round" stroke-dasharray="${r1(C * f)} ${r1(C)}" transform="rotate(-90 55 55)"/><text x="55" y="60" class="rv">${hum === null ? '—' : Math.round(hum)}<tspan class="ru">%</tspan></text></svg>`;
    return this._tile('Humidity', '', `<div class="row">${svg}<div class="side"><span class="mu">Dew point</span><div class="big">${dew === null ? '—' : `${Math.round(dew)}°`}</div><div class="mu">${comfort}</div></div></div>`);
  }
  static get css() { return `.ring{height:100%;max-height:120px;width:auto;aspect-ratio:1;flex:none}.ring text{fill:var(--primary-text-color);text-anchor:middle;font-family:inherit}.rv{font-size:28px;font-weight:300}.ru{font-size:15px;fill:var(--secondary-text-color)}`; }
}

class KshPressureCard extends KshWeatherBase {
  static get schema() { return [{ name: 'entity', required: true, selector: ENT('weather') }]; }
  static get grid() { return TILE_GRID; }
  _body() {
    const a = this._st(this._c.entity).attributes, p = num(a.pressure), unit = a.pressure_unit || 'hPa';
    const lo = 970, hi = 1050, A = (v) => ((150 + 240 * clamp((v - lo) / (hi - lo), 0, 1)) * Math.PI) / 180, pt = (an, r) => [60 + r * Math.cos(an), 60 + r * Math.sin(an)];
    const [sx, sy] = pt(A(lo), 48), [ex, ey] = pt(A(hi), 48);
    let ticks = '';
    for (let v = lo; v <= hi; v += 10) { const an = A(v), [x1, y1] = pt(an, 38), [x2, y2] = pt(an, 33); ticks += `<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" style="stroke:${ink(0.35)}" stroke-width="1.4"/>`; }
    const nd = p === null ? '' : (() => { const [nx, ny] = pt(A(p), 48); return `<circle cx="${r1(nx)}" cy="${r1(ny)}" r="6.5" style="fill:var(--primary-text-color);stroke:var(--ha-card-background,var(--card-background-color,#000))" stroke-width="3"/>`; })();
    const label = p === null ? '' : p < 1000 ? 'Low · unsettled' : p < 1010 ? 'Below average' : p <= 1020 ? 'Average' : 'High · settled';
    const svg = `<svg class="dial" viewBox="0 0 120 112"><path d="M${r1(sx)} ${r1(sy)} A48 48 0 1 1 ${r1(ex)} ${r1(ey)}" fill="none" stroke="url(#k-press)" stroke-width="7" stroke-linecap="round"/>${ticks}${nd}
      <text x="60" y="62" class="pv">${p === null ? '—' : Math.round(p)}</text><text x="60" y="78" class="pu">${esc(unit)}</text><text x="${r1(sx) + 4}" y="110" class="pe">Low</text><text x="${r1(ex) - 4}" y="110" class="pe">High</text></svg>`;
    return this._tile('Pressure', '', `<div class="col">${svg}<div class="mu c">${label}</div></div>`);
  }
  static get css() { return `.dial{flex:1;min-height:0;width:100%;max-height:120px}.dial text{fill:var(--primary-text-color);text-anchor:middle;font-family:inherit}.pv{font-size:24px;font-weight:300}.pu{font-size:10px;fill:var(--secondary-text-color)!important}.pe{font-size:8.5px;fill:var(--secondary-text-color)!important}`; }
}

class KshSunMoonCard extends KshWeatherBase {
  static get defaults() { return { entity: 'sun.sun' }; }
  static get schema() { return [{ name: 'entity', required: true, selector: ENT('sun') }]; }
  static get grid() { return TILE_GRID; }
  static getStubConfig() { return { entity: 'sun.sun' }; }
  _ids() { return [this._c.entity]; }
  _sunTimes() { const c = this._c.sun_entity; this._c.sun_entity = this._c.entity; const r = super._sunTimes(); this._c.sun_entity = c; return r; }
  _body() {
    const now = new Date(), m = moonInfo(now, (this._hass.config.latitude || 0) < 0);
    const right = `${moonSvg(m, 20)}<span>${esc(m.name)}</span>`;
    const s = this._sunTimes();
    if (!s) return this._tile('Sun & moon', right, '<div class="empty">Sun data unavailable</div>');
    const t = (now - s.rise) / (s.set - s.rise), B = (u) => [16 + 188 * u, (1 - u) * (1 - u) * 92 + 2 * (1 - u) * u * -56 + u * u * 92];
    let mk = '', status;
    if (t >= 0 && t <= 1) { const [x, y] = B(t); mk = `<circle cx="${r1(x)}" cy="${r1(y)}" r="20" fill="url(#k-sunglow)"/><circle cx="${r1(x)}" cy="${r1(y)}" r="8" fill="url(#k-sun)"/>`; status = `Sunset in ${dur(s.set - now)}`; }
    else status = `Sunrise in ${dur((now > s.set ? new Date(+s.rise + 86400000) : s.rise) - now)}`;
    const svg = `<svg class="arc" viewBox="0 0 220 122"><path d="M16 92 Q110 -56 204 92" fill="none" style="stroke:${ink(0.25)}" stroke-width="2" stroke-dasharray="3 5"/>
      <path d="M16 92 Q110 -56 204 92" fill="none" stroke="#FFB020" stroke-width="3" stroke-linecap="round" pathLength="1" stroke-dasharray="${r1(clamp(t, 0, 1) * 1000) / 1000} 2"/>
      <line x1="4" x2="216" y1="92.5" y2="92.5" style="stroke:${ink(0.25)}"/>${mk}<text x="16" y="112" class="se">↑ ${esc(fmtTime(s.rise))}</text><text x="204" y="112" class="se e">↓ ${esc(fmtTime(s.set))}</text>
      <text x="110" y="70" class="sd">${dur(s.set - s.rise)}</text><text x="110" y="84" class="sdl">daylight</text></svg>`;
    return this._tile('Sun & moon', right, `<div class="col">${svg}<div class="mu c">${status}</div></div>`);
  }
  static get css() { return `.arc{flex:1;min-height:0;width:100%;max-height:130px}.arc text{fill:var(--primary-text-color);text-anchor:middle;font-family:inherit}.se{font-size:12px;text-anchor:start!important;fill:var(--secondary-text-color)!important;font-weight:500}.se.e{text-anchor:end!important}.sd{font-size:17px;font-weight:500}.sdl{font-size:10px;fill:var(--secondary-text-color)!important;letter-spacing:.06em}`; }
}

class KshTidesCard extends KshWeatherBase {
  static get schema() { return [{ name: 'entity', required: true, selector: ENT('sensor') }]; }
  static get grid() { return TILE_GRID; }
  _body() {
    const a = this._st(this._c.entity).attributes, now = new Date();
    const t0 = new Date(a.last_tide_time), t1 = new Date(a.next_tide_time), L0 = num(a.last_tide_level), L1 = num(a.next_tide_level);
    if (isNaN(t0) || isNaN(t1) || L0 === null || L1 === null || t1 <= t0) return this._tile('Tides', '', '<div class="empty">This sensor has no last/next tide attributes</div>');
    const P = t1 - t0, midL = (L0 + L1) / 2, amp = Math.abs(L0 - L1) / 2, sgn = L0 > L1 ? 1 : -1;
    const lvl = (t) => midL + sgn * amp * Math.cos((Math.PI * (t - t0)) / P);
    const W = 220, H = 96, yT = 26, yB = 80, ws = +now - 5 * 3600000, we = +now + 13 * 3600000;
    const X = (t) => ((t - ws) / (we - ws)) * W, lMin = midL - amp, lMax = midL + amp, Y = (l) => yB - ((l - lMin) / Math.max(0.1, lMax - lMin)) * (yB - yT);
    const pts = [];
    for (let i = 0; i <= 60; i++) { const t = ws + ((we - ws) * i) / 60; pts.push([X(t), Y(lvl(t))]); }
    const line = smoothPath(pts);
    let ext = '';
    for (let k = -3; k <= 5; k++) {
      const t = +t0 + k * P;
      if (t < ws + 1800000 || t > we - 1800000) continue;
      const isHigh = (k % 2 === 0) === (L0 > L1), x = X(t), y = Y(isHigh ? lMax : lMin);
      ext += `<circle cx="${r1(x)}" cy="${r1(y)}" r="3" fill="#38B6FF" vector-effect="non-scaling-stroke"/>`;
    }
    const nx = X(+now), ny = Y(lvl(+now));
    const nh = a.next_high_tide_time ? new Date(a.next_high_tide_time) : null, nl = a.next_low_tide_time ? new Date(a.next_low_tide_time) : null;
    const nH = num(a.next_high_tide_level), nL = num(a.next_low_tide_level);
    const svg = `<svg class="tide" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${line} L${W},${H} L0,${H} Z" fill="url(#k-tide)"/><path d="${line}" fill="none" stroke="#38B6FF" stroke-width="2.4"/>${ext}
      <line x1="${r1(nx)}" x2="${r1(nx)}" y1="8" y2="${H}" style="stroke:${ink(0.45)}" stroke-dasharray="2 3"/><circle cx="${r1(nx)}" cy="${r1(ny)}" r="5.5" style="fill:var(--primary-text-color);stroke:var(--ha-card-background,var(--card-background-color,#000))" stroke-width="3"/></svg>`;
    const foot = `<div class="tf">${nh && nH !== null ? `<div><span>Next high · <em>${nH.toFixed(1)} m</em></span><b>${esc(fmtTime(nh))}</b></div>` : ''}${nl && nL !== null ? `<div><span>Next low · <em>${nL.toFixed(1)} m</em></span><b>${esc(fmtTime(nl))}</b></div>` : ''}</div>`;
    return this._tile('Tides', `${L1 > L0 ? '↗ Rising' : '↘ Falling'} · ${lvl(+now).toFixed(1)} m`, `<div class="col st">${svg}${foot}</div>`);
  }
  static get css() { return `.tide{width:100%;flex:1;min-height:60px;max-height:100px;display:block;overflow:visible}.tdl{font-size:9.5px;fill:var(--secondary-text-color);text-anchor:middle;font-family:inherit}
.st{align-items:stretch;justify-content:space-between}.tf{display:flex;justify-content:space-between;gap:8px}.tf div{display:flex;flex-direction:column;font-size:11.5px;color:var(--secondary-text-color);white-space:nowrap}
.tf div:last-child{align-items:flex-end}.tf b{color:var(--primary-text-color);font-weight:600;font-size:15px}.tf em{font-style:normal;color:#38B6FF}`; }
}

/* ===================================================================== CSS */
const BASE_CSS = `
:host{display:block;height:100%}
ha-card{height:100%;box-sizing:border-box;padding:16px 18px;display:flex;flex-direction:column;overflow:hidden;color:var(--primary-text-color);
  background:var(--ha-card-background,var(--card-background-color,#111));border-radius:var(--ha-card-border-radius,16px);
  border:var(--ha-card-border-width,1px) solid var(--ha-card-border-color,var(--divider-color,transparent));box-shadow:var(--ha-card-box-shadow,none);
  font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
ha-card.transparent{background:none;border:none;box-shadow:none}
.ph{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:22px;margin-bottom:6px;font-size:12px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--secondary-text-color);white-space:nowrap}
.ph:has(span:first-child:empty){justify-content:flex-end}
.phr{display:flex;align-items:center;gap:6px;letter-spacing:.02em;text-transform:none;font-weight:500;font-size:12.5px;overflow:hidden}
.sep{margin:0 6px;opacity:.45}
.empty{flex:1;display:flex;align-items:center;justify-content:center;text-align:center;color:var(--secondary-text-color);font-size:14px;min-height:60px}
.chip{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:15px;font-size:13px;font-weight:500;background:${ink(0.07)};color:var(--primary-text-color);white-space:nowrap}
.chip.warn{background:rgba(255,176,32,.2)}
.chip .gl{width:15px;height:15px}
.dot{width:9px;height:9px;border-radius:50%;display:inline-block}
.tb{flex:1;min-height:100px;display:flex}
.row{flex:1;display:flex;align-items:center;gap:14px;min-width:0}
.col{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:0}
.side{display:flex;flex-direction:column;gap:4px;min-width:0}
.big{font-size:28px;font-weight:300;line-height:1.05}
.mu{font-size:13px;color:var(--secondary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c{text-align:center}
.kv{display:flex;align-items:baseline;gap:6px;font-size:13px;color:var(--secondary-text-color);white-space:nowrap}.kv b{color:var(--primary-text-color);font-size:15px}
.gauge{flex:1;min-height:0;width:100%;max-height:118px}.gauge text{fill:var(--primary-text-color);text-anchor:middle;font-family:inherit}.gv{font-size:34px;font-weight:300}.gl2{font-size:13px;fill:var(--secondary-text-color)!important;font-weight:500}
.wi .rays{transform-origin:0 0}.wi.anim .rays{animation:spin 40s linear infinite}.wi.anim .drop{animation:drop 1.1s linear infinite}
.light .cloud{stroke:rgba(60,90,130,.3);stroke-width:1.1}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes drop{0%{transform:translateY(-5px);opacity:0}25%{opacity:1}100%{transform:translateY(9px);opacity:0}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
`;

/* ================================================================ register */
const KSH_WEATHER = [
  ['ksh-weather-now-card', KshWeatherNowCard, 'Weather · now', 'Current conditions with clock, feels-like and chips'],
  ['ksh-weather-hourly-card', KshWeatherHourlyCard, 'Weather · next 24 hours', 'Temperature curve, rain bars and night bands'],
  ['ksh-weather-daily-card', KshWeatherDailyCard, 'Weather · 7-day', 'Daily forecast with temperature range bars'],
  ['ksh-rain-radar-card', KshRainRadarCard, 'Rain radar', 'Animated rain radar with full-screen view'],
  ['ksh-wind-card', KshWindCard, 'Wind', 'Compass, speed, gusts and Beaufort'],
  ['ksh-uv-card', KshUvCard, 'UV index', 'UV gauge with peak'],
  ['ksh-air-quality-card', KshAirQualityCard, 'Air quality', 'AQI gauge'],
  ['ksh-humidity-card', KshHumidityCard, 'Humidity', 'Humidity ring and dew point'],
  ['ksh-pressure-card', KshPressureCard, 'Pressure', 'Barometer dial'],
  ['ksh-sun-moon-card', KshSunMoonCard, 'Sun & moon', 'Sun arc, daylight and moon phase'],
  ['ksh-tides-card', KshTidesCard, 'Tides', 'Tide curve from a tide sensor'],
];
window.customCards = window.customCards || [];
for (const [type, cls, name, description] of KSH_WEATHER) {
  if (!customElements.get(type)) customElements.define(type, cls);
  if (!window.customCards.some((c) => c.type === type)) window.customCards.push({ type, name: `KSH · ${name}`, description, preview: true });
}
console.info(`%c KSH WEATHER %c v${KSH_WEATHER_VERSION} · ${KSH_WEATHER.length} cards `, 'background:#3FA9F5;color:#fff;font-weight:700', 'background:#111;color:#fff');
