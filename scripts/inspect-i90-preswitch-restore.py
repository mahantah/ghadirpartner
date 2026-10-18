#!/usr/bin/env python3
"""Read-only forensic audit for a suspected preswitch return of protected I90 serials.

Safe on a trusted host with local before/after state_json files. Prints aggregate
counts only; never modifies either file or lists identifiers/customer records.
"""
from __future__ import annotations
import argparse
from collections import Counter
import json
from pathlib import Path
import re
import sys

PROTECTED = frozenset([
    "I90-097", "I90-098", "I90-099", "I90-100", "I90-101", "I90-102",
    "I90-103", "I90-109", "I90-110", "I90-111", "I90-112", "I90-113",
    "I90-114", "I90-115", "I90-116", "I90-123", "I90-124", "I90-125",
])
I90 = re.compile(r"(?<![A-Z0-9])I90(?![A-Z0-9])", re.IGNORECASE)


def integer(value: object, default: int = 0) -> int:
    try:
        return int(value) if value is not None else default
    except (TypeError, ValueError):
        return default


def text(value: object) -> str:
    return str(value or "").strip().upper()


def carton_ids(s: dict) -> dict:
    return {
        integer(c.get("id")): text(c.get("code"))
        for c in s.get("cartons", [])
        if isinstance(c, dict) and integer(c.get("id")) > 0
    }


def code(iv: dict, by_id: dict) -> str:
    listed = text(iv.get("carton_code"))
    if listed in PROTECTED:
        return listed
    linked = by_id.get(integer(iv.get("carton_id")), "")
    return linked if linked in PROTECTED else ""


def rows(s: dict) -> list:
    if not isinstance(s, dict) or not isinstance(s.get("inventory"), list):
        raise ValueError("Invalid inventory in state")
    return [iv for iv in s["inventory"] if isinstance(iv, dict)]


def analyze(current: dict, before: dict | None = None, expected: int = 1455,
            website_shows: int = 1815, expected_restored: int = 360) -> dict:
    if min(expected, website_shows, expected_restored) < 0:
        raise ValueError("Negative quantities are not supported")
    now_rows = rows(current)
    if before is not None:
        old_rows = rows(before)
    else:
        old_rows = []
    ids = carton_ids(current)
    old_ids = carton_ids(before) if before is not None else {}
    inside = [
        iv for iv in now_rows
        if I90.search(str(iv.get("product") or "")) and integer(iv.get("warehouse_id"), -99) == 1
    ]
    return_candidates = []
    for iv in inside:
        if not code(iv, ids):
            continue
        if integer(iv.get("order_id")) != 0:
            continue
        if integer(iv.get("returned_from_order_id")) <= 0:
            continue
        if not str(iv.get("returned_at") or "").strip():
            continue
        return_candidates.append(iv)
    all_protected = [
        iv for iv in inside if code(iv, ids)
    ]
    used_codes = {code(iv, ids) for iv in return_candidates}
    marked_serials = Counter(text(iv.get("serial")) for iv in return_candidates
                             if text(iv.get("serial")))
    duplicate_marked = sum(n - 1 for n in marked_serials.values() if n > 1)
    missing_serial = sum(not text(iv.get("serial")) for iv in return_candidates)
    old_lookup = {}
    for iv in old_rows:
        sn = text(iv.get("serial"))
        if sn:
            old_lookup.setdefault(sn, []).append(iv)
    matched_outside = 0
    matched_previous_order = 0
    missing_prior = 0
    ambiguous_prior = 0
    before_in_wholesale = 0
    if before is not None:
        for iv in return_candidates:
            sn = text(iv.get("serial"))
            old = old_lookup.get(sn, [])
            if len(old) != 1:
                if not old:
                    missing_prior += 1
                else:
                    ambiguous_prior += 1
                continue
            b = old[0]
            if not code(b, old_ids):
                continue
            if integer(b.get("warehouse_id"), -99) == 1:
                before_in_wholesale += 1
            if integer(b.get("warehouse_id"), -99) < 1:
                matched_outside += 1
                if (integer(b.get("order_id")) > 0
                        and integer(b.get("order_id")) == integer(iv.get("returned_from_order_id"))):
                    matched_previous_order += 1
    documented_returns = set()
    for mv in current.get("warehouse_movements") or []:
        if not isinstance(mv, dict):
            continue
        if (text(mv.get("type")) != "RETURN"
                or integer(mv.get("to_warehouse_id")) != 1):
            continue
        for sn in mv.get("serials") or []:
            if text(sn):
                documented_returns.add(text(sn))
    return_movement_support = sum(
        text(iv.get("serial")) in documented_returns for iv in return_candidates
    )
    actual = len(inside)
    result = {
        "model": "I90",
        "warehouse_id": 1,
        "physical_count_reported_by_user": expected,
        "current_website_count_reported_by_user": website_shows,
        "website_surplus_reported": website_shows - expected,
        "snapshot_wholesale_i90_count": actual,
        "snapshot_minus_reported_physical": actual - expected,
        "snapshot_equals_website_report": actual == website_shows,
        "protected_i90_wholesale_count": len(all_protected),
        "suspected_preswitch_restored_in_wholesale": len(return_candidates),
        "suspected_protected_cartons": len(used_codes),
        "return_marker_vs_suspected_360": len(return_candidates) - expected_restored,
        "restore_candidates_with_missing_serial": missing_serial,
        "restore_candidates_with_duplicate_serial": duplicate_marked,
        "restore_candidates_with_return_movement": return_movement_support,
        "prior_snapshot_compared": before is not None,
        "prior_confirmed_outside_to_wholesale": matched_outside if before is not None else None,
        "prior_matched_order_unassignment": matched_previous_order if before is not None else None,
        "prior_candidates_missing": missing_prior if before is not None else None,
        "prior_ambiguous_duplicate_serials": ambiguous_prior if before is not None else None,
        "prior_candidates_already_wholesale": before_in_wholesale if before is not None else None,
        "reconciliation_required": (
            actual != expected or len(return_candidates) > 0 or
            missing_serial > 0 or duplicate_marked > 0
        ),
        "do_not_auto_adjust": True,
        "note": (
            "Matching the known 360-restored log with a before/after state supports "
            "the root cause, not the physical location of any device. "
            "Review shipment, return, transfer and serial evidence before repairs."
        ),
    }
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only I90 preswitch restoration diagnostics")
    parser.add_argument("--current", required=True, type=Path, help="Local state snapshot")
    parser.add_argument("--before", type=Path, help="Local pre-preswitch backup, if available")
    parser.add_argument("--expected", type=int, default=1455)
    parser.add_argument("--website-shows", type=int, default=1815)
    args = parser.parse_args()
    try:
        current = json.loads(args.current.read_text(encoding="utf-8"))
        before = json.loads(args.before.read_text(encoding="utf-8")) if args.before else None
        result = analyze(current, before, args.expected, args.website_shows)
    except (OSError, ValueError, TypeError):
        print("Audit unavailable: invalid local state file or input.", file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
