#!/usr/bin/env python3
"""Audit warehouse allocation drift from server-local snapshots without writes."""

from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import re
from typing import TypedDict, cast


class InventoryRow(TypedDict, total=False):
    serial: str
    product: str
    warehouse_id: int
    order_id: int


class OrderRow(TypedDict, total=False):
    id: int
    number: str


class MovementRow(TypedDict, total=False):
    product: str
    qty: int
    from_warehouse_id: int
    to_warehouse_id: int
    created_at: str
    jdate: str


class AuditState(TypedDict, total=False):
    inventory: list[InventoryRow]
    orders: list[OrderRow]
    warehouse_movements: list[MovementRow]


class StockDriftAuditor:
    """Report aggregate evidence for a single order and warehouse."""

    def __init__(self, warehouse_id: int, product_pattern: str) -> None:
        if warehouse_id <= 0:
            raise ValueError("warehouse_id must be positive")
        self.warehouse_id = warehouse_id
        self.product_pattern = re.compile(product_pattern, re.IGNORECASE)

    def _matches(self, product: object) -> bool:
        return bool(self.product_pattern.search(str(product or "")))

    def _rows(self, state: AuditState) -> dict[str, InventoryRow]:
        rows: dict[str, InventoryRow] = {}
        for value in state.get("inventory", []):
            if not isinstance(value, dict) or not self._matches(value.get("product")):
                continue
            serial = str(value.get("serial") or "").strip().upper()
            if serial in rows or not serial:
                raise ValueError("duplicate_or_missing_i90_serial")
            rows[serial] = value
        return rows

    def audit(self, current: AuditState, order_number: str, previous: AuditState | None = None) -> dict[str, object]:
        """Summarize location and movement changes without emitting identifiers.

        Args:
            current: Locally loaded current state, never uploaded.
            order_number: Target order number used only for internal matching.
            previous: Optional earlier state snapshot for actual transition evidence.

        Returns:
            Aggregate counters suitable for sharing with support.
        """
        orders = [row for row in current.get("orders", []) if row.get("number") == order_number]
        if len(orders) != 1:
            raise ValueError("target_order_missing_or_ambiguous")
        order_id = int(orders[0].get("id") or 0)
        if order_id <= 0:
            raise ValueError("invalid_order_id")
        rows = self._rows(current)
        attached = {serial: row for serial, row in rows.items() if int(row.get("order_id") or 0) == order_id}
        current_inside = sum(int(row.get("warehouse_id") or 0) == self.warehouse_id for row in rows.values())
        current_free = sum(int(row.get("warehouse_id") or 0) == self.warehouse_id and not int(row.get("order_id") or 0) for row in rows.values())
        counts: Counter[str] = Counter()
        for row in attached.values():
            counts["attached_in_wholesale" if int(row.get("warehouse_id") or 0) == self.warehouse_id else "attached_outside_wholesale"] += 1
        if previous is not None:
            before = self._rows(previous)
            counts["prior_wholesale_total"] = sum(int(row.get("warehouse_id") or 0) == self.warehouse_id for row in before.values())
            for serial, row in attached.items():
                previous_row = before.get(serial)
                if previous_row is None:
                    counts["attached_absent_in_previous"] += 1
                elif int(previous_row.get("warehouse_id") or 0) != self.warehouse_id and int(row.get("warehouse_id") or 0) == self.warehouse_id:
                    counts["attached_moved_into_wholesale"] += 1
                elif int(previous_row.get("warehouse_id") or 0) == self.warehouse_id and int(row.get("warehouse_id") or 0) == self.warehouse_id:
                    counts["attached_stayed_in_wholesale"] += 1
            counts["wholesale_quantity_change"] = current_inside - counts["prior_wholesale_total"]
        return {
            "order_found": True,
            "attached_i90_count": len(attached),
            "current_wholesale_physical": current_inside,
            "current_wholesale_free": current_free,
            "current_wholesale_allocated": current_inside - current_free,
            "previous_snapshot_supplied": previous is not None,
            "counts": dict(sorted(counts.items())),
            "note": "Read-only counts, not proof of the historical cause without a pre-allocation snapshot and event history.",
        }


def load_state(path: Path) -> AuditState:
    """Load one private server-local snapshot without exposing its contents."""
    state: object = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(state, dict) or not isinstance(state.get("inventory"), list) or not isinstance(state.get("orders"), list):
        raise ValueError("invalid_state_shape")
    return cast(AuditState, state)


def main() -> int:
    """Print only aggregate evidence and return a diagnostic exit status."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--current", type=Path, required=True)
    parser.add_argument("--previous", type=Path)
    parser.add_argument("--order-number", required=True)
    parser.add_argument("--warehouse-id", type=int, required=True)
    parser.add_argument("--product-pattern", required=True)
    args = parser.parse_args()
    try:
        auditor = StockDriftAuditor(args.warehouse_id, args.product_pattern)
        result = auditor.audit(load_state(args.current), args.order_number, load_state(args.previous) if args.previous else None)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(json.dumps({"ok": False, "error_type": type(error).__name__}))
        return 1
    print(json.dumps({"ok": True, "result": result}, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
