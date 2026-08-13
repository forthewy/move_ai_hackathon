from __future__ import annotations

from dataclasses import dataclass
from html.parser import HTMLParser
import ipaddress
import socket
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener


MAX_RESPONSE_BYTES = 2 * 1024 * 1024
MAX_ARTICLE_CHARS = 60_000
USER_AGENT = "Mozilla/5.0 (compatible; KDLogisticsRiskAnalyzer/1.0)"


@dataclass(frozen=True)
class FetchedArticle:
    url: str
    title: str
    body: str


def _validate_public_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("올바른 http 또는 https 기사 URL을 입력하세요.")

    try:
        default_port = 443 if parsed.scheme == "https" else 80
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or default_port)
    except socket.gaierror as exc:
        raise ValueError("기사 URL의 호스트를 찾을 수 없습니다.") from exc

    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            raise ValueError("공개 인터넷의 기사 URL만 사용할 수 있습니다.")


class _SafeRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        redirected_url = urljoin(req.full_url, newurl)
        _validate_public_url(redirected_url)
        return super().redirect_request(req, fp, code, msg, headers, redirected_url)


class _ArticleHTMLParser(HTMLParser):
    BLOCK_TAGS = {
        "article", "blockquote", "br", "div", "figcaption", "h1", "h2", "h3",
        "h4", "h5", "h6", "li", "main", "p", "section",
    }
    SKIP_TAGS = {"script", "style", "noscript", "svg", "template"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.text_parts: list[str] = []
        self._in_title = False
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        tag = tag.lower()
        if tag in self.SKIP_TAGS:
            self._skip_depth += 1
        if tag == "title":
            self._in_title = True
        if tag in self.BLOCK_TAGS and self._skip_depth == 0:
            self.text_parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag == "title":
            self._in_title = False
        if tag in self.SKIP_TAGS and self._skip_depth:
            self._skip_depth -= 1
        if tag in self.BLOCK_TAGS and self._skip_depth == 0:
            self.text_parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip_depth or not data.strip():
            return
        if self._in_title:
            self.title_parts.append(data.strip())
        self.text_parts.append(data.strip())


def _normalize_text(parts: list[str]) -> str:
    lines = []
    for line in " ".join(parts).splitlines():
        normalized = " ".join(line.split())
        if normalized:
            lines.append(normalized)
    return "\n".join(lines)


def fetch_article(url: str) -> FetchedArticle:
    normalized_url = url.strip()
    _validate_public_url(normalized_url)
    request = Request(
        normalized_url,
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
    )

    try:
        with build_opener(_SafeRedirectHandler()).open(request, timeout=12) as response:
            content_type = response.headers.get_content_type()
            if content_type not in {"text/html", "application/xhtml+xml", "text/plain"}:
                raise ValueError("HTML 또는 텍스트 형식의 기사 URL만 사용할 수 있습니다.")
            raw = response.read(MAX_RESPONSE_BYTES + 1)
            if len(raw) > MAX_RESPONSE_BYTES:
                raise ValueError("기사 페이지가 너무 큽니다.")
            charset = response.headers.get_content_charset() or "utf-8"
            html = raw.decode(charset, errors="replace")
            final_url = response.geturl()
    except HTTPError as exc:
        raise ValueError(f"기사 페이지를 가져오지 못했습니다. (HTTP {exc.code})") from exc
    except URLError as exc:
        raise ValueError("기사 페이지에 연결할 수 없습니다.") from exc

    parser = _ArticleHTMLParser()
    parser.feed(html)
    body = _normalize_text(parser.text_parts)[:MAX_ARTICLE_CHARS]
    title = " ".join(parser.title_parts).strip()
    if len(body) < 80:
        raise ValueError("기사 본문을 충분히 추출하지 못했습니다. 다른 기사 URL을 사용해 주세요.")

    return FetchedArticle(url=final_url, title=title, body=body)
