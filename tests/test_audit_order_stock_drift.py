"""Synthetic, non-production regression for read-only order stock drift audit."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest


SOURCE = Path(__file__).resolve().parents[1] / "scripts/audit-order-stock-drift.py"
SPEC = importlib.util.spec_from_file_location("audit_order_stock_drift", SOURCE)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class AuditStockDriftTest(unittest.TestCase):
    """Test allocation and unexpected warehouse restoration separately."""

    def setUp(self) -> None:
        """Build an isolated auditor with synthetic values."""
        self.auditor = MODULE.StockDriftAuditor(1, r"(?<![A-Z0-9])I90(?![A-Z0-9])")

    def test_normal_allocation_keeps_physical_total(self) -> None:
        """Allocating existing stock changes free quantity but not physical stock."""
        previous = {"orders": [{"id": 7, "number": "TEST-1"}], "inventory": [
            {"serial": "SAMPLE-A", "product": "I90", "warehouse_id": 1, "order_id": 0},
            {"serial": "SAMPLE-B", "product": "I90", "warehouse_id": 1, "order_id": 0},
        ]}
        current = {"orders": previous["orders"], "inventory": [
            {"serial": "SAMPLE-A", "product": "I90", "warehouse_id": 1, "order_id": 7},
            {"serial": "SAMPLE-B", "product": "I90", "warehouse_id": 1, "order_id": 0},
        ]}
        report = self.auditor.audit(current, "TEST-1", previous)
        self.assertEqual(report["counts"]["wholesale_quantity_change"], 0)
        self.assertEqual(report["counts"]["attached_stayed_in_wholesale"], 1)
        self.assertEqual(report["current_wholesale_free"], 1)

    def test_unlogged_restoration_is_detected(self) -> None:
        """A serial moved from outside to inside is identifiable with two snapshots."""
        previous = {"orders": [{"id": 7, "number": "TEST-2"}], "inventory": [
            {"serial": "SAMPLE-A", "product": "I90", "warehouse_id": 0, "order_id": 7},
        ]}
        current = {"orders": previous["orders"], "inventory": [
            {"serial": "SAMPLE-A", "product": "I90", "warehouse_id": 1, "order_id": 7},
        ]}
        report = self.auditor.audit(current, "TEST-2", previous)
        self.assertEqual(report["counts"]["attached_moved_into_wholesale"], 1)
        self.assertEqual(report["counts"]["wholesale_quantity_change"], 1)

    def test_duplicate_serial_is_refused(self) -> None:
        """Conflicting source rows must not produce misleading aggregate totals."""
        state = {"orders": [{"id": 7, "number": "TEST-3"}], "inventory": [
            {"serial": "SAMPLE-A", "product": "I90", "warehouse_id": 1, "order_id": 7},
            {"serial": "sample-a", "product": "I90", "warehouse_id": 1, "order_id": 7},
        ]}
        with self.assertRaises(ValueError):
            self.auditor.audit(state, "TEST-3")


if __name__ == "__main__":
    unittest.main()
