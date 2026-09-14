/**
 * news-reader-card  —  Kiwi Smart Home
 * Master/detail news reader for Home Assistant.
 *   Tabs  : channels (RNZ sections), each backed by its own feedparser sensor.
 *   Left  : headlines for the active channel, newest first, "5m ago" relative time.
 *           Any MetService warnings are pinned amber at the very top of the list.
 *   Right : webpage (iframe) that loads the clicked story. 50/50, each side scrolls,
 *           whole card is capped to the viewport so it never runs off the bottom.
 *
 * Why tabs instead of RNZ's own menu: RNZ's article pages allow framing, but its
 * section pages send X-Frame-Options: SAMEORIGIN and "refuse to connect" in a frame.
 * So browsing by channel happens here (always article pages = always frames).
 *
 * Install:
 *   1. Copy this file to  <config>/www/community/news-reader-card/news-reader-card.js
 *   2. Settings > Dashboards > (3-dot) Resources > Add
 *        URL  /local/community/news-reader-card/news-reader-card.js
 *        Type JavaScript module
 *   3. Add a card (see news-reader-view.yaml).
 *
 * Config:
 *   type: custom:news-reader-card
 *   title: RNZ News
 *   channels:                                 # tab row (label + its feedparser sensor)
 *     - { label: National, entity: sensor.news_headlines }
 *     - { label: World,    entity: sensor.rnz_world }
 *     - ...
 *   news_entity: sensor.news_headlines        # fallback if `channels` omitted
 *   warnings_entity: sensor.metservice_warnings   # optional, pinned amber on top
 *   default_url: ''                           # optional page shown before any click
 *   split: 50                                 # left column width, %
 *   bottom_gap: 8                             # px gap kept below the card
 *   open_newest_on_load: false                # auto-load newest story on open
 */

const REL = (ts) => {
  if (!ts) return "";
  let s = (Date.now() - ts) / 1000;
  if (s < 0) s = 0;
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24);
  if (d < 7) return d + "d ago";
  return Math.floor(d / 7) + "w ago";
};

const ESC = (s) =>
  String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );

// Play glyph (triangle in a circle) for the per-row read-aloud button.
const SPK_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
  'stroke-linecap="round" stroke-linejoin="round">' +
  '<circle cx="12" cy="12" r="9"/>' +
  '<path d="M10 8.2 L16 12 L10 15.8 Z"/></svg>';

class NewsReaderCard extends HTMLElement {
  setConfig(config) {
    const cfg = Object.assign(
      {
        title: "News",
        channels: null,
        news_entity: null,
        warnings_entity: null,
        default_url: "",
        split: 50,
        bottom_gap: 8,
        open_newest_on_load: false,
        select_helper: null,   // input_text.* to write the selected story URL into (for read-aloud)
        tts_player: null,      // media_player entity for per-row read-aloud (shows speaker buttons)
        tts_service: "pyscript.rnz_read_aloud",  // "<domain>.<service>" called with {player, url}
      },
      config || {}
    );

    // Normalise channels. Fall back to a single channel from news_entity.
    let channels = Array.isArray(cfg.channels) ? cfg.channels.slice() : [];
    channels = channels
      .map((c) => ({ label: c.label || c.name || "News", entity: c.entity }))
      .filter((c) => c.entity);
    if (!channels.length && cfg.news_entity) {
      channels = [{ label: "News", entity: cfg.news_entity }];
    }
    if (!channels.length) {
      throw new Error("news-reader-card: provide `channels:` or `news_entity`");
    }

    this._config = cfg;
    this._channels = channels;
    this._active = 0;
    this._selectedUrl = cfg.default_url || "";
    this._autoPick = true;   // auto-load newest story (on load + each channel switch)
    this._readingUrl = null; // url currently being read aloud (for the speaker toggle)
    this._sig = null;
    this._build();
  }

  set hass(hass) {
    this._hass = hass;
    this._updateList();
    // Clear the reading glow once the player has finished (playing -> not playing).
    const p = this._config.tts_player && hass.states[this._config.tts_player];
    if (p) {
      if (p.state === "playing") {
        this._wasPlaying = true;
      } else if (this._wasPlaying) {
        this._wasPlaying = false;
        this._readingUrl = null;
        this._refreshSpeakers();
      }
    }
  }

  connectedCallback() {
    this._fit();
    this._onResize = () => this._fit();
    window.addEventListener("resize", this._onResize);
    this._tick = setInterval(() => this._refreshTimes(), 60000);
    requestAnimationFrame(() => this._fit());
    setTimeout(() => this._fit(), 250);
  }

  disconnectedCallback() {
    window.removeEventListener("resize", this._onResize);
    clearInterval(this._tick);
  }

  getCardSize() {
    return 8;
  }

  // ---- DOM skeleton (built once) -----------------------------------------
  _build() {
    const c = this._config;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .wrap {
          display: flex; flex-direction: column;
          background: #000; border-radius: 12px; overflow: hidden;
          font-family: Antonio, sans-serif; color: #fff; box-sizing: border-box;
        }
        .head {
          flex: 0 0 auto; padding: 10px 14px 6px;
          font-size: 20px; font-weight: 600; letter-spacing: 0.5px;
          text-transform: uppercase; color: #9BA0A3;
        }
        .tabs {
          flex: 0 0 auto; display: flex; gap: 6px;
          padding: 4px 10px 8px; overflow-x: auto; overflow-y: hidden;
          scrollbar-width: none;
        }
        .tabs::-webkit-scrollbar { display: none; }
        .tab {
          flex: 0 0 auto; cursor: pointer; white-space: nowrap;
          padding: 5px 12px; border-radius: 999px;
          font-size: 14px; font-weight: 500; letter-spacing: 0.4px;
          color: #9BA0A3; background: #141414; border: 1px solid #222;
          transition: all 0.12s ease;
        }
        .tab:hover { color: #fff; }
        .tab.on {
          color: #000; background: #00A1E4; border-color: #00A1E4; font-weight: 600;
        }
        .body {
          flex: 1 1 auto; display: flex; min-height: 0; gap: 8px; padding: 0 8px 8px;
        }
        .list {
          width: ${Number(c.split) || 50}%; flex: 0 0 auto;
          overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch;
        }
        .detail {
          flex: 1 1 auto; min-width: 0; position: relative;
          background: #0a0a0a; border-radius: 8px; overflow: hidden;
        }
        .detail iframe {
          width: 100%; height: 100%; border: 0; display: block; background: #fff;
          color-scheme: light;   /* ask WebView not to force-dark the framed page */
        }
        .hint {
          position: absolute; inset: 0; display: flex;
          align-items: center; justify-content: center; text-align: center;
          padding: 24px; color: #6B6E70; font-size: 18px;
        }
        .hint[hidden] { display: none; }
        .item {
          display: flex; flex-direction: row; align-items: center; gap: 8px;
          padding: 10px 12px; border-bottom: 1px solid #1c1c1c;
          cursor: pointer; transition: background 0.12s ease;
        }
        .itxt { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .item:hover { background: #141414; }
        .item.sel { background: #17222b; box-shadow: inset 3px 0 0 0 #00A1E4; }
        .item .t { font-size: 18px; font-weight: 500; line-height: 1.25; color: #fff; }
        .item .meta { font-size: 13px; font-weight: 400; letter-spacing: 0.3px; color: #6B6E70; }
        .spk {
          flex: 0 0 auto; width: 34px; height: 34px; padding: 6px; box-sizing: border-box;
          border: none; background: transparent; cursor: pointer; color: #6B6E70;
          border-radius: 8px; transition: color 0.12s ease, background 0.12s ease;
        }
        .spk:hover { color: #fff; background: #202020; }
        .spk svg { width: 100%; height: 100%; display: block; }
        .spk.reading { color: #00A1E4; filter: drop-shadow(0 0 5px rgba(0,161,228,0.55)); }
        .item.warn { background: #1a1206; }
        .item.warn .t { color: #FF9F0A; }
        .item.warn .meta { color: #FF9F0A; opacity: 0.85; }
        .item.warn.sel { box-shadow: inset 3px 0 0 0 #FF9F0A; }
        .sechdr {
          padding: 8px 12px 4px; font-size: 12px; letter-spacing: 1px;
          text-transform: uppercase; color: #6B6E70;
        }
        .empty { padding: 16px 12px; color: #6B6E70; }
        .list::-webkit-scrollbar { width: 8px; }
        .list::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 4px; }
      </style>
      <div class="wrap">
        <div class="head" ${c.title ? "" : "hidden"}>${ESC(c.title)}</div>
        <div class="tabs" id="tabs"></div>
        <div class="body">
          <div class="list" id="list"></div>
          <div class="detail">
            <!-- No sandbox: matches HA's native webpage card; Android WebView
                 renders sandboxed cross-origin pages blank. -->
            <iframe id="frame" referrerpolicy="no-referrer-when-downgrade"
                    allow="fullscreen" allowfullscreen></iframe>
            <div class="hint" id="hint">Tap a headline to open the story here</div>
          </div>
        </div>
      </div>
    `;

    this._tabsEl = this.shadowRoot.getElementById("tabs");
    this._listEl = this.shadowRoot.getElementById("list");
    this._frameEl = this.shadowRoot.getElementById("frame");
    this._hintEl = this.shadowRoot.getElementById("hint");

    this._renderTabs();

    this._tabsEl.addEventListener("click", (e) => {
      const t = e.target.closest(".tab");
      if (!t) return;
      const i = Number(t.dataset.i);
      if (i === this._active) return;
      this._active = i;
      this._autoPick = true;   // show the newest story of the channel you switch to
      this._renderTabs();
      this._sig = null; // force list rebuild
      this._updateList();
    });

    this._listEl.addEventListener("click", (e) => {
      const spk = e.target.closest(".spk");
      if (spk) {                       // read-aloud button: don't also open the story
        e.stopPropagation();
        this._toggleRead(spk.dataset.spk);
        return;
      }
      const row = e.target.closest(".item");
      if (!row || !row.dataset.url) return;
      this._select(row.dataset.url, row);
    });

    if (this._selectedUrl) this._loadDetail(this._selectedUrl);
  }

  _renderTabs() {
    if (this._channels.length < 2) {
      this._tabsEl.hidden = true;
      return;
    }
    this._tabsEl.innerHTML = this._channels
      .map(
        (ch, i) =>
          `<div class="tab${i === this._active ? " on" : ""}" data-i="${i}">${ESC(ch.label)}</div>`
      )
      .join("");
  }

  _select(url, row) {
    this._selectedUrl = url;
    this._listEl.querySelectorAll(".item.sel").forEach((n) => n.classList.remove("sel"));
    if (row) row.classList.add("sel");
    this._loadDetail(url);
    // Publish the selection so HA-side read-aloud knows which story is showing.
    if (this._config.select_helper && this._hass) {
      try {
        this._hass.callService("input_text", "set_value", {
          entity_id: this._config.select_helper,
          value: url,
        });
      } catch (e) {
        /* helper not present yet — ignore */
      }
    }
  }

  _loadDetail(url) {
    if (!url) return;
    this._hintEl.hidden = true;
    if (this._frameEl.src !== url) this._frameEl.src = url;
  }

  // Per-row read-aloud: tap to read this story; tap the glowing one to stop.
  _toggleRead(url) {
    const cfg = this._config;
    if (!cfg.tts_player || !this._hass || !url) return;
    const st = this._hass.states[cfg.tts_player];
    const playing = st && st.state === "playing";
    if (this._readingUrl === url && playing) {
      this._hass.callService("media_player", "media_stop", { entity_id: cfg.tts_player });
      this._readingUrl = null;
    } else {
      const dot = String(cfg.tts_service).indexOf(".");
      const dom = cfg.tts_service.slice(0, dot);
      const svc = cfg.tts_service.slice(dot + 1);
      this._hass.callService(dom, svc, { player: cfg.tts_player, url });
      this._readingUrl = url;
    }
    this._refreshSpeakers();
  }

  _refreshSpeakers() {
    if (!this._listEl) return;
    this._listEl.querySelectorAll(".spk").forEach((b) => {
      b.classList.toggle("reading", b.dataset.spk === this._readingUrl);
    });
  }

  // ---- data / list --------------------------------------------------------
  _entries(entId, warn) {
    const st = this._hass && this._hass.states[entId];
    const out = [];
    if (!st || !Array.isArray(st.attributes.entries)) return out;
    for (const e of st.attributes.entries) {
      if (!e || !e.title || !e.link) continue;
      const ts = e.published ? Date.parse(e.published) : NaN;
      out.push({ title: e.title, url: e.link, ts: isNaN(ts) ? 0 : ts, warn });
    }
    out.sort((a, b) => b.ts - a.ts);
    return out;
  }

  _row(i) {
    const sel = i.url === this._selectedUrl ? " sel" : "";
    const warn = i.warn ? " warn" : "";
    const flag = i.warn ? "⚠ " : "";
    // Speaker button on story rows only, when a tts_player is configured.
    const spk =
      this._config.tts_player && !i.warn
        ? `<button class="spk${i.url === this._readingUrl ? " reading" : ""}" ` +
          `data-spk="${ESC(i.url)}" title="Read this story aloud">${SPK_SVG}</button>`
        : "";
    return (
      `<div class="item${warn}${sel}" data-url="${ESC(i.url)}" data-ts="${i.ts}">` +
      `<div class="itxt">` +
      `<span class="t">${flag}${ESC(i.title)}</span>` +
      `<span class="meta" data-rel>${REL(i.ts)}</span>` +
      `</div>` +
      spk +
      `</div>`
    );
  }

  _updateList() {
    if (!this._listEl) return;
    const ch = this._channels[this._active];
    const warns = this._config.warnings_entity
      ? this._entries(this._config.warnings_entity, true)
      : [];
    const stories = this._entries(ch.entity, false);

    const sig =
      this._active +
      "::" +
      warns.map((w) => w.url).join("|") +
      "||" +
      stories.map((s) => s.url).join("|");
    if (sig === this._sig) {
      this._refreshTimes();
      return;
    }
    this._sig = sig;

    let html = "";
    if (warns.length) {
      html += `<div class="sechdr">Weather warnings</div>`;
      html += warns.map((w) => this._row(w)).join("");
      html += `<div class="sechdr">${ESC(ch.label)}</div>`;
    }
    if (stories.length) {
      html += stories.map((s) => this._row(s)).join("");
    } else if (!warns.length) {
      html += `<div class="empty">No headlines yet…</div>`;
    }
    this._listEl.innerHTML = html;
    this._listEl.scrollTop = 0;

    if (this._config.open_newest_on_load && this._autoPick && stories[0]) {
      this._autoPick = false;   // don't hijack the pane once the user clicks around
      const first = this._listEl.querySelector('.item:not(.warn)');
      this._select(stories[0].url, first);
    }
  }

  _refreshTimes() {
    if (!this._listEl) return;
    this._listEl.querySelectorAll(".item").forEach((row) => {
      const rel = row.querySelector("[data-rel]");
      if (rel) rel.textContent = REL(Number(row.dataset.ts));
    });
  }

  // ---- height: fill down to the bottom of the screen, no further ----------
  _fit() {
    const wrap = this.shadowRoot && this.shadowRoot.querySelector(".wrap");
    if (!wrap) return;
    const top = this.getBoundingClientRect().top;
    const gap = Number(this._config.bottom_gap) || 0;
    const h = Math.max(220, Math.floor(window.innerHeight - top - gap));
    wrap.style.height = h + "px";
  }
}

customElements.define("news-reader-card", NewsReaderCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "news-reader-card",
  name: "News Reader Card",
  description: "Channel tabs + news list + webpage viewer (Kiwi style)",
});
console.info("%c NEWS-READER-CARD ", "background:#00A1E4;color:#000;font-weight:700;");
