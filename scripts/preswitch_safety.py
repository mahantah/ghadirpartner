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


def format_mismatch_reason(payload: dict) -> str:
    carton = extract_carton(payload.get("carton"), payload.get("error"), payload.get("code"))
    kind = str(payload.get("kind") or "").strip()
    if not kind:
        error = str(payload.get("error") or "")
        if "missing" in error.lower():
            kind = "missing"
        elif "target mismatch" in error.lower():
            kind = "target_mismatch"
    parts = ["protected_carton_state_mismatch"]
    if carton:
        parts.append(carton)
    if kind:
        parts.append(kind)
    actual = payload.get("actual", payload.get("total"))
    if actual is not None or payload.get("free") is not None:
        expected = payload.get("expected", 20)
        parts.append(
            f"expected={expected}:actual={actual if actual is not None else '?'}"
            f":free={payload.get('free', '?')}:reserved={payload.get('reserved', '?')}"
        )
    return ":".join(parts)


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
    if (
        payload.get("guard") == "protected_carton_state_mismatch"
        or "target mismatch" in error
        or "missing i90-" in error
    ):
        return format_mismatch_reason(payload)
    if "backup" in error:
        return "state_backup_failed"
    if "sqlstate" in error or "pdo" in error:
        return "database_error"
    if "state missing" in error or "state invalid" in error:
        return "database_state_missing_or_invalid"
    return "server_precheck_error"


def inspect_protected_carton(state: dict, code: str) -> dict:
    """Sanitized per-carton report: counts only, never serials or customers."""
    code = str(code).upper()
    cart = None
    for carton in state.get("cartons") or []:
        if str(carton.get("code") or "").upper() == code:
            cart = carton
            break
    if cart is None:
        detached = sum(
            1
            for row in state.get("inventory") or []
            if str(row.get("detached_from_carton_code") or "").upper() == code
        )
        return {
            "code": code,
            "ok": False,
            "kind": "missing",
            "expected": 20,
            "actual": 0,
            "free": 0,
            "reserved": 0,
            "detached": detached,
            "invalid_links": 0,
        }
    cid = int(cart.get("id") or 0)
    rows = [
        row
        for row in state.get("inventory") or []
        if (cid > 0 and int(row.get("carton_id") or 0) == cid)
        or str(row.get("carton_code") or "") == code
    ]
    free = sum(1 for row in rows if int(row.get("order_id") or 0) == 0)
    reserved = len(rows) - free
    detached = sum(
        1
        for row in state.get("inventory") or []
        if str(row.get("detached_from_carton_code") or "").upper() == code
        or (cid > 0 and int(row.get("detached_from_carton_id") or 0) == cid)
    )
    invalid = 0
    for row in rows:
        row_cid = int(row.get("carton_id") or 0)
        row_code = str(row.get("carton_code") or "")
        if (row_cid > 0 and cid > 0 and row_cid != cid) or (
            row_code and row_code.upper() != code
        ):
            invalid += 1
    kind = "ok"
    if len(rows) != 20 and reserved > 0:
        kind = "count_and_allocated"
    elif len(rows) != 20:
        kind = "count_mismatch"
    elif reserved > 0:
        kind = "allocated"
    elif detached > 0:
        kind = "detached_orphan"
    return {
        "code": code,
        "ok": kind == "ok",
        "kind": kind,
        "expected": 20,
        "actual": len(rows),
        "total": len(rows),
        "free": free,
        "reserved": reserved,
        "detached": detached,
        "invalid_links": invalid,
    }


def check_protected_cartons(state: dict) -> list[dict]:
    """Return sanitized mismatch rows; never includes serials or customer fields."""
    return [row for row in (inspect_protected_carton(state, code) for code in PROTECTED_CARTONS) if not row["ok"]]


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
        summary = ",".join(
            f"{f['code']}:{f['kind']}:expected={f.get('expected',20)}:actual={f.get('actual',f.get('total'))}:free={f.get('free')}:reserved={f.get('reserved')}"
            for f in failures
        )
        print(f"protected_carton_state_mismatch:{summary}", file=sys.stderr)
        return 2
    print("protected_carton_guard_ok")
    return 0


def diagnose_cli(path: Path) -> int:
    state = json.loads(path.read_text(encoding="utf-8"))
    report = [inspect_protected_carton(state, code) for code in PROTECTED_CARTONS]
    print(json.dumps({"ok": all(row["ok"] for row in report), "cartons": report}, ensure_ascii=False, indent=2))
    return 0 if all(row["ok"] for row in report) else 2


def simulate_retail_transfer(state: dict, code: str, from_wh: int, to_wh: int, by_carton: bool) -> dict:
    """Pure-function preview of the protected-carton transfer rules."""
    code = code.upper()
    if by_carton and code in PROTECTED_CARTONS:
        for row in state.get("inventory") or []:
            if str(row.get("carton_code") or "") == code and int(row.get("warehouse_id") or 0) == from_wh:
                row["warehouse_id"] = to_wh
        for carton in state.get("cartons") or []:
            if str(carton.get("code") or "") == code:
                carton["warehouse_id"] = to_wh
        return {"ok": True, "detached": False, "mode": "intact_protected"}
    if not by_carton:
        for row in state.get("inventory") or []:
            if str(row.get("serial") or "").upper() != code:
                continue
            owner = str(row.get("carton_code") or "").upper()
            if owner in PROTECTED_CARTONS:
                return {"ok": False, "error": f"serial_split_blocked:{owner}"}
            detached = False
            if from_wh == 1 and to_wh == 2 and int(row.get("carton_id") or 0) > 0:
                row["detached_from_carton_code"] = row.get("carton_code")
                row["carton_id"] = 0
                row["carton_code"] = ""
                detached = True
            row["warehouse_id"] = to_wh
            return {"ok": True, "detached": detached, "mode": "retail_detach"}
        return {"ok": False, "error": "serial_not_found"}
    for row in state.get("inventory") or []:
        if str(row.get("carton_code") or "") == code and int(row.get("warehouse_id") or 0) == from_wh:
            if from_wh == 1 and to_wh == 2:
                row["detached_from_carton_code"] = code
                row["carton_id"] = 0
                row["carton_code"] = ""
            row["warehouse_id"] = to_wh
    return {"ok": True, "detached": from_wh == 1 and to_wh == 2, "mode": "retail_detach"}


def simulate_allocate(state: dict, code: str) -> dict:
    code = code.upper()
    if code in PROTECTED_CARTONS:
        return {"ok": False, "error": f"allocate_blocked:{code}"}
    for row in state.get("inventory") or []:
        if str(row.get("serial") or "").upper() == code:
            owner = str(row.get("carton_code") or "").upper()
            if owner in PROTECTED_CARTONS:
                return {"ok": False, "error": f"allocate_blocked:{owner}"}
            row["order_id"] = 1
            return {"ok": True}
    return {"ok": False, "error": "not_found"}


def self_test() -> None:
    root = Path(__file__).resolve().parents[1]
    ok = root / "tests" / "fixtures" / "preswitch_protected_ok.json"
    bad = root / "tests" / "fixtures" / "preswitch_protected_mismatch.json"
    assert check_protected_cartons(json.loads(ok.read_text(encoding="utf-8"))) == []
    failures = check_protected_cartons(json.loads(bad.read_text(encoding="utf-8")))
    assert any(f["code"] == "I90-097" and f["kind"] == "count_and_allocated" for f in failures)
    assert any(f["code"] == "I90-098" and f["kind"] == "missing" for f in failures)
    assert classify_failure({"ok": False, "error": "target mismatch I90-097"}, "500").startswith(
        "protected_carton_state_mismatch:I90-097"
    )
    assert (
        classify_failure(
            {
                "ok": False,
                "guard": "protected_carton_state_mismatch",
                "carton": "I90-125",
                "kind": "allocated",
                "expected": 20,
                "actual": 20,
                "free": 19,
                "reserved": 1,
            },
            "500",
        )
        == "protected_carton_state_mismatch:I90-125:allocated:expected=20:actual=20:free=19:reserved=1"
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
    healthy = json.loads(ok.read_text(encoding="utf-8"))
    for row in healthy.get("inventory") or []:
        row.setdefault("warehouse_id", 1)
        row.setdefault("serial", f"MOCK-{row.get('carton_code')}-{row.get('id')}")
    moved = json.loads(json.dumps(healthy))
    xfer = simulate_retail_transfer(moved, "I90-097", 1, 2, True)
    assert xfer["ok"] and xfer["detached"] is False
    assert inspect_protected_carton(moved, "I90-097")["ok"]
    sample = next(r["serial"] for r in healthy["inventory"] if r.get("carton_code") == "I90-097")
    blocked = simulate_retail_transfer(json.loads(json.dumps(healthy)), sample, 1, 2, False)
    assert blocked["ok"] is False and "serial_split_blocked:I90-097" in blocked["error"]
    assert simulate_allocate(json.loads(json.dumps(healthy)), "I90-097")["ok"] is False
    other = json.loads(json.dumps(healthy))
    other["cartons"].append({"id": 900, "code": "I90-200"})
    other["inventory"].append(
        {"id": 9001, "carton_id": 900, "carton_code": "I90-200", "order_id": 0, "warehouse_id": 1, "serial": "MOCK-I90-200-01"}
    )
    retail = simulate_retail_transfer(other, "I90-200", 1, 2, True)
    assert retail["ok"] and retail["detached"] is True
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
    if len(argv) >= 3 and argv[1] == "diagnose":
        return diagnose_cli(Path(argv[2]))
    if len(argv) >= 2 and argv[1] == "sql":
        print(
            "SELECT id, revision, checksum, updated_at, CHAR_LENGTH(state_json) AS bytes\n"
            "FROM ghadir_state WHERE id = 1;\n"
            "-- READ ONLY. Carton/serial rows live inside state_json, not separate tables.\n"
            "-- After a sanitized JSON export, run: python3 scripts/preswitch_safety.py diagnose state.json"
        )
        return 0
    print(
        "Usage: preswitch_safety.py self-test|classify <json> <http>|check-fixture <state.json>|diagnose <state.json>|sql",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
