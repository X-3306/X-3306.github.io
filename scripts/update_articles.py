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


def fetch(url):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (compatible; lab-site-sync/1.0; "
                "+https://x-3306.github.io)"
            ),
            "Accept": (
                "application/rss+xml, application/xml;q=0.9, */*;q=0.5"
            ),
        },
    )

    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read()


def text_of(fragment):
    return re.sub(
        r"\s+",
        " ",
        html.unescape(re.sub(r"<[^>]+>", " ", fragment)),
    ).strip()


def clean_link(link):
    return link.split("?")[0].strip()


def parse(xml_bytes):
    root = ET.fromstring(xml_bytes)
    posts = []

    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        link = clean_link(item.findtext("link") or "")

        if not title or not link:
            continue

        body = (
            item.findtext("c:encoded", default="", namespaces=NS) or ""
        )

        pub_date = item.findtext("pubDate")
        if not pub_date:
            raise ValueError(
                f"Missing publication date for article: {title}"
            )

        pub = parsedate_to_datetime(pub_date)

        image = ""
        for match in re.finditer(
            r'<img[^>]+src="([^"]+)"',
            body,
        ):
            if "/_/stat" not in match.group(1):
                image = match.group(1)
                break

        subtitle = ""

        heading = re.search(
            r"<h4[^>]*>(.*?)</h4>",
            body,
            re.S,
        )

        if heading:
            subtitle = text_of(heading.group(1))

        if not subtitle:
            for match in re.finditer(
                r"<p[^>]*>(.*?)</p>",
                body,
                re.S,
            ):
                candidate = text_of(match.group(1))

                if len(candidate) > 40:
                    subtitle = candidate
                    break

        if len(subtitle) > 170:
            subtitle = subtitle[:167].rsplit(" ", 1)[0] + "..."

        tags = [
            text_of(category.text or "")
            for category in item.findall("category")
        ][:4]

        posts.append(
            {
                "title": title,
                "link": link,
                "date": pub.date().isoformat(),
                "subtitle": subtitle,
                "image": image,
                "tags": tags,
            }
        )

    return posts


def card(post):
    escape = html.escape

    if post["image"]:
        image_html = (
            '<span class="post-img">'
            f'<img src="{escape(post["image"])}" '
            'alt="" loading="lazy" decoding="async" '
            'width="460" height="288" '
            'referrerpolicy="no-referrer">'
            "</span>"
        )
    else:
        image_html = (
            '<span class="post-img ph" aria-hidden="true">'
            f'{escape(post["title"][:1].upper())}'
            "</span>"
        )

    nice_date = (
        __import__("datetime")
        .date.fromisoformat(post["date"])
        .strftime("%d %b %Y")
        .lstrip("0")
    )

    tags_html = "".join(
        f"<li>{escape(tag)}</li>"
        for tag in post["tags"]
    )

    if tags_html:
        tags_html = f'<ul class="tags">{tags_html}</ul>'

    subtitle_html = (
        f'<p>{escape(post["subtitle"])}</p>'
        if post["subtitle"]
        else ""
    )

    return (
        '<article class="post paper tape">'
        f"{image_html}"
        '<div class="post-body">'
        f'<time datetime="{post["date"]}">{nice_date}</time>'
        "<h3>"
        f'<a href="{escape(post["link"])}" '
        'target="_blank" rel="noopener noreferrer">'
        f'{escape(post["title"])}'
        "</a>"
        "</h3>"
        f"{subtitle_html}"
        f"{tags_html}"
        "</div>"
        "</article>"
    )


def inject(path, marker_a, marker_b, block):
    file_path = ROOT / path
    content = file_path.read_text(encoding="utf-8")

    pattern = re.compile(
        re.escape(marker_a) + r".*?" + re.escape(marker_b),
        re.S,
    )

    if not pattern.search(content):
        print(
            f"warning: markers not found in {path}: "
            f"{marker_a} / {marker_b}",
            file=sys.stderr,
        )
        return False

    updated = pattern.sub(
        lambda match: (
            marker_a + "\n" + block + "\n" + marker_b
        ),
        content,
    )

    file_path.write_text(updated, encoding="utf-8")
    return True


def main():
    store = ROOT / "articles.json"

    old_posts = (
        json.loads(store.read_text(encoding="utf-8"))
        if store.exists()
        else []
    )

    try:
        fresh_posts = parse(fetch(FEED))
    except Exception as exc:
        print(
            f"error: could not sync Medium: {exc}",
            file=sys.stderr,
        )
        return 1

    merged = {
        post["link"]: post
        for post in old_posts
    }

    for post in fresh_posts:
        merged[post["link"]] = post

    posts = sorted(
        merged.values(),
        key=lambda post: post["date"],
        reverse=True,
    )

    store.write_text(
        json.dumps(posts, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    empty_html = (
        '<p class="empty">'
        "New articles appear here automatically a few hours "
        "after they are published on Medium."
        "</p>"
    )

    all_html = "\n".join(card(post) for post in posts) or empty_html

    home_html = (
        "\n".join(card(post) for post in posts[:LATEST_ON_HOME])
        or empty_html
    )

    inject(
        "articles.html",
        "<!--ARTICLES:START-->",
        "<!--ARTICLES:END-->",
        all_html,
    )

    inject(
        "index.html",
        "<!--ARTICLES:START-->",
        "<!--ARTICLES:END-->",
        home_html,
    )

    structured_data = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": index + 1,
                "url": post["link"],
                "name": post["title"],
            }
            for index, post in enumerate(posts)
        ],
    }

    structured_data_html = (
        '<script type="application/ld+json">'
        + json.dumps(structured_data, ensure_ascii=False)
        + "</script>"
        if posts
        else ""
    )

    inject(
        "articles.html",
        "<!--LD:START-->",
        "<!--LD:END-->",
        structured_data_html,
    )

    if posts:
        sitemap = ROOT / "sitemap.xml"
        sitemap_content = sitemap.read_text(encoding="utf-8")

        for url in (SITE + "/", SITE + "/articles.html"):
            sitemap_content = re.sub(
                r"(<loc>"
                + re.escape(url)
                + r"</loc><lastmod>)[^<]*",
                lambda match: match.group(1) + posts[0]["date"],
                sitemap_content,
            )

        sitemap.write_text(
            sitemap_content,
            encoding="utf-8",
        )

    print(
        f"synced {len(posts)} articles "
        f"({len(fresh_posts)} from Medium feed)"
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
