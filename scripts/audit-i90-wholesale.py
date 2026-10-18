#!/usr/bin/env python3
"""Read-only I90 warehouse reconciliation. Never prints serials, orders or customers.

Run only where a legitimate local state_json snapshot is already accessible.
Do not upload production state, DB dumps or customer information to GitHub.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import re
import sys

I90_PRODUCT = re.compile(r"(?<![A-Z0-9])I90(?![A-Z0-9])", re.IGNORECASE)
SHIPPED_STATUSES = {"ارسال شد", "تحویل شد"}


def number(value: object, default: int = 0) -> int:
    try:
        return int(value) if value is not None else default
    except (TypeError, ValueError):
        return default


def is_i90_product(name: object) -> bool:
    return bool(I90_PRODUCT.search(str(name or "")))


def audit(state: dict, expected: int) -> dict:
    """Return sanitized counts only. This does not prove which devices exist physically."""
    if not isinstance(state, dict) or not isinstance(state.get("inventory"), list):
        raise ValueError("State must have an inventory array")
    if expected < 0:
        raise ValueError("Expected physical quantity must be nonnegative")
    orders = {
        number(row.get("id")): str(row.get("status") or "")
        for row in state.get("orders", [])
        if isinstance(row, dict) and number(row.get("id")) > 0
    }
    counts = {
        "wholesale_total": 0,
        "wholesale_free": 0,
        "wholesale_reserved": 0,
        "retail_total": 0,
        "outside_warehouses": 0,
        "other_or_unknown_warehouse": 0,
        "missing_serial_rows": 0,
        "duplicate_serial_rows": 0,
        "wholesale_reserved_for_missing_order": 0,
        "wholesale_shipped_order_still_in_stock": 0,
    }
    seen_serials = Counter()
    i90_rows = 0
    product_names = set()
    for row in state["inventory"]:
        if not isinstance(row, dict) or not is_i90_product(row.get("product")):
            continue
        i90_rows += 1
        product_names.add(str(row.get("product") or "").strip())
        serial = str(row.get("serial") or "").strip().upper()
        if serial:
            seen_serials[serial] += 1
        else:
            counts["missing_serial_rows"] += 1
        wid = number(row.get("warehouse_id"), -99)
        oid = number(row.get("order_id"))
        if wid == 1:
            counts["wholesale_total"] += 1
            if oid > 0:
                counts["wholesale_reserved"] += 1
                if oid not in orders:
                    counts["wholesale_reserved_for_missing_order"] += 1
                if orders.get(oid) in SHIPPED_STATUSES:
                    counts["wholesale_shipped_order_still_in_stock"] += 1
            elif oid == 0:
                counts["wholesale_free"] += 1
            else:
                counts["wholesale_reserved"] += 1
        elif wid == 2:
            counts["retail_total"] += 1
        elif wid == 0:
            counts["outside_warehouses"] += 1
        else:
            counts["other_or_unknown_warehouse"] += 1
    counts["duplicate_serial_rows"] = sum(n - 1 for n in seen_serials.values() if n > 1)
    delta = counts["wholesale_total"] - expected
    anomalies = {
        key: counts[key]
        for key in (
            "missing_serial_rows",
            "duplicate_serial_rows",
            "wholesale_reserved_for_missing_order",
            "wholesale_shipped_order_still_in_stock",
            "other_or_unknown_warehouse",
        )
        if counts[key] > 0
    }
    return {
        "device_family": "I90",
        "location": "انبار عمده",
        "warehouse_id": 1,
        "expected_physical_count": expected,
        "system_wholesale_count": counts["wholesale_total"],
        "system_minus_physical": delta,
        "quantity_matches": delta == 0,
        "identity_integrity_unverified": True,
        "requires_serial_level_reconciliation": delta != 0 or bool(anomalies),
        "i90_product_name_variants": len(product_names),
        "system_i90_total_all_locations": i90_rows,
        "counts": counts,
        "anomalies": anomalies,
        "note": "Count-only audit. No data was changed; a matching count is not proof of physical or order correctness.",
    }



def outbound_report(state: dict, exit_date: str, expected_exit: int) -> dict:
    """Evidence of a recorded I90 dispatch from wholesale. Counts only."""
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", exit_date):
        raise ValueError("Exit date must be YYYY-MM-DD")
    if expected_exit < 0:
        raise ValueError("Expected exit must be nonnegative")
    stock_by_serial = {}
    for row in state.get("inventory") or []:
        if not isinstance(row, dict) or not is_i90_product(row.get("product")):
            continue
        sn = str(row.get("serial") or "").strip().upper()
        if sn:
            stock_by_serial.setdefault(sn, []).append(number(row.get("warehouse_id"), -99))
    movements = []
    for mv in state.get("warehouse_movements") or []:
        if not isinstance(mv, dict) or not is_i90_product(mv.get("product")):
            continue
        if str(mv.get("created_at") or "")[:10] != exit_date:
            continue
        if number(mv.get("from_warehouse_id")) != 1 or number(mv.get("to_warehouse_id")) != 0:
            continue
        movements.append(mv)
    shipped = [m for m in movements if str(m.get("type") or "") == "sale_out"]
    other = [m for m in movements if str(m.get("type") or "") != "sale_out"]
    quantity = sum(max(0, number(m.get("qty"))) for m in shipped)
    other_qty = sum(max(0, number(m.get("qty"))) for m in other)
    serials_seen = set()
    serials_inside = 0
    serials_unmatched = 0
    serials_repeated = 0
    serial_entries = 0
    movements_without_serials = 0
    qty_mismatch_movements = 0
    for mv in shipped:
        unique = set()
        raw = mv.get("serials") if isinstance(mv.get("serials"), list) else []
        if not raw:
            movements_without_serials += 1
        for sn0 in raw:
            sn = str(sn0 or "").strip().upper()
            if not sn:
                continue
            serial_entries += 1
            if sn in unique or sn in serials_seen:
                serials_repeated += 1
            unique.add(sn)
            serials_seen.add(sn)
            locations = stock_by_serial.get(sn, [])
            if not locations:
                serials_unmatched += 1
            elif 1 in locations:
                serials_inside += 1
        if raw and len(unique) != max(0, number(mv.get("qty"))):
            qty_mismatch_movements += 1
    return {
        "local_date": exit_date,
        "expected_wholesale_exit_qty": expected_exit,
        "recorded_sale_out_qty": quantity,
        "recorded_sale_out_movements": len(shipped),
        "other_wholesale_to_outside_qty": other_qty,
        "sale_out_quantity_matches": quantity == expected_exit,
        "movement_serial_entries": serial_entries,
        "movement_serials_still_in_wholesale": serials_inside,
        "movement_serials_absent_from_inventory": serials_unmatched,
        "movement_serials_repeated": serials_repeated,
        "movements_without_serial_list": movements_without_serials,
        "movements_with_qty_serial_mismatch": qty_mismatch_movements,
        "needs_review": (
            quantity != expected_exit
            or serials_inside > 0
            or serials_unmatched > 0
            or serials_repeated > 0
            or movements_without_serials > 0
            or qty_mismatch_movements > 0
        ),
        "note": "Recorded movements are evidence, not proof of physical departure. Returns after this date may explain serials now in wholesale.",
    }

def main() -> int:
    parser = argparse.ArgumentParser(description="Audit I90 wholesale count without changing data")
    parser.add_argument("--input", type=Path, required=True, help="Local state JSON; do NOT upload production data")
    parser.add_argument("--expected", type=int, required=True, help="Verified wholesale physical count")
    parser.add_argument("--previous-count", type=int, help="Prior observed wholesale quantity")
    parser.add_argument("--exit-quantity", type=int, help="Reported outbound quantity")
    parser.add_argument("--exit-date", help="Local date of outbound recording (YYYY-MM-DD)")
    args = parser.parse_args()
    try:
        state = json.loads(args.input.read_text(encoding="utf-8"))
        result = audit(state, args.expected)
        if any(value is not None for value in (args.previous_count, args.exit_quantity, args.exit_date)):
            if any(value is None for value in (args.previous_count, args.exit_quantity, args.exit_date)):
                raise ValueError("Previous count, exit quantity and exit date must be provided together")
            calculated = args.previous_count - args.exit_quantity
            result["reported_movement"] = {
                "previous_wholesale_count": args.previous_count,
                "reported_exit_quantity": args.exit_quantity,
                "calculated_wholesale_after_exit": calculated,
                "matches_expected_physical_count": calculated == args.expected,
            }
            result["outbound_evidence"] = outbound_report(state, args.exit_date, args.exit_quantity)
            if calculated != args.expected or result["outbound_evidence"]["needs_review"]:
                result["requires_serial_level_reconciliation"] = True
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print("Cannot audit: " + type(exc).__name__, file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 2 if result["requires_serial_level_reconciliation"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
