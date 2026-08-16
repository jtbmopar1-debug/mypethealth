#!/usr/bin/env python3
"""Import explicitly reviewed, sanitised email knowledge into the chatbot."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

from pipeline.privacy import audit_entry
from pipeline.schema import validate_knowledge_entry


SCRIPT_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_ROOT.parent
DEFAULT_DESTINATION = PROJECT_ROOT / "knowledge" / "email-derived.json"


def runtime_entry(entry: dict[str, Any]) -> dict[str, Any]:
    title_source = entry["situation"] or entry["customer_question"]
    title = re.sub(r"\s+", " ", title_source).strip()[:100]
    content_parts = [entry["all_good_guidance"]]
    if entry["reasoning"]:
        content_parts.append(f"Historical reasoning: {entry['reasoning']}")
    if entry["relevant_product_names"]:
        content_parts.append(f"Historically referenced products: {', '.join(entry['relevant_product_names'])}.")
    return {
        "id": f"email-{entry['id']}",
        "title": title,
        "category": entry["category"].replace("_", "-"),
        "summary": entry["customer_question"],
        "content": " ".join(content_parts),
        "followUpQuestions": entry["follow_up_questions"],
        "safetyNotes": [entry["safety_notes"]] if entry["safety_notes"] else [],
        "tags": entry["tags"],
        "relevantProductTags": [],
        "enabled": True,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Import human-reviewed email knowledge into My Pet Health.")
    parser.add_argument("--input", type=Path, required=True, help="Reviewed generated knowledge.json.")
    parser.add_argument("--destination", type=Path, default=DEFAULT_DESTINATION)
    parser.add_argument(
        "--confirm-reviewed",
        action="store_true",
        help="Required confirmation that a human reviewed accuracy, products, safety, and privacy.",
    )
    args = parser.parse_args()
    if not args.confirm_reviewed:
        parser.error("Refusing to import without --confirm-reviewed.")
    entries = json.loads(args.input.read_text(encoding="utf-8"))
    if not isinstance(entries, list):
        raise ValueError("Knowledge input must be a JSON array.")
    for entry in entries:
        errors = validate_knowledge_entry(entry)
        audit = audit_entry(entry)
        if errors or audit:
            raise ValueError(f"Entry {entry.get('id', 'unknown')} failed validation; import stopped.")
    transformed = [runtime_entry(entry) for entry in entries]
    args.destination.write_text(json.dumps(transformed, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Imported {len(transformed)} reviewed entries into {args.destination}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
