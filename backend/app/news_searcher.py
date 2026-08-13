from __future__ import annotations

import logging
import os
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import List

logger = logging.getLogger("news_searcher")


@dataclass(frozen=True)
class NewsSearchItem:
    title: str
    link: str
    snippet: str
    pub_date: str
    source_name: str


def _strip_html(text: str) -> str:
    if not text:
        return ""
    clean = re.sub(r"<[^>]+>", "", text)
    return " ".join(clean.split())


def _search_google_news_rss(query: str, limit: int = 5) -> List[NewsSearchItem]:
    encoded = urllib.parse.quote(query)
    url = f"https://news.google.com/rss/search?q={encoded}&hl=ko&gl=KR&ceid=KR:ko"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
    )

    try:
        with urllib.request.urlopen(req, timeout=6) as response:
            xml_data = response.read()
            root = ET.fromstring(xml_data)
            items = root.findall(".//item")[:limit]

            results = []
            for item in items:
                title_elem = item.find("title")
                link_elem = item.find("link")
                pub_date_elem = item.find("pubDate")
                desc_elem = item.find("description")
                source_elem = item.find("source")

                raw_title = title_elem.text if title_elem is not None and title_elem.text else ""
                clean_title = _strip_html(raw_title)

                source_name = "Google News"
                if source_elem is not None and source_elem.text:
                    source_name = source_elem.text.strip()
                elif " - " in clean_title:
                    parts = clean_title.rsplit(" - ", 1)
                    clean_title = parts[0].strip()
                    source_name = parts[1].strip()

                link = link_elem.text.strip() if link_elem is not None and link_elem.text else ""
                pub_date = pub_date_elem.text.strip() if pub_date_elem is not None and pub_date_elem.text else ""
                snippet = _strip_html(desc_elem.text if desc_elem is not None and desc_elem.text else "")

                if clean_title:
                    results.append(
                        NewsSearchItem(
                            title=clean_title,
                            link=link,
                            snippet=snippet or clean_title,
                            pub_date=pub_date,
                            source_name=source_name,
                        )
                    )
            return results
    except Exception as exc:
        logger.warning("Google News RSS search failed: %s", exc)
        return []


def _search_naver_news_api(
    query: str, client_id: str, client_secret: str, limit: int = 5
) -> List[NewsSearchItem]:
    encoded = urllib.parse.quote(query)
    url = f"https://openapi.naver.com/v1/search/news.json?query={encoded}&display={limit}&sort=sim"
    req = urllib.request.Request(
        url,
        headers={
            "X-Naver-Client-Id": client_id,
            "X-Naver-Client-Secret": client_secret,
            "User-Agent": "Mozilla/5.0",
        },
    )

    try:
        import json

        with urllib.request.urlopen(req, timeout=6) as response:
            data = json.loads(response.read().decode("utf-8"))
            items = data.get("items", [])
            results = []
            for item in items:
                title = _strip_html(item.get("title", ""))
                link = item.get("originallink") or item.get("link", "")
                snippet = _strip_html(item.get("description", ""))
                pub_date = item.get("pubDate", "")
                results.append(
                    NewsSearchItem(
                        title=title,
                        link=link,
                        snippet=snippet,
                        pub_date=pub_date,
                        source_name="네이버 뉴스",
                    )
                )
            return results
    except Exception as exc:
        logger.warning("Naver News API search failed: %s", exc)
        return []


def search_realtime_news(query: str, limit: int = 5) -> List[NewsSearchItem]:
    client_id = os.environ.get("NAVER_CLIENT_ID", "").strip()
    client_secret = os.environ.get("NAVER_CLIENT_SECRET", "").strip()

    if client_id and client_secret:
        naver_results = _search_naver_news_api(query, client_id, client_secret, limit)
        if naver_results:
            return naver_results

    return _search_google_news_rss(query, limit)
