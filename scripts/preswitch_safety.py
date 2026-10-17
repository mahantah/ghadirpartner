#!/usr/bin/env python3
"""Sanitized pre-switch MySQL guard helpers (no customer payloads).

classify: map probe JSON + HTTP status to a safe CI failure reason.
check-fixture: evaluate protected-carton invariants on a local mock state.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

PROTECTED_CARTONS = (
    "I90-097",
    "I90-098",
    "I90-099",
    "I90-100",
    "I90-101",
    "I90-102",
    "I90-103",
    "I90-109",
    "I90-110",
    "I90-111",
    "I90-112",
    "I90-113",
    "I90-114",
    "I90-115",
    "I90-116",
    "I90-123",
    "I90-124",
    "I90-125",
)
MIN_INVENTORY = 13289
MIN_CARTONS = 364
CARTON_RE = re.compile(r"\b(I90-\d{3})\b", re.I)


def extract_carton(*parts: object) -> str | None:
    for part in parts:
        if part is None:
            continue
        match = CARTON_RE.search(str(part))
        if match:
            return match.group(1).upper()
    return None


def classify_failure(payload: dict | None, http_status: str) -> str:
    if not isinstance(payload, dict):
        return f"unreadable response, HTTP {http_status}"
    if payload.get("ok"):
        counts = payload.get("counts") or {}
        inv = int(counts.get("inventory") or 0)
        cartons = int(counts.get("cartons") or 0)
        if inv < MIN_INVENTORY or cartons < MIN_CARTONS:
            return "inventory_or_carton_count_below_guard"
        return "ok"
    error = str(payload.get("error") or "").lower()
    carton = extract_carton(payload.get("carton"), payload.get("error"))
    if (
        payload.get("guard") == "protected_carton_state_mismatch"
        or "target mismatch" in error
        or "missing i90-" in error
    ):
        reason = "protected_carton_state_mismatch"
        return f"{reason}:{carton}" if carton else reason
    if "backup" in error:
        return "state_backup_failed"
    if "sqlstate" in error or "pdo" in error:
        return "database_error"
    if "state missing" in error or "state invalid" in error:
        return "database_state_missing_or_invalid"
    return "server_precheck_error"


def check_protected_cartons(state: dict) -> list[dict]:
    """Return sanitized mismatch rows; never includes serials or customer fields."""
    cart_by_code = {}
    for carton in state.get("cartons") or []:
        code = str(carton.get("code") or "")
        if code:
            cart_by_code[code] = carton
    failures = []
    inventory = state.get("inventory") or []
    for code in PROTECTED_CARTONS:
        if code not in cart_by_code:
            failures.append({"code": code, "kind": "missing"})
            continue
        cid = int(cart_by_code[code].get("id") or 0)
        rows = [
            row
            for row in inventory
            if int(row.get("carton_id") or 0) == cid
            or str(row.get("carton_code") or "") == code
        ]
        free = sum(1 for row in rows if int(row.get("order_id") or 0) == 0)
        if len(rows) != 20 or free != 20:
            failures.append(
                {
                    "code": code,
                    "kind": "target_mismatch",
                    "total": len(rows),
                    "free": free,
                }
            )
    return failures


def classify_cli(path: Path, http_status: str) -> int:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        payload = None
    reason = classify_failure(payload, http_status)
    if reason == "ok":
        print("Verified MySQL backup and protected warehouse count guard")
        return 0
    print(f"Pre-switch safety check blocked: {reason}, HTTP {http_status}", file=sys.stderr)
    return 2


def check_fixture_cli(path: Path) -> int:
    state = json.loads(path.read_text(encoding="utf-8"))
    failures = check_protected_cartons(state)
    if failures:
        # Only carton codes + numeric totals; no inventory rows dumped.
        summary = ",".join(
            f"{f['code']}:{f['kind']}"
            + (f"(t={f.get('total')},f={f.get('free')})" if "total" in f else "")
            for f in failures
        )
        print(f"protected_carton_state_mismatch:{summary}", file=sys.stderr)
        return 2
    print("protected_carton_guard_ok")
    return 0


def self_test() -> None:
    root = Path(__file__).resolve().parents[1]
    ok = root / "tests" / "fixtures" / "preswitch_protected_ok.json"
    bad = root / "tests" / "fixtures" / "preswitch_protected_mismatch.json"
    assert check_protected_cartons(json.loads(ok.read_text(encoding="utf-8"))) == []
    failures = check_protected_cartons(json.loads(bad.read_text(encoding="utf-8")))
    assert any(f["code"] == "I90-097" and f["kind"] == "target_mismatch" for f in failures)
    assert any(f["code"] == "I90-098" and f["kind"] == "missing" for f in failures)
    assert (
        classify_failure({"ok": False, "error": "target mismatch I90-097"}, "500")
        == "protected_carton_state_mismatch:I90-097"
    )
    assert (
        classify_failure(
            {"ok": False, "guard": "protected_carton_state_mismatch", "carton": "I90-125"},
            "500",
        )
        == "protected_carton_state_mismatch:I90-125"
    )
    assert classify_failure({"ok": False, "error": "backup failed"}, "500") == "state_backup_failed"
    assert classify_failure(None, "000") == "unreadable response, HTTP 000"
    assert (
        classify_failure(
            {"ok": True, "counts": {"inventory": MIN_INVENTORY, "cartons": MIN_CARTONS}},
            "200",
        )
        == "ok"
    )
    print("preswitch_safety self-test ok")


def main(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[1] == "self-test":
        self_test()
        return 0
    if len(argv) >= 3 and argv[1] == "classify":
        status = argv[3] if len(argv) >= 4 else "000"
        return classify_cli(Path(argv[2]), status)
    if len(argv) >= 3 and argv[1] == "check-fixture":
        return check_fixture_cli(Path(argv[2]))
    print(
        "Usage: preswitch_safety.py self-test|classify <json> <http>|check-fixture <state.json>",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
