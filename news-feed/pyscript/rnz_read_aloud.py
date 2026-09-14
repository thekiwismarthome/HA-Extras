# pyscript service: read the selected RNZ story aloud via TTS.
# Place at:  <config>/pyscript/rnz_read_aloud.py
# Requires: pyscript (HACS) with `allow_all_imports: true`, and Home Assistant
#           Cloud (tts.home_assistant_cloud).
#
# NOTE (pyscript gotcha): task.executor can ONLY run plain Python functions, and
# every def in a pyscript file is a compiled pyscript function — so we can't hand
# our own parser to task.executor. Instead we run only the native urllib calls
# (urlopen/read) in the executor thread, and do the (fast) regex parsing inline.
#
# Service:  pyscript.rnz_read_aloud
#   player      (required) media_player entity to speak on (the VACA one)
#   url         (optional) defaults to input_text.rnz_selected_url
#   tts_entity  (optional) defaults to tts.home_assistant_cloud

import urllib.request
import re
import html

MAX_CHARS = 1500  # HA Cloud TTS silently drops long messages (~2000+); stay well under
JUNK = ("{", "}", "scrollbar", "NewsLife", "window.", "function",
        "cookie", "©", "subscribe", "browser")


@service
def rnz_read_aloud(url=None, player=None, tts_entity="tts.home_assistant_cloud"):
    """yaml
name: RNZ read aloud
description: Fetch the selected RNZ story and read the article aloud.
fields:
  player:
    description: media_player entity to speak on (the VACA player)
    required: true
    example: media_player.office_vaca_office_tablet_media_player
  url:
    description: Article URL. Defaults to input_text.rnz_selected_url.
    example: https://www.rnz.co.nz/news/national/12345/slug
  tts_entity:
    description: TTS entity to use.
    example: tts.home_assistant_cloud
"""
    if not url:
        url = state.get("input_text.rnz_selected_url")
    if not url or not str(url).startswith("http"):
        log.warning("rnz_read_aloud: no valid url (input_text.rnz_selected_url empty?)")
        return
    if not player:
        log.warning("rnz_read_aloud: 'player' is required")
        return

    # --- fetch (blocking urllib runs in the executor; native funcs only) ------
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent": "Mozilla/5.0 (Home Assistant RNZ reader)"}
        )
        resp = task.executor(urllib.request.urlopen, req, timeout=20)
        raw = task.executor(resp.read).decode("utf-8", "ignore")
    except Exception as e:  # noqa: BLE001
        log.error("rnz_read_aloud: fetch failed: %s" % e)
        return

    # --- parse inline (fast, native re/html calls) ----------------------------
    # Drop image captions/credits (they live in <figcaption> with nested <p>).
    raw = re.sub(r"(?s)<figcaption[^>]*>.*?</figcaption>", " ", raw)

    m = re.search(r'<meta property="og:title" content="([^"]+)"', raw) or \
        re.search(r"<title>([^<]+)</title>", raw)
    title = html.unescape(m.group(1)).split(" | ")[0].strip() if m else "RNZ story"

    out = []
    for p in re.findall(r"<p[^>]*>(.*?)</p>", raw, re.S):
        t = html.unescape(re.sub(r"<[^>]+>", "", p)).strip()
        if len(t) < 60 or " " not in t:
            continue
        if not re.search(r"[a-z]", t):
            continue
        is_junk = False
        for j in JUNK:                 # pyscript has no generator expressions
            if j in t:
                is_junk = True
                break
        if is_junk:
            continue
        out.append(t)

    body = " ".join(out)
    if len(body) > MAX_CHARS:
        cut = body.rfind(". ", 0, MAX_CHARS)
        body = body[: (cut + 1) if cut > 500 else MAX_CHARS]
    text = ("%s. %s" % (title, body)) if body else title

    # --- speak ----------------------------------------------------------------
    log.info("rnz_read_aloud: speaking %d chars to %s via %s" % (len(text), player, tts_entity))
    try:
        tts.speak(
            entity_id=tts_entity,
            media_player_entity_id=player,
            message=text,
            cache=False,
        )
    except Exception as e:  # noqa: BLE001
        log.error("rnz_read_aloud: tts.speak failed: %s" % e)
