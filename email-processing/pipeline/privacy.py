"""Local PII redaction and residual-risk validation."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Detector:
    kind: str
    pattern: re.Pattern[str]
    replacement: str


DETECTORS = [
    Detector("email_address", re.compile(r"\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b", re.I), "[EMAIL REDACTED]"),
    Detector("url", re.compile(r"\b(?:https?://|www\.)\S+", re.I), "[URL REDACTED]"),
    Detector("ip_address", re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"), "[IP REDACTED]"),
    Detector(
        "phone_number",
        re.compile(r"(?<!\w)(?:\+?64[\s().-]?|0)(?:2\d|[3-9])[\s().-]?\d{3}[\s.-]?\d{3,4}(?!\w)"),
        "[PHONE REDACTED]",
    ),
    Detector(
        "postal_address",
        re.compile(
            r"\b\d{1,5}\s+[A-Z0-9][A-Z0-9 .'\-]{1,45}\s+(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl|Way|Terrace|Tce)\b",
            re.I,
        ),
        "[ADDRESS REDACTED]",
    ),
    Detector("postal_address", re.compile(r"\bP\.?O\.?\s+Box\s+\d+\b", re.I), "[ADDRESS REDACTED]"),
    Detector(
        "reference_number",
        re.compile(
            r"\b(?:order|tracking|customer|account|payment|invoice|reference)\s*(?:number|no\.?|#|id)?\s*[:#-]?\s*[A-Z0-9][A-Z0-9-]{4,}\b",
            re.I,
        ),
        "[REFERENCE REDACTED]",
    ),
]

HEADER_PATTERN = re.compile(
    r"^(?:From|To|Cc|Bcc|Message-ID|Return-Path|Reply-To|Delivered-To|Received):",
    re.I | re.M,
)
GREETING_NAME = re.compile(r"^(Hi|Hello|Dear|Kia ora)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s*[,!]?", re.M)
TITLED_NAME = re.compile(r"\b(?:Mr|Mrs|Ms|Miss|Dr)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b")
NAMED_PET = re.compile(
    r"\b((?:(?:my|our|the)\s+)?(?:dog|cat|puppy|kitten|pet)(?:'s name is| is named| is called| named| called))\s+[A-Z][a-z]+\b",
    re.I,
)
ABOUT_NAME = re.compile(r"\b(about|regarding)\s+[A-Z][a-z]{2,}\b")


def sanitise_text(value: str) -> tuple[str, set[str]]:
    found: set[str] = set()
    for detector in DETECTORS:
        if detector.pattern.search(value):
            found.add(detector.kind)
            value = detector.pattern.sub(detector.replacement, value)
    if HEADER_PATTERN.search(value):
        found.add("quoted_email_header")
        value = HEADER_PATTERN.sub("[HEADER REDACTED]:", value)
    if GREETING_NAME.search(value):
        found.add("person_name")
        value = GREETING_NAME.sub(lambda match: f"{match.group(1)},", value)
    if TITLED_NAME.search(value):
        found.add("person_name")
        value = TITLED_NAME.sub("[NAME REDACTED]", value)
    if NAMED_PET.search(value):
        found.add("pet_name")
        value = NAMED_PET.sub(lambda match: f"{match.group(1)} [PET NAME REDACTED]", value)
    if ABOUT_NAME.search(value):
        found.add("possible_name")
        value = ABOUT_NAME.sub(lambda match: f"{match.group(1)} [NAME REDACTED]", value)
    return value.strip(), found


def audit_text(value: str) -> set[str]:
    issues: set[str] = set()
    for detector in DETECTORS:
        if detector.pattern.search(value):
            issues.add(detector.kind)
    if HEADER_PATTERN.search(value):
        issues.add("quoted_email_header")
    if GREETING_NAME.search(value) or TITLED_NAME.search(value) or NAMED_PET.search(value):
        issues.add("possible_person_or_pet_name")
    return issues


def audit_entry(entry: dict[str, Any]) -> list[dict[str, str | bool]]:
    results: list[dict[str, str | bool]] = []
    for field, value in entry.items():
        values = value if isinstance(value, list) else [value]
        for item in values:
            if not isinstance(item, str):
                continue
            for issue in sorted(audit_text(item)):
                results.append(
                    {
                        "knowledge_id": str(entry.get("id", "unassigned")),
                        "field": field,
                        "type": issue,
                        "manual_review_required": True,
                    }
                )
    return results
