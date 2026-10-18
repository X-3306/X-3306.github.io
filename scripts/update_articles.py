#!/usr/bin/env python3
"""Sync Medium posts into articles.json and the static HTML of the site."""

import html
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FEED = "https://medium.com/feed/@X-3306"
SITE = "https://x-3306.github.io"
NS = {"c": "http://purl.org/rss/1.0/modules/content/"}
LATEST_ON_HOME = 2
SELECTED = (
    "multi-stage maas malware",
    "shifting the edr evasion angle",
    "harvest now, decrypt later",
    "api rate limiting bypass",
)


def wanted(p):
    t = p["title"].lower()
    return any(k in t for k in SELECTED)


def fetch(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (compatible; lab-site-sync/1.0; +https://x-3306.github.io)",
        "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.5",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def text_of(fragment):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def clean_link(link):
    return link.split("?")[0].strip()


def parse(xml_bytes):
    root = ET.fromstring(xml_bytes)
    posts = []
    for it in root.iter("item"):
        title = (it.findtext("title") or "").strip()
        link = clean_link(it.findtext("link") or "")
        if not title or not link:
            continue
        body = it.findtext("c:encoded", default="", namespaces=NS) or ""
        pub = parsedate_to_datetime(it.findtext("pubDate"))
        img = ""
        for m in re.finditer(r'<img[^>]+src="([^"]+)"', body):
            if "/_/stat" not in m.group(1):
                img = m.group(1)
                break
        sub = ""
        h4 = re.search(r"<h4[^>]*>(.*?)</h4>", body, re.S)
        if h4:
            sub = text_of(h4.group(1))
        if not sub:
            for p in re.finditer(r"<p[^>]*>(.*?)</p>", body, re.S):
                t = text_of(p.group(1))
                if len(t) > 40:
                    sub = t
                    break
        if len(sub) > 170:
            sub = sub[:167].rsplit(" ", 1)[0] + "..."
        tags = [text_of(c.text or "") for c in it.findall("category")][:4]
        posts.append({"title": title, "link": link, "date": pub.date().isoformat(),
                      "subtitle": sub, "image": img, "tags": tags})
    return posts


def card(p):
    e = html.escape
    if p["image"]:
        img = f'<span class="post-img"><img src="{e(p["image"])}" alt="" loading="lazy" decoding="async" width="460" height="288" referrerpolicy="no-referrer"></span>'
    else:
        img = f'<span class="post-img ph" aria-hidden="true">{e(p["title"][:1].upper())}</span>'
    nice = __import__("datetime").date.fromisoformat(p["date"]).strftime("%d %b %Y").lstrip("0")
    tags = "".join(f"<li>{e(t)}</li>" for t in p["tags"])
    tags = f'<ul class="tags">{tags}</ul>' if tags else ""
    sub = f'<p>{e(p["subtitle"])}</p>' if p["subtitle"] else ""
    return (f'<article class="post paper tape">{img}<div class="post-body"><time datetime="{p["date"]}">{nice}</time>'
            f'<h3><a href="{e(p["link"])}" target="_blank" rel="noopener noreferrer">{e(p["title"])}</a></h3>{sub}{tags}</div></article>')


def inject(path, marker_a, marker_b, block):
    f = ROOT / path
    s = f.read_text(encoding="utf-8")
    pat = re.compile(re.escape(marker_a) + r".*?" + re.escape(marker_b), re.S)
    if not pat.search(s):
        return
    f.write_text(pat.sub(lambda m: marker_a + "\n" + block + "\n" + marker_b, s), encoding="utf-8")


def main():
    store = ROOT / "articles.json"
    old = json.loads(store.read_text(encoding="utf-8")) if store.exists() else []
    try:
        fresh = parse(fetch(FEED))
    except Exception as exc:  # network, 403, malformed XML
        print(f"warning: could not sync Medium ({exc}); keeping existing data")
        return 0
    merged = {p["link"]: p for p in old if wanted(p)}
    for p in fresh:
        if not wanted(p):
            continue
        merged[p["link"]] = p
    posts = sorted(merged.values(), key=lambda p: p["date"], reverse=True)
    store.write_text(json.dumps(posts, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    empty = '<p class="empty">New articles appear here automatically a few hours after they are published on Medium.</p>'
    all_html = "\n".join(card(p) for p in posts) or empty
    home_html = "\n".join(card(p) for p in posts[:LATEST_ON_HOME]) or empty
    inject("articles.html", "<!--ARTICLES:START-->", "<!--ARTICLES:END-->", all_html)
    inject("index.html", "<!--ARTICLES:START-->", "<!--ARTICLES:END-->", home_html)

    ld = {"@context": "https://schema.org", "@type": "ItemList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "url": p["link"], "name": p["title"]} for i, p in enumerate(posts)]}
    ld_block = '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + "</script>" if posts else ""
    inject("articles.html", "<!--LD:START-->", "<!--LD:END-->", ld_block)

    if posts:  
        sm = ROOT / "sitemap.xml"
        s = sm.read_text(encoding="utf-8")
        for loc in (SITE + "/", SITE + "/articles.html"):
            s = re.sub(r"(<loc>" + re.escape(loc) + r"</loc><lastmod>)[^<]*", lambda m: m.group(1) + posts[0]["date"], s)
        sm.write_text(s, encoding="utf-8")
    print(f"synced {len(posts)} articles ({len(fresh)} from feed)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
