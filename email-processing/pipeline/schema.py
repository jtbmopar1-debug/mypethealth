"""Knowledge schema and local validation helpers."""

from __future__ import annotations

from typing import Any


KNOWLEDGE_FIELDS = {
    "id": str,
    "category": str,
    "customer_question": str,
    "situation": str,
    "useful_context": list,
    "follow_up_questions": list,
    "all_good_guidance": str,
    "reasoning": str,
    "relevant_product_names": list,
    "safety_notes": str,
    "tags": list,
    "source_count": int,
    "confidence": str,
}


def validate_knowledge_entry(entry: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    for field, expected_type in KNOWLEDGE_FIELDS.items():
        if field not in entry:
            errors.append(f"missing:{field}")
        elif not isinstance(entry[field], expected_type):
            errors.append(f"invalid_type:{field}")

    if entry.get("confidence") not in {"high", "medium", "low"}:
        errors.append("invalid_value:confidence")
    if isinstance(entry.get("source_count"), int) and entry["source_count"] < 1:
        errors.append("invalid_value:source_count")
    if not str(entry.get("customer_question", "")).strip():
        errors.append("empty:customer_question")
    if not str(entry.get("all_good_guidance", "")).strip():
        errors.append("empty:all_good_guidance")
    return errors
