"""MIME decoding and conservative email body cleanup."""

from __future__ import annotations

import html
import re
from email.header import decode_header
from email.message import Message
from html.parser import HTMLParser


class _TextExtractor(HTMLParser):
    BLOCK_TAGS = {"br", "p", "div", "li", "tr", "h1", "h2", "h3", "h4", "blockquote"}
    SKIP_TAGS = {"script", "style", "head", "title"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        del attrs
        if tag in self.SKIP_TAGS:
            self.skip_depth += 1
        elif tag in self.BLOCK_TAGS and not self.skip_depth:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in self.SKIP_TAGS and self.skip_depth:
            self.skip_depth -= 1
        elif tag in self.BLOCK_TAGS and not self.skip_depth:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.skip_depth:
            self.parts.append(data)


def html_to_text(value: str) -> str:
    parser = _TextExtractor()
    parser.feed(value)
    text = html.unescape("".join(parser.parts))
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def decode_header_value(value: str | None) -> str:
    if not value:
        return ""
    decoded: list[str] = []
    for part, charset in decode_header(value):
        if isinstance(part, bytes):
            try:
                decoded.append(part.decode(charset or "utf-8", errors="replace"))
            except LookupError:
                decoded.append(part.decode("utf-8", errors="replace"))
        else:
            decoded.append(part)
    return "".join(decoded).strip()


def _decode_payload(part: Message) -> str:
    payload = part.get_payload(decode=True)
    if payload is None:
        raw = part.get_payload()
        return raw if isinstance(raw, str) else ""
    charset = part.get_content_charset() or "utf-8"
    try:
        return payload.decode(charset, errors="replace")
    except LookupError:
        return payload.decode("utf-8", errors="replace")


def extract_body(message: Message) -> str:
    plain_parts: list[str] = []
    html_parts: list[str] = []
    parts = message.walk() if message.is_multipart() else [message]
    for part in parts:
        if part.is_multipart():
            continue
        disposition = (part.get("Content-Disposition") or "").lower()
        if "attachment" in disposition:
            continue
        content_type = part.get_content_type()
        if content_type == "text/plain":
            plain_parts.append(_decode_payload(part))
        elif content_type == "text/html":
            html_parts.append(html_to_text(_decode_payload(part)))
    selected = "\n".join(plain_parts).strip() or "\n".join(html_parts).strip()
    return normalize_whitespace(selected)


def remove_quoted_reply(value: str) -> str:
    cut_markers = [
        r"^On .{0,180} wrote:\s*$",
        r"^-{2,}\s*Original Message\s*-{2,}$",
        r"^_{5,}$",
        r"^Begin forwarded message:$",
    ]
    marker = re.compile("|".join(f"(?:{item})" for item in cut_markers), re.I | re.M)
    match = marker.search(value)
    if match:
        value = value[: match.start()]
    lines = [line for line in value.splitlines() if not line.lstrip().startswith(">")]
    return normalize_whitespace("\n".join(lines))


def remove_headers(value: str) -> str:
    header = re.compile(
        r"^(?:From|To|Cc|Bcc|Date|Sent|Subject|Message-ID|Return-Path|Reply-To|Delivered-To|Received):.*$",
        re.I,
    )
    return normalize_whitespace("\n".join(line for line in value.splitlines() if not header.match(line.strip())))


def remove_signature(value: str) -> str:
    signature = re.compile(
        r"^(?:--\s*$|kind regards\b|warm regards\b|best regards\b|regards\b|many thanks\b|thanks[,]?\s*$|cheers[,]?\s*$|sent from my\b)",
        re.I,
    )
    kept: list[str] = []
    for line in value.splitlines():
        if signature.match(line.strip()):
            break
        kept.append(line)
    return normalize_whitespace("\n".join(kept))


def clean_body(value: str) -> str:
    value = remove_quoted_reply(value)
    value = remove_headers(value)
    value = remove_signature(value)
    return normalize_whitespace(value)


def normalize_whitespace(value: str) -> str:
    value = value.replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n[ \t]+", "\n", value)
    return re.sub(r"\n{3,}", "\n\n", value).strip()
