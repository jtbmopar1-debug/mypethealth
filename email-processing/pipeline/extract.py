"""Deterministic, extractive knowledge creation and consolidation."""

from __future__ import annotations

import re
from collections import Counter
from typing import Any, Iterable


CATEGORIES: dict[str, tuple[str, ...]] = {
    "skin_and_itching": ("itch", "scratch", "skin", "coat", "ear", "rash"),
    "allergies_and_sensitivities": ("allerg", "sensitive", "intoler", "hypoallergenic"),
    "digestive_issues": ("stomach", "digest", "vomit", "gas", "gut"),
    "diarrhoea_and_stool_changes": ("diarr", "stool", "poo", "bowel", "constipat"),
    "protein_selection": ("protein", "chicken", "beef", "lamb", "fish", "venison", "turkey"),
    "feeding_amounts": ("how much", "feeding guide", "grams", "cups", "portion"),
    "food_transitioning": ("transition", "switch", "change food", "new food"),
    "puppies": ("puppy", "pup", "growth", "weaning"),
    "senior_dogs": ("senior", "older dog", "ageing", "aging"),
    "weight_management": ("weight", "overweight", "underweight", "gain", "lose weight"),
    "picky_eaters": ("picky", "fussy", "won't eat", "will not eat"),
    "ingredients": ("ingredient", "contains", "preservative", "grain", "wheat"),
    "product_comparisons": ("difference", "compare", "versus", " vs "),
    "delivery": ("delivery", "shipping", "courier", "freight"),
    "subscriptions": ("subscription", "recurring", "cancel", "frequency"),
    "storage": ("storage", "store", "shelf life", "freezer", "refriger"),
}
MEDICAL_REVIEW = re.compile(r"\b(cure|diagnos|disease|pancreatitis|liver failure|kidney|medication|prescription|dose)\b", re.I)
SAFETY_TERMS = re.compile(r"\b(vet|veterinar|urgent|severe|persistent|blood|letharg|medication)\b", re.I)
REASON_TERMS = re.compile(r"\b(because|which means|so that|therefore|due to|the reason|recommend|suggest|try)\b", re.I)
WORD = re.compile(r"[a-z0-9]+")
STOP_WORDS = {"about", "after", "again", "also", "and", "are", "but", "can", "for", "from", "have", "into", "not", "that", "the", "their", "they", "this", "was", "what", "when", "with", "would", "your"}


def split_sentences(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+|\n+", text) if len(part.strip()) >= 10]


def excerpt(text: str, sentence_limit: int = 4, character_limit: int = 900) -> str:
    selected = " ".join(split_sentences(text)[:sentence_limit]).strip()
    if len(selected) > character_limit:
        selected = selected[:character_limit].rsplit(" ", 1)[0] + "…"
    return selected


def genericise_customer_text(text: str) -> str:
    value = excerpt(text, sentence_limit=3, character_limit=650)
    value = re.sub(r"^(?:Hi|Hello|Dear|Kia ora)\s*[,!]?\s*", "", value, flags=re.I)
    replacements = [
        (r"\bmy dog\b", "the customer's dog"),
        (r"\bmy puppy\b", "the customer's puppy"),
        (r"\bmy cat\b", "the customer's cat"),
        (r"\bI have\b", "the customer has"),
        (r"\bI am\b", "the customer is"),
        (r"\bI'm\b", "the customer is"),
        (r"\bI need\b", "the customer needs"),
        (r"\bI would like\b", "the customer would like"),
        (r"\bI\b", "the customer"),
        (r"\bwe\b", "the customer",),
    ]
    for pattern, replacement in replacements:
        value = re.sub(pattern, replacement, value, flags=re.I)
    return value[:1].upper() + value[1:] if value else value


def category_for(text: str) -> str:
    lowered = text.lower()
    scores = {category: sum(lowered.count(term) for term in terms) for category, terms in CATEGORIES.items()}
    best, score = max(scores.items(), key=lambda item: item[1])
    return best if score else "other"


def tags_for(text: str, category: str) -> list[str]:
    tokens = [token for token in WORD.findall(text.lower()) if len(token) > 3 and token not in STOP_WORDS]
    common = [token for token, _ in Counter(tokens).most_common(8)]
    return list(dict.fromkeys([category.replace("_", "-"), *common]))[:10]


def product_mentions(text: str, config: dict[str, Any]) -> tuple[list[str], list[str]]:
    known: list[str] = []
    for product in config.get("known_products", []):
        if re.search(rf"\b{re.escape(product)}\b", text, re.I):
            known.append(product)

    unresolved: list[str] = []
    brands = config.get("product_brands", [])
    if brands:
        brand_pattern = "|".join(re.escape(item) for item in brands)
        for match in re.finditer(rf"\b(?:{brand_pattern})\s+[A-Z][A-Za-z0-9&+\-/ ]{{2,55}}", text):
            candidate = re.split(r"[.!?\n]", match.group(0))[0].strip()
            if not any(candidate.lower().startswith(item.lower()) for item in known):
                unresolved.append(candidate)
    return list(dict.fromkeys(known)), list(dict.fromkeys(unresolved))


def context_fields(text: str) -> list[str]:
    checks = [
        (r"\b(?:chicken|beef|lamb|fish|venison|turkey|protein)\b", "Current food and main protein"),
        (r"\b(?:day|week|month|year|since|started)\b", "Duration of the concern"),
        (r"\b(?:kg|kilo|weight|overweight|underweight)\b", "Current and ideal weight"),
        (r"\b(?:puppy|senior|years? old|months? old|age)\b", "Age or life stage"),
        (r"\b(?:tried|previous|before|changed|switch)\b", "Foods or proteins previously tried"),
        (r"\b(?:vomit|blood|letharg|ear|stool|diarr)\b", "Other symptoms"),
    ]
    return [label for pattern, label in checks if re.search(pattern, text, re.I)]


def create_candidate(customer_text: str, reply_text: str, config: dict[str, Any], source_key: str) -> tuple[dict[str, Any], list[str]]:
    combined = f"{customer_text}\n{reply_text}"
    category = category_for(combined)
    questions = [sentence for sentence in split_sentences(reply_text) if sentence.endswith("?")][:5]
    reasoning_sentences = [sentence for sentence in split_sentences(reply_text) if REASON_TERMS.search(sentence)]
    safety_sentences = [sentence for sentence in split_sentences(reply_text) if SAFETY_TERMS.search(sentence)]
    known_products, unresolved_products = product_mentions(reply_text, config)
    customer_summary = genericise_customer_text(customer_text)
    guidance = excerpt(reply_text, sentence_limit=6, character_limit=1200)
    reasons: list[str] = []
    if len(customer_text) < int(config.get("minimum_customer_text_length", 35)):
        reasons.append("incomplete_customer_context")
    if len(reply_text) < int(config.get("minimum_reply_text_length", 35)):
        reasons.append("incomplete_business_reply")
    if unresolved_products:
        reasons.append("uncertain_product_name")
    if MEDICAL_REVIEW.search(reply_text):
        reasons.append("medical_or_veterinary_claim_review")

    confidence = "high" if not reasons and reasoning_sentences else "medium"
    if len(customer_text) < 20 or len(reply_text) < 20:
        confidence = "low"

    entry: dict[str, Any] = {
        "id": source_key,
        "category": category,
        "customer_question": customer_summary,
        "situation": customer_summary,
        "useful_context": context_fields(combined),
        "follow_up_questions": questions,
        "all_good_guidance": guidance,
        "reasoning": excerpt(" ".join(reasoning_sentences), 3, 600),
        "relevant_product_names": known_products,
        "safety_notes": excerpt(" ".join(safety_sentences), 3, 500),
        "tags": tags_for(combined, category),
        "source_count": 1,
        "confidence": confidence,
    }
    return entry, reasons


def _token_set(entry: dict[str, Any]) -> set[str]:
    value = f"{entry['customer_question']} {entry['all_good_guidance']}"
    return {token for token in WORD.findall(value.lower()) if len(token) > 3 and token not in STOP_WORDS}


def similarity(left: dict[str, Any], right: dict[str, Any]) -> float:
    left_tokens, right_tokens = _token_set(left), _token_set(right)
    union = left_tokens | right_tokens
    return len(left_tokens & right_tokens) / len(union) if union else 0.0


def consolidate(entries: Iterable[dict[str, Any]], threshold: float) -> list[dict[str, Any]]:
    consolidated: list[dict[str, Any]] = []
    for entry in entries:
        match = next(
            (
                existing
                for existing in consolidated
                if existing["category"] == entry["category"] and similarity(existing, entry) >= threshold
            ),
            None,
        )
        if match is None:
            consolidated.append(entry.copy())
            continue
        match["source_count"] += entry["source_count"]
        for field in ("useful_context", "follow_up_questions", "relevant_product_names", "tags"):
            match[field] = list(dict.fromkeys([*match[field], *entry[field]]))
        if len(entry["all_good_guidance"]) > len(match["all_good_guidance"]):
            match["all_good_guidance"] = entry["all_good_guidance"]
        if entry["reasoning"] and len(entry["reasoning"]) > len(match["reasoning"]):
            match["reasoning"] = entry["reasoning"]
        if entry["safety_notes"]:
            match["safety_notes"] = " ".join(dict.fromkeys([match["safety_notes"], entry["safety_notes"]])).strip()
        if entry["confidence"] != "high":
            match["confidence"] = entry["confidence"]
    for index, entry in enumerate(consolidated, start=1):
        entry["id"] = f"kb_{index:06d}"
    return consolidated
