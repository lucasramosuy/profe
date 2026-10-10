#!/usr/bin/env python3
"""Baja el feed RSS público del canal de YouTube y escribe docs/videos.json.

Sin API key, sin dependencias. Las miniaturas se descargan acá (en el Action)
y se publican desde docs/videos/, así los visitantes nunca piden nada a
i.ytimg.com. La salida es determinista: si no hay videos nuevos, no cambia
nada y el workflow no commitea.
"""
import json
import pathlib
import sys
import urllib.request
import xml.etree.ElementTree as ET

CHANNEL_ID = "UCE47eMLfPfZK5Dqa8SGking"  # @profe.lucasramosuy
FEED = f"https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}"
MAX = 6
DOCS = pathlib.Path(__file__).resolve().parent.parent / "docs"
NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "profe-videos/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def main():
    root = ET.fromstring(get(FEED))
    videos = []
    for e in root.findall("a:entry", NS)[:MAX]:
        vid = e.findtext("yt:videoId", namespaces=NS)
        if not vid or not all(c.isalnum() or c in "-_" for c in vid):
            continue
        videos.append({
            "id": vid,
            "titulo": (e.findtext("a:title", namespaces=NS) or "").strip(),
            "fecha": (e.findtext("a:published", namespaces=NS) or "")[:10],
        })

    out = DOCS / "videos"
    out.mkdir(exist_ok=True)
    for v in videos:
        f = out / f"{v['id']}.jpg"
        if not f.exists():
            f.write_bytes(get(f"https://i.ytimg.com/vi/{v['id']}/hqdefault.jpg"))
    keep = {f"{v['id']}.jpg" for v in videos}
    for f in out.glob("*.jpg"):
        if f.name not in keep:
            f.unlink()

    data = json.dumps({"canal": f"https://www.youtube.com/channel/{CHANNEL_ID}",
                       "videos": videos}, ensure_ascii=False, indent=2) + "\n"
    (DOCS / "videos.json").write_text(data, encoding="utf-8")
    print(f"{len(videos)} videos")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # falla fuerte: el workflow queda en rojo y no pisa nada
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)
