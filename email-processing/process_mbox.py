#!/usr/bin/env python3
"""CLI for the local-only historical mailbox pipeline."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from pipeline.runner import run_pipeline


SCRIPT_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_ROOT.parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract anonymised business knowledge from a local MBOX.")
    parser.add_argument("--input", type=Path, help="Read-only path to the source MBOX.")
    parser.add_argument("--config", type=Path, default=SCRIPT_ROOT / "config.json", help="Local processor configuration.")
    parser.add_argument("--limit", type=int, help="Process only the first N messages into output/preview.")
    parser.add_argument("--resume", action="store_true", help="Resume the most recent preview or full run.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    input_path = args.input
    config_path = args.config
    limit = args.limit
    if args.resume and input_path is None:
        last_run_path = SCRIPT_ROOT / "working" / "last_run.json"
        if not last_run_path.exists():
            print("No previous run was found. Supply --input for the first run.", file=sys.stderr)
            return 2
        last_run = json.loads(last_run_path.read_text(encoding="utf-8"))
        input_path = Path(last_run["input_path"])
        config_path = Path(last_run["config_path"])
        limit = last_run["limit"]
    if input_path is None:
        print("--input is required unless --resume can load a previous run.", file=sys.stderr)
        return 2
    if limit is not None and limit <= 0:
        print("--limit must be a positive integer.", file=sys.stderr)
        return 2

    try:
        paths, report = run_pipeline(PROJECT_ROOT, input_path, config_path, limit, args.resume)
    except Exception as error:
        print(f"Processing stopped safely: {type(error).__name__}: {error}", file=sys.stderr)
        return 1
    print(f"Output: {paths.output}")
    print(
        "Processed: {messages_processed_this_dataset} | Conversations: {conversations_identified} | "
        "Candidates: {knowledge_candidates_extracted} | Final knowledge: {final_knowledge_entries} | "
        "Needs review: {entries_requiring_review} | Privacy flags: {suspected_privacy_issues}".format(**report)
    )
    if limit is not None:
        print("Preview complete. STOP: review output before any full-mailbox run.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
