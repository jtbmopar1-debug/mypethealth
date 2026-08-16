"""Incremental, restartable MBOX processor. Raw bodies never leave process memory."""

from __future__ import annotations

import hashlib
import itertools
import json
import logging
import re
import sqlite3
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from email import message_from_bytes
from email.message import Message
from pathlib import Path
from typing import Any, Iterable

from .classifier import classify_relevance, classify_sender
from .extract import consolidate, create_candidate
from .privacy import audit_entry, sanitise_text
from .schema import validate_knowledge_entry
from .text import clean_body, decode_header_value, extract_body


@dataclass
class RunPaths:
    root: Path
    working: Path
    output: Path
    logs: Path
    database: Path
    checkpoint: Path


def _atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(path)


def load_config(path: Path) -> dict[str, Any]:
    config = json.loads(path.read_text(encoding="utf-8"))
    if not config.get("business_domains") and not config.get("business_addresses"):
        raise ValueError("Configure at least one business domain or address before processing.")
    return config


def create_paths(project_root: Path, mode: str) -> RunPaths:
    root = project_root / "email-processing"
    working = root / "working" / mode
    output = root / "output" / mode
    logs = root / "logs"
    working.mkdir(parents=True, exist_ok=True)
    output.mkdir(parents=True, exist_ok=True)
    logs.mkdir(parents=True, exist_ok=True)
    return RunPaths(
        root=root,
        working=working,
        output=output,
        logs=logs,
        database=working / "messages.sqlite3",
        checkpoint=working / "checkpoint.json",
    )


def _connect(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(path)
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS messages (
          source_hash TEXT PRIMARY KEY,
          sequence_number INTEGER NOT NULL,
          thread_key TEXT NOT NULL,
          thread_strength TEXT NOT NULL,
          role TEXT NOT NULL,
          subject TEXT NOT NULL,
          body TEXT NOT NULL,
          status TEXT NOT NULL,
          discard_reason TEXT NOT NULL
        )
        """
    )
    columns = {row[1] for row in connection.execute("PRAGMA table_info(messages)")}
    if "thread_strength" not in columns:
        connection.execute("ALTER TABLE messages ADD COLUMN thread_strength TEXT NOT NULL DEFAULT 'weak'")
    connection.execute("CREATE INDEX IF NOT EXISTS messages_thread_idx ON messages(thread_key, sequence_number)")
    return connection


def _normalise_subject(subject: str) -> str:
    subject = re.sub(r"^(?:re|fw|fwd)\s*:\s*", "", subject, flags=re.I)
    subject = re.sub(r"\s+", " ", subject).strip().lower()
    return subject or "no-subject"


def _thread_key(message: Message, subject: str) -> tuple[str, str]:
    references = decode_header_value(message.get("References"))
    reply_to = decode_header_value(message.get("In-Reply-To"))
    message_id = decode_header_value(message.get("Message-ID"))
    root = references.split()[0] if references else reply_to or message_id
    strength = "strong" if root else "weak"
    root = root or _normalise_subject(subject)
    return hashlib.sha256(root.encode("utf-8", errors="ignore")).hexdigest(), strength


def _source_hash(message: Message, subject: str, body: str) -> str:
    message_id = decode_header_value(message.get("Message-ID"))
    identity = message_id or "|".join(
        [
            subject,
            decode_header_value(message.get("From")),
            decode_header_value(message.get("Date")),
            body[:500],
        ]
    )
    return hashlib.sha256(identity.encode("utf-8", errors="ignore")).hexdigest()


def _default_checkpoint(input_path: Path, mode: str, limit: int | None) -> dict[str, Any]:
    return {
        "version": 1,
        "input_path": str(input_path.resolve()),
        "mode": mode,
        "limit": limit,
        "next_index": 0,
        "byte_offset": 0,
        "processed": 0,
        "customer_messages": 0,
        "business_messages": 0,
        "automated_or_unknown_messages": 0,
        "useful_messages": 0,
        "discarded_messages": 0,
        "failures": 0,
        "complete": False,
        "updated_at": None,
    }


def _setup_logger(paths: RunPaths, mode: str) -> logging.Logger:
    logger = logging.getLogger(f"email_processing.{mode}")
    logger.handlers.clear()
    logger.setLevel(logging.INFO)
    handler = logging.FileHandler(paths.logs / f"{mode}.log", encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(handler)
    return logger


def iter_mbox_stream(
    input_path: Path,
    start_offset: int = 0,
    start_index: int = 0,
) -> Iterable[tuple[int, Message, int]]:
    """Yield one message at a time without building a mailbox-wide offset table."""
    with input_path.open("rb") as source:
        source.seek(start_offset)
        message_lines: list[bytes] = []
        index = start_index
        while True:
            line_start = source.tell()
            line = source.readline()
            if not line:
                if message_lines:
                    yield index, message_from_bytes(b"".join(message_lines)), source.tell()
                return
            if line.startswith(b"From "):
                if message_lines:
                    yield index, message_from_bytes(b"".join(message_lines)), line_start
                    index += 1
                    message_lines = []
                # The MBOX envelope line is not part of the RFC email message.
                continue
            message_lines.append(line)


def ingest_mbox(
    input_path: Path,
    config: dict[str, Any],
    paths: RunPaths,
    limit: int | None,
    resume: bool,
) -> tuple[dict[str, Any], int | None]:
    before = input_path.stat()
    checkpoint = _default_checkpoint(input_path, paths.output.name, limit)
    if resume:
        if not paths.checkpoint.exists():
            raise FileNotFoundError(f"No checkpoint found for {paths.output.name}.")
        checkpoint = json.loads(paths.checkpoint.read_text(encoding="utf-8"))
        if Path(checkpoint["input_path"]).resolve() != input_path.resolve():
            raise ValueError("Checkpoint belongs to a different MBOX file.")

    logger = _setup_logger(paths, paths.output.name)
    connection = _connect(paths.database)
    start_index = int(checkpoint["next_index"])
    start_offset = int(checkpoint.get("byte_offset", 0))
    progress_target = str(limit) if limit is not None else "end of mailbox"
    logger.info("Starting local processing mode=%s start=%d target=%s", paths.output.name, start_index, progress_target)
    reached_eof = False

    try:
        for index, message, next_offset in iter_mbox_stream(input_path, start_offset, start_index):
            if limit is not None and index >= limit:
                break
            try:
                subject_raw = decode_header_value(message.get("Subject"))
                body_raw = clean_body(extract_body(message))
                subject, _ = sanitise_text(subject_raw)
                body, _ = sanitise_text(body_raw)
                role = classify_sender(decode_header_value(message.get("From")), config)
                status, discard_reason = classify_relevance(subject, body, role)
                source_hash = _source_hash(message, subject_raw, body_raw)
                thread_key, thread_strength = _thread_key(message, subject_raw)
                connection.execute(
                    """INSERT OR IGNORE INTO messages
                    (source_hash, sequence_number, thread_key, thread_strength, role, subject, body, status, discard_reason)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (source_hash, index, thread_key, thread_strength, role, subject, body, status, discard_reason),
                )
                checkpoint["processed"] += 1
                if role == "customer":
                    checkpoint["customer_messages"] += 1
                elif role == "business":
                    checkpoint["business_messages"] += 1
                else:
                    checkpoint["automated_or_unknown_messages"] += 1
                checkpoint["useful_messages" if status == "useful" else "discarded_messages"] += 1
            except Exception as error:  # Continue safely; never log message content.
                checkpoint["failures"] += 1
                logger.exception("Message index %d failed: %s", index, type(error).__name__)
            checkpoint["next_index"] = index + 1
            checkpoint["byte_offset"] = next_offset
            if checkpoint["processed"] % 100 == 0:
                connection.commit()
                checkpoint["updated_at"] = datetime.now(timezone.utc).isoformat()
                _atomic_json(paths.checkpoint, checkpoint)
                print(
                    f"Processed: {checkpoint['processed']} / {progress_target} messages | "
                    f"Useful: {checkpoint['useful_messages']} | "
                    f"Discarded: {checkpoint['discarded_messages']} | "
                    f"Failures: {checkpoint['failures']}",
                    flush=True,
                )
            if limit is not None and checkpoint["next_index"] >= limit:
                break
        else:
            reached_eof = True
        connection.commit()
    finally:
        connection.close()

    after = input_path.stat()
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
        raise RuntimeError("The input MBOX changed during processing; outputs require review.")
    checkpoint["complete"] = reached_eof or (limit is not None and checkpoint["next_index"] >= limit)
    checkpoint["updated_at"] = datetime.now(timezone.utc).isoformat()
    _atomic_json(paths.checkpoint, checkpoint)
    total_messages = checkpoint["next_index"] if reached_eof else None
    return checkpoint, total_messages


def _useful_rows(connection: sqlite3.Connection) -> Iterable[tuple[str, str, int, str, str, str]]:
    return connection.execute(
        "SELECT thread_key, thread_strength, sequence_number, role, subject, body FROM messages WHERE status='useful' ORDER BY thread_key, sequence_number"
    )


def _review_item(entry: dict[str, Any], reasons: list[str], privacy_issues: list[dict[str, Any]]) -> dict[str, Any]:
    if privacy_issues:
        return {
            "candidate_id": entry["id"],
            "category": entry["category"],
            "review_reasons": sorted(set([*reasons, "possible_residual_personal_information"])),
            "content_withheld_from_report": True,
        }
    return {"review_reasons": sorted(set(reasons)), "candidate": entry}


def build_outputs(config: dict[str, Any], paths: RunPaths, checkpoint: dict[str, Any], total_messages: int | None) -> dict[str, Any]:
    connection = _connect(paths.database)
    accepted_candidates: list[dict[str, Any]] = []
    review_required: list[dict[str, Any]] = []
    privacy_audit: list[dict[str, Any]] = []
    all_product_mentions: defaultdict[str, list[str]] = defaultdict(list)
    conversations = 0
    candidate_number = 0

    try:
        grouped = itertools.groupby(_useful_rows(connection), key=lambda row: row[0])
        for thread_key, rows_iterator in grouped:
            del thread_key
            rows = list(rows_iterator)
            conversations += 1
            customer_bodies = [row[5] for row in rows if row[3] == "customer"]
            business_bodies = [row[5] for row in rows if row[3] == "business"]
            thread_is_strong = all(row[1] == "strong" for row in rows)
            if customer_bodies and business_bodies:
                candidate_number += 1
                # MBOX exports may be newest-first. Message-ID threading is stronger
                # than file order, so create one conversation candidate from both roles.
                customer_text = "\n".join(customer_bodies[:3])
                reply_text = "\n".join(business_bodies[:3])
                candidate, reasons = create_candidate(customer_text, reply_text, config, f"candidate_{candidate_number:06d}")
                if not thread_is_strong:
                    reasons.append("weak_subject_only_thread_match")
                if candidate["confidence"] != "high":
                    reasons.append("medium_or_low_confidence")
                schema_errors = validate_knowledge_entry(candidate)
                if schema_errors:
                    reasons.extend(schema_errors)
                audit = audit_entry(candidate)
                privacy_audit.extend(audit)
                for product in candidate["relevant_product_names"]:
                    all_product_mentions[product].append(candidate["id"])
                if reasons or audit:
                    review_required.append(_review_item(candidate, reasons, audit))
                else:
                    accepted_candidates.append(candidate)
            elif customer_bodies or business_bodies:
                candidate_number += 1
                withheld_id = f"candidate_{candidate_number:06d}"
                review_required.append(
                    {
                        "candidate_id": withheld_id,
                        "category": "other",
                        "review_reasons": [
                            "incomplete_conversation_no_business_reply"
                            if customer_bodies
                            else "incomplete_conversation_no_customer_question"
                        ],
                        "content_withheld_from_report": True,
                    }
                )
    finally:
        connection.close()

    final_entries = consolidate(
        accepted_candidates,
        float(config.get("duplicate_similarity_threshold", 0.72)),
    )
    final_audit: list[dict[str, Any]] = []
    clean_entries: list[dict[str, Any]] = []
    for entry in final_entries:
        audit = audit_entry(entry)
        if audit:
            final_audit.extend(audit)
            review_required.append(_review_item(entry, ["failed_final_privacy_validation"], audit))
        else:
            clean_entries.append(entry)
    privacy_audit.extend(final_audit)

    final_ids_by_product: defaultdict[str, list[str]] = defaultdict(list)
    for entry in clean_entries:
        for product in entry["relevant_product_names"]:
            final_ids_by_product[product].append(entry["id"])
    products = [
        {
            "product_name": name,
            "mention_count": len(ids),
            "example_knowledge_ids": ids[:10],
            "current_shopify_mapping_unresolved": True,
        }
        for name, ids in sorted(final_ids_by_product.items(), key=lambda item: (-len(item[1]), item[0]))
    ]

    _atomic_json(paths.output / "knowledge.json", clean_entries)
    _atomic_json(paths.output / "review_required.json", review_required)
    _atomic_json(paths.output / "privacy_audit.json", privacy_audit)
    _atomic_json(paths.output / "product_mentions.json", products)
    _write_markdown(clean_entries, paths.output / "knowledge")
    report = _write_report(
        paths,
        checkpoint,
        total_messages,
        conversations,
        candidate_number,
        len(accepted_candidates),
        clean_entries,
        review_required,
        privacy_audit,
        products,
    )
    return report


def _write_markdown(entries: list[dict[str, Any]], directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    by_category: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
    for entry in entries:
        by_category[entry["category"]].append(entry)
    for category, category_entries in by_category.items():
        lines = [f"# {category.replace('_', ' ').title()}", "", "> Generated from anonymised historical conversations. Human review is required before publishing.", ""]
        for entry in category_entries:
            lines.extend(
                [
                    f"## {entry['id']} — {entry['customer_question']}",
                    "",
                    f"**Situation:** {entry['situation']}",
                    "",
                    f"**Guidance:** {entry['all_good_guidance']}",
                    "",
                    f"**Reasoning:** {entry['reasoning'] or 'Not explicit in the source reply.'}",
                    "",
                    f"**Follow-up questions:** {'; '.join(entry['follow_up_questions']) or 'None extracted.'}",
                    "",
                    f"**Products:** {', '.join(entry['relevant_product_names']) or 'None extracted.'}",
                    "",
                    f"**Safety notes:** {entry['safety_notes'] or 'None explicit in the source reply.'}",
                    "",
                    f"**Sources:** {entry['source_count']} · **Confidence:** {entry['confidence']}",
                    "",
                    f"**Tags:** {', '.join(entry['tags'])}",
                    "",
                    "---",
                    "",
                ]
            )
        (directory / f"{category.replace('_', '-')}.md").write_text("\n".join(lines), encoding="utf-8")


def _write_report(
    paths: RunPaths,
    checkpoint: dict[str, Any],
    total_messages: int | None,
    conversations: int,
    candidates: int,
    accepted_before_merge: int,
    entries: list[dict[str, Any]],
    review: list[dict[str, Any]],
    audit: list[dict[str, Any]],
    products: list[dict[str, Any]],
) -> dict[str, Any]:
    categories = Counter(entry["category"] for entry in entries)
    report = {
        "mailbox_total_messages": total_messages,
        "messages_processed_this_dataset": checkpoint["processed"],
        "customer_messages": checkpoint["customer_messages"],
        "all_good_messages": checkpoint["business_messages"],
        "conversations_identified": conversations,
        "irrelevant_messages_discarded": checkpoint["discarded_messages"],
        "knowledge_candidates_extracted": candidates,
        "candidates_accepted_before_consolidation": accepted_before_merge,
        "entries_consolidated": max(0, accepted_before_merge - len(entries)),
        "final_knowledge_entries": len(entries),
        "entries_requiring_review": len(review),
        "suspected_privacy_issues": len(audit),
        "processing_failures": checkpoint["failures"],
        "most_common_categories": categories.most_common(10),
        "most_common_products": [[item["product_name"], item["mention_count"]] for item in products[:10]],
    }
    lines = [
        "# Historical email processing report",
        "",
        "This report contains counts only. It intentionally contains no raw email content or personal information.",
        "",
        f"- Mailbox messages available: {report['mailbox_total_messages'] if report['mailbox_total_messages'] is not None else 'Not scanned during limited preview'}",
        f"- Messages processed: {report['messages_processed_this_dataset']}",
        f"- Customer messages: {report['customer_messages']}",
        f"- All Good messages: {report['all_good_messages']}",
        f"- Conversations identified: {report['conversations_identified']}",
        f"- Irrelevant messages discarded: {report['irrelevant_messages_discarded']}",
        f"- Knowledge candidates extracted: {report['knowledge_candidates_extracted']}",
        f"- Entries consolidated: {report['entries_consolidated']}",
        f"- Final knowledge entries: {report['final_knowledge_entries']}",
        f"- Entries requiring review: {report['entries_requiring_review']}",
        f"- Suspected privacy issues: {report['suspected_privacy_issues']}",
        f"- Processing failures: {report['processing_failures']}",
        "",
        "## Most common categories",
        "",
        *[f"- {category}: {count}" for category, count in report["most_common_categories"]],
        "",
        "## Most commonly recommended products",
        "",
        *[f"- {product}: {count}" for product, count in report["most_common_products"]],
        "",
    ]
    (paths.output / "processing_report.md").write_text("\n".join(lines), encoding="utf-8")
    return report


def run_pipeline(
    project_root: Path,
    input_path: Path,
    config_path: Path,
    limit: int | None,
    resume: bool,
) -> tuple[RunPaths, dict[str, Any]]:
    if not input_path.is_file():
        raise FileNotFoundError(f"MBOX not found: {input_path}")
    mode = "preview" if limit is not None else "full"
    paths = create_paths(project_root, mode)
    config = load_config(config_path)
    checkpoint, total_messages = ingest_mbox(input_path, config, paths, limit, resume)
    report = build_outputs(config, paths, checkpoint, total_messages)
    _atomic_json(
        paths.working.parent / "last_run.json",
        {"input_path": str(input_path.resolve()), "config_path": str(config_path.resolve()), "limit": limit, "mode": mode},
    )
    return paths, report
