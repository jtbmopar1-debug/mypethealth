"""Sender-role and relevance classification."""

from __future__ import annotations

import re
from email.utils import parseaddr
from typing import Any


AUTOMATED_SUBJECTS = re.compile(
    r"\b(order confirmation|order confirmed|shipping confirmation|dispatch notification|payment receipt|invoice|newsletter|unsubscribe|password reset|delivery update|out of office|automatic reply|auto.?reply)\b",
    re.I,
)
AUTOMATED_SENDERS = re.compile(r"\b(no-?reply|mailer-daemon|postmaster|notifications?|newsletter)\b", re.I)
ADVICE_TERMS = re.compile(
    r"\b(dog|cat|puppy|kitten|food|feed|protein|ingredient|itch|skin|stomach|stool|diarr|weight|transition|subscription|delivery|product|treat|allerg|sensitive)\b",
    re.I,
)


def sender_address(from_header: str) -> str:
    return parseaddr(from_header)[1].strip().lower()


def classify_sender(from_header: str, config: dict[str, Any]) -> str:
    address = sender_address(from_header)
    if not address:
        return "unknown"
    configured_addresses = {item.lower() for item in config.get("business_addresses", [])}
    configured_domains = {item.lower().lstrip("@") for item in config.get("business_domains", [])}
    domain = address.rsplit("@", 1)[-1] if "@" in address else ""
    if address in configured_addresses or domain in configured_domains:
        return "business"
    if AUTOMATED_SENDERS.search(address):
        return "automated"
    return "customer"


def classify_relevance(subject: str, body: str, role: str) -> tuple[str, str]:
    if not body.strip():
        return "discarded", "blank"
    if role == "automated" and not ADVICE_TERMS.search(body):
        return "discarded", "automated_sender"
    if AUTOMATED_SUBJECTS.search(subject) and not ADVICE_TERMS.search(body):
        return "discarded", "transactional_or_automated"
    if len(body.strip()) < 20:
        return "discarded", "too_short"
    if not ADVICE_TERMS.search(f"{subject} {body}"):
        return "discarded", "no_business_knowledge_signal"
    return "useful", ""
