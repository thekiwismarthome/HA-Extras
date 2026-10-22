/*! KSH Intercom Card — a Kiosk Satellite intercom board with a built-in config editor.
 *  Proper custom Lovelace card: config lives in the card's own YAML (per card),
 *  so each tablet's `my_device` is independent. No helpers, no localStorage.
 *
 *  Install:
 *    1. Copy this file to  <config>/www/ksh-intercom-card.js
 *    2. Settings -> Dashboards -> (3-dot) -> Resources -> Add resource
 *         URL: /local/ksh-intercom-card.js   Type: JavaScript Module
 *    3. Edit a dashboard -> Add card -> search "KSH Intercom".
 *       Click the card's edit (pencil) to pick THIS device and which others to show.
 *
 *  Config:
 *    type: custom:ksh-intercom-card
 *    my_device: "Office Tablet"     # this tablet (name as its sensor reports it)
 *    show_all: true                 # or false + devices: [...]
 *    devices: ["Kitchen Tablet"]
 *    node_overrides: { "Name": "ks_custom_node" }
 */
(() => {
  const VERSION = '0.0.2';
  const SVG = {
    phone: 'M6.62,10.79C8.06,13.62 10.38,15.94 13.21,17.38L15.41,15.18C15.69,14.9 16.08,14.82 16.43,14.93C17.55,15.3 18.75,15.5 20,15.5A1,1 0 0,1 21,16.5V20A1,1 0 0,1 20,21A17,17 0 0,1 3,4A1,1 0 0,1 4,3H7.5A1,1 0 0,1 8.5,4C8.5,5.25 8.7,6.45 9.07,7.57C9.18,7.92 9.1,8.31 8.82,8.59L6.62,10.79Z',
    hangup: 'M12,9C10.4,9 8.85,9.25 7.4,9.72V12.82C7.4,13.22 7.17,13.56 6.84,13.72C5.86,14.21 4.97,14.84 4.17,15.57C4,15.75 3.75,15.86 3.5,15.86C3.2,15.86 2.95,15.74 2.77,15.56L0.29,13.08C0.11,12.9 0,12.65 0,12.36C0,12.06 0.12,11.81 0.3,11.63C3.34,8.78 7.46,7 12,7C16.54,7 20.66,8.78 23.7,11.63C23.88,11.81 24,12.06 24,12.36C24,12.65 23.89,12.9 23.71,13.08L21.23,15.56C21.05,15.74 20.8,15.86 20.5,15.86C20.25,15.86 20,15.75 19.83,15.57C19.03,14.84 18.14,14.21 17.16,13.72C16.83,13.56 16.6,13.22 16.6,12.82V9.72C15.15,9.25 13.6,9 12,9Z',
    check: 'M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z',
  };
  const icon = (d, cls) => `<svg viewBox="0 0 24 24" class="icn ${cls || ''}"><path d="${d}"/></svg>`;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const IDLE = ['idle', 'ended', 'off', 'unavailable', 'unknown', 'none', ''];
  const isBusy = (s) => IDLE.indexOf(String(s == null ? '' : s).trim().toLowerCase()) === -1;

  function discover(hass) {
    if (!hass) return [];
    const svcs = (hass.services && hass.services.esphome) ? Object.keys(hass.services.esphome) : [];
    const nodes = svcs.filter(k => /_intercom_call$/.test(k)).map(k => k.replace(/_intercom_call$/, ''));
    return Object.keys(hass.states)
      .filter(id => /^sensor\..*_intercom$/.test(id))
      .map(id => {
        const st = hass.states[id];
        const fn = (st.attributes && st.attributes.friendly_name) || id;
        const name = fn.replace(/\s*intercom$/i, '').trim();
        const n = norm(name);
        const k = hass.states[id + '_kiosk'];
        return { id, name, norm: n, node: nodes.find(nd => nd === n || nd.endsWith('_' + n) || nd.endsWith(n)) || '', state: st.state, talkingTo: k ? k.state : '' };
      })
      .filter((d, i, a) => a.findIndex(x => x.norm === d.norm) === i)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const STYLE = `
    :host { display: block; }
    * { box-sizing: border-box; }
    .wrap { font-family: Antonio, 'Roboto Condensed', var(--primary-font-family, sans-serif);
            background: rgba(14,14,14,0.98); border: 1px solid rgba(255,255,255,0.1);
            border-radius: 22px; padding: 16px 14px; box-shadow: 0 12px 40px rgba(0,0,0,0.5); }
    .head { display: flex; align-items: center; justify-content: space-between; padding: 4px 6px 12px; }
    .title { color: #fff; font-weight: 700; letter-spacing: 4px; font-size: 20px; }
    .sub { color: #6b6e70; font-weight: 600; letter-spacing: 2px; font-size: 13px; }
    .icn { width: 1.3em; height: 1.3em; vertical-align: middle; fill: currentColor; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px;
           margin: 8px 0; border-radius: 14px; background: rgba(255,255,255,0.05); color: #fff;
           font-size: 21px; font-weight: 600; min-height: 30px; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent; }
    .row.busy { background: rgba(255,159,10,0.08); cursor: default; }
    .row.off { opacity: 0.5; cursor: default; }
    .row:not(.busy):not(.off):active { background: rgba(52,199,89,0.18); }
    .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .right { display: flex; align-items: center; gap: 10px; }
    .call { color: #34C759; display: inline-flex; background: rgba(52,199,89,0.14); border-radius: 10px; padding: 8px 10px; }
    .with { color: #FF9F0A; font-size: 15px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
    .live { width: 9px; height: 9px; border-radius: 50%; background: #FF9F0A; box-shadow: 0 0 8px #FF9F0A; display: inline-block; }
    .end { color: #FF3B30; display: inline-flex; align-items: center; gap: 6px; background: rgba(255,59,48,0.14);
           border-radius: 10px; padding: 8px 12px; font-size: 16px; font-weight: 600; cursor: pointer; }
    .end.sm { font-size: 14px; padding: 6px 9px; }
    .end:active { background: rgba(255,59,48,0.3); }
    .me { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 4px 0 10px;
          padding: 14px 16px; border-radius: 14px; background: rgba(0,161,228,0.1); border: 1px solid rgba(0,161,228,0.25); }
    .me-txt { color: #cfd3d6; font-size: 17px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
    .me-txt .live { background: #00A1E4; box-shadow: 0 0 8px #00A1E4; }
    .me-txt b { color: #fff; }
    .warn { color: #FF9F0A; text-align: center; padding: 10px; font-size: 15px; }
    .empty { color: #777; text-align: center; padding: 20px; font-size: 18px; }
    /* editor */
    .sec { color: #6b6e70; font-weight: 600; letter-spacing: 3px; font-size: 13px; margin: 14px 6px 8px; }
    .pills { display: flex; flex-wrap: wrap; gap: 8px; }
    .pill { display: inline-flex; align-items: center; padding: 10px 16px; border-radius: 999px; font-size: 18px; font-weight: 600;
            background: rgba(255,255,255,0.05); color: #cfd3d6; border: 1.5px solid transparent; cursor: pointer; user-select: none; }
    .pill.on { background: rgba(52,199,89,0.16); color: #fff; border-color: #34C759; }
    .pill .dot { width: 10px; height: 10px; border-radius: 50%; background: #34C759; margin-right: 8px; }
    .seg { display: flex; gap: 8px; background: rgba(255,255,255,0.05); border-radius: 14px; padding: 5px; }
    .seg-opt { flex: 1; text-align: center; padding: 12px; border-radius: 10px; font-size: 18px; font-weight: 600; color: #9ba0a3; cursor: pointer; user-select: none; }
    .seg-opt.on { background: #00A1E4; color: #fff; }
    .chk { display: flex; align-items: center; gap: 14px; padding: 13px 16px; margin: 7px 0; border-radius: 14px;
           background: rgba(255,255,255,0.05); color: #cfd3d6; font-size: 20px; font-weight: 600; cursor: pointer; user-select: none; }
    .chk.on { color: #fff; }
    .box { width: 26px; height: 26px; border-radius: 8px; border: 2px solid #4a4e51; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; }
    .chk.on .box { background: #34C759; border-color: #34C759; }
    .chk.on .box .icn { fill: #06260f; }
  `;

  // plain editor styling (standard card-editor look; follows the HA theme)
  const EDSTYLE = `
    .ed { font-family: var(--primary-font-family, Roboto, "Segoe UI", sans-serif); color: var(--primary-text-color, #212121); padding: 4px 2px; }
    .ed .f { margin: 0 0 16px; }
    .ed h4 { margin: 0 0 6px; font-size: 13px; font-weight: 500; color: var(--secondary-text-color, #727272); }
    .ed select { width: 100%; padding: 11px 10px; font-size: 15px; border-radius: 6px;
                 border: 1px solid var(--divider-color, #c4c4c4); background: var(--card-background-color, #fff);
                 color: var(--primary-text-color, #212121); }
    .ed .row { display: flex; align-items: center; gap: 12px; padding: 7px 0; font-size: 15px; cursor: pointer; }
    .ed .sw { justify-content: space-between; }
    .ed input[type=checkbox] { width: 18px; height: 18px; accent-color: var(--primary-color, #03a9f4); flex: 0 0 auto; cursor: pointer; }
    .ed .hint { font-size: 12px; color: var(--secondary-text-color, #9b9b9b); margin-top: 4px; }
  `;

  // ======================= CARD =======================
  class KshIntercomCard extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }); this._sig = ''; }
    setConfig(config) { this._config = Object.assign({ show_all: true, devices: [], node_overrides: {} }, config || {}); this._sig = ''; this._render(); }
    set hass(hass) { this._hass = hass; this._render(); }
    getCardSize() { return 3; }
    static getConfigElement() { return document.createElement('ksh-intercom-card-editor'); }
    static getStubConfig() { return { my_device: '', show_all: true, devices: [] }; }

    _signature() {
      const h = this._hass; if (!h) return 'nohass';
      let parts = [this._config && JSON.stringify(this._config), h.user && h.user.is_admin];
      Object.keys(h.states).forEach(id => { if (/^sensor\..*_intercom(_kiosk)?$/.test(id)) parts.push(id + '=' + h.states[id].state); });
      return parts.join('|');
    }

    _render() {
      if (!this._hass || !this._config) return;
      const sig = this._signature();
      if (sig === this._sig) return;        // skip unchanged renders (hass fires often)
      this._sig = sig;

      const cfg = this._config;
      const ov = cfg.node_overrides || {};
      const devices = discover(this._hass).map(d => Object.assign({}, d, { node: ov[d.name] || d.node }));
      const me = devices.find(d => d.norm === norm(cfg.my_device));
      const myNode = me ? me.node : '';
      const admin = !!(this._hass.user && this._hass.user.is_admin);
      let targets = devices.filter(d => d.norm !== norm(cfg.my_device));
      if (!cfg.show_all && Array.isArray(cfg.devices) && cfg.devices.length) {
        const keep = cfg.devices.map(norm);
        targets = targets.filter(d => keep.indexOf(d.norm) !== -1);
      }

      let h = `<style>${STYLE}</style><div class="wrap">`;
      h += `<div class="head"><span class="title">INTERCOM</span><span class="sub">${esc(me ? me.name : (cfg.my_device || 'not set'))}</span></div>`;
      if (!myNode) h += `<div class="warn">Edit this card to pick its device</div>`;
      if (me && isBusy(me.state)) {
        h += `<div class="me"><span class="me-txt"><span class="live"></span> In call with <b>${esc(me.talkingTo || '…')}</b></span>`
           + `<span class="end" data-hangup="${esc(myNode)}">${icon(SVG.hangup)} Hang up</span></div>`;
      }
      targets.forEach(d => {
        if (isBusy(d.state)) {
          let right = `<span class="with"><span class="live"></span> ${esc(d.talkingTo || 'in call')}</span>`;
          if (admin && d.node) right += `<span class="end sm" data-hangup="${esc(d.node)}">${icon(SVG.hangup)}End</span>`;
          h += `<div class="row busy"><span class="name">${esc(d.name)}</span><span class="right">${right}</span></div>`;
        } else {
          const ok = myNode && d.name;
          h += `<div class="row${ok ? '' : ' off'}"${ok ? ` data-call="${esc(d.name)}"` : ''}><span class="name">${esc(d.name)}</span>`
             + `<span class="right"><span class="call">${icon(SVG.phone)}</span></span></div>`;
        }
      });
      if (devices.length === 0) h += `<div class="empty">No intercom sensors found</div>`;
      else if (targets.length === 0) h += `<div class="empty">No other devices</div>`;
      h += `</div>`;
      this.shadowRoot.innerHTML = h;

      const call = this.shadowRoot;
      call.querySelectorAll('[data-call]').forEach(el => el.addEventListener('click', (e) => {
        e.stopPropagation();
        this._hass.callService('esphome', myNode + '_intercom_call', { kiosk: el.getAttribute('data-call') });
      }));
      call.querySelectorAll('[data-hangup]').forEach(el => el.addEventListener('click', (e) => {
        e.stopPropagation();
        this._hass.callService('esphome', el.getAttribute('data-hangup') + '_intercom_hangup', {});
      }));
    }
  }
  customElements.define('ksh-intercom-card', KshIntercomCard);

  // ======================= EDITOR =======================
  class KshIntercomCardEditor extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }); }
    setConfig(config) { this._config = Object.assign({ show_all: true, devices: [], node_overrides: {} }, config || {}); this._render(); }
    set hass(hass) { this._hass = hass; this._render(); }

    _emit(patch) {
      this._config = Object.assign({}, this._config, patch);
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config }, bubbles: true, composed: true }));
      this._render();
    }

    _render() {
      if (!this._config) return;
      const cfg = this._config;
      const discovered = discover(this._hass).map(d => d.name);
      let h = `<style>${EDSTYLE}</style><div class="ed">`;
      if (discovered.length === 0) h += `<div class="hint">No intercom sensors found yet</div>`;

      h += `<div class="f"><h4>This device</h4><select id="me">`;
      h += `<option value=""${cfg.my_device ? '' : ' selected'}>— choose —</option>`;
      discovered.forEach(n => { h += `<option ${norm(n) === norm(cfg.my_device) ? 'selected' : ''}>${esc(n)}</option>`; });
      h += `</select><div class="hint">Which kiosk this card runs on</div></div>`;

      h += `<div class="f"><label class="row sw"><span>Show all devices</span>`
         + `<input type="checkbox" id="all" ${cfg.show_all ? 'checked' : ''}></label></div>`;

      if (!cfg.show_all) {
        h += `<div class="f"><h4>Devices to show</h4>`;
        discovered.filter(n => norm(n) !== norm(cfg.my_device)).forEach(n => {
          const on = (cfg.devices || []).map(norm).indexOf(norm(n)) !== -1;
          h += `<label class="row"><input type="checkbox" data-dev="${esc(n)}" ${on ? 'checked' : ''}><span>${esc(n)}</span></label>`;
        });
        h += `</div>`;
      }
      h += `</div>`;
      this.shadowRoot.innerHTML = h;

      const r = this.shadowRoot;
      const meSel = r.getElementById('me');
      if (meSel) meSel.addEventListener('change', () => {
        const name = meSel.value;
        const devices = (cfg.devices || []).filter(d => norm(d) !== norm(name));
        this._emit({ my_device: name, devices });
      });
      const allCb = r.getElementById('all');
      if (allCb) allCb.addEventListener('change', () => this._emit({ show_all: allCb.checked }));
      r.querySelectorAll('input[data-dev]').forEach(el => el.addEventListener('change', () => {
        const name = el.getAttribute('data-dev');
        const cur = (cfg.devices || []).slice();
        const i = cur.map(norm).indexOf(norm(name));
        if (el.checked && i === -1) cur.push(name);
        else if (!el.checked && i !== -1) cur.splice(i, 1);
        this._emit({ devices: cur });
      }));
    }
  }
  customElements.define('ksh-intercom-card-editor', KshIntercomCardEditor);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'ksh-intercom-card',
    name: 'KSH Intercom',
    description: 'Kiosk Satellite intercom board with built-in setup (edit the card to configure).',
    preview: true,
    documentationURL: 'https://github.com/thekiwismarthome/HA-Extras',
  });
  console.info('%c KSH-INTERCOM-CARD ', 'background:#00A1E4;color:#fff;border-radius:4px', 'v' + VERSION + ' loaded');
})();
