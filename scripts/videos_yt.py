#!/usr/bin/env python3
"""Arma docs/videos.json con los videos del canal de YouTube.

- "videos": los últimos 6 del feed RSS público del canal (automáticos).
- "destacados": los videos fijados a mano en docs/videos-destacados.json
  (se editan desde Pages CMS pegando la URL o el ID). Se completan con título,
  fecha y miniatura: primero desde el feed (si está entre los últimos 15) y si
  no, desde oEmbed (sin API key; no trae fecha).

Sin API key ni dependencias. Las miniaturas se descargan acá (en el Action) y
se publican desde docs/videos/, así los visitantes nunca piden nada a
i.ytimg.com. La salida es determinista: si no hay cambios, el workflow no
commitea.
"""
import json
import os
import pathlib
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

CHANNEL_ID = "UCE47eMLfPfZK5Dqa8SGking"  # @profe.lucasramosuy
FEED = os.environ.get("YT_FEED_URL", f"https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}")
OEMBED = os.environ.get("YT_OEMBED_URL", "https://www.youtube.com/oembed")
THUMB = os.environ.get("YT_THUMB_URL", "https://i.ytimg.com/vi/{id}/hqdefault.jpg")
MAX_AUTO = 6
MAX_PINNED = 6
DOCS = pathlib.Path(__file__).resolve().parent.parent / "docs"
NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}
ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "profe-videos/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def video_id(texto):
    """Saca el ID de una URL (watch, youtu.be, shorts, embed, live) o de un ID pelado."""
    t = (texto or "").strip()
    if ID_RE.match(t):
        return t
    u = urllib.parse.urlparse(t if "://" in t else "https://" + t)
    host = (u.hostname or "").lower()
    if host.endswith("youtu.be"):
        cand = u.path.strip("/").split("/")[0]
    elif host.endswith("youtube.com") or host.endswith("youtube-nocookie.com"):
        partes = [p for p in u.path.split("/") if p]
        if partes and partes[0] in ("shorts", "embed", "live", "v") and len(partes) > 1:
            cand = partes[1]
        else:
            cand = urllib.parse.parse_qs(u.query).get("v", [""])[0]
    else:
        return None
    return cand if ID_RE.match(cand) else None


def leer_feed():
    root = ET.fromstring(get(FEED))
    out = []
    for e in root.findall("a:entry", NS):
        vid = e.findtext("yt:videoId", namespaces=NS)
        if not vid or not ID_RE.match(vid):
            continue
        out.append({
            "id": vid,
            "titulo": (e.findtext("a:title", namespaces=NS) or "").strip(),
            "fecha": (e.findtext("a:published", namespaces=NS) or "")[:10],
        })
    return out


def leer_destacados():
    f = DOCS / "videos-destacados.json"
    if not f.exists():
        return []
    data = json.loads(f.read_text(encoding="utf-8") or "{}")
    items = data.get("videos", []) if isinstance(data, dict) else data
    ids = []
    for it in items:
        raw = it.get("url") if isinstance(it, dict) else it
        vid = video_id(raw)
        if not vid:
            print(f"::warning::Destacado ignorado, no es una URL o ID de YouTube: {raw!r}")
        elif vid not in ids:
            ids.append(vid)
    return ids[:MAX_PINNED]


def enriquecer(vid, feed_por_id):
    if vid in feed_por_id:
        return feed_por_id[vid]
    try:
        url = f"{OEMBED}?" + urllib.parse.urlencode(
            {"url": f"https://www.youtube.com/watch?v={vid}", "format": "json"})
        titulo = json.loads(get(url)).get("title", "").strip()
    except Exception as exc:
        print(f"::warning::Destacado {vid} no se pudo leer (¿privado, borrado o mal escrito?): {exc}")
        return None
    return {"id": vid, "titulo": titulo, "fecha": ""}


def main():
    feed = leer_feed()
    feed_por_id = {v["id"]: v for v in feed}
    auto = feed[:MAX_AUTO]
    destacados = [d for d in (enriquecer(i, feed_por_id) for i in leer_destacados()) if d]

    out = DOCS / "videos"
    out.mkdir(exist_ok=True)
    todos = {v["id"] for v in auto} | {v["id"] for v in destacados}
    for vid in todos:
        f = out / f"{vid}.jpg"
        if not f.exists():
            f.write_bytes(get(THUMB.format(id=vid)))
    for f in out.glob("*.jpg"):
        if f.stem not in todos:
            f.unlink()

    data = json.dumps({"canal": f"https://www.youtube.com/channel/{CHANNEL_ID}",
                       "destacados": destacados, "videos": auto},
                      ensure_ascii=False, indent=2) + "\n"
    (DOCS / "videos.json").write_text(data, encoding="utf-8")
    print(f"{len(destacados)} destacados, {len(auto)} automáticos")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # falla fuerte: el workflow queda en rojo y no pisa nada
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)
