"""Stage supplier submission fixes against the reviewed private warehouse asset."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


class WarehouseSupplierEntryPatch:
    """Preserve the active import handlers while adding the missing supplier field."""

    def __init__(self, root: Path) -> None:
        """Load validated replacement policy.

        Args:
            root: Checkout containing the reviewed YAML policy.
        """
        policy: object = json.loads(
            (root / "config/warehouse-supplier-entry.yaml").read_text()
        )
        if not isinstance(policy, dict):
            raise TypeError("invalid_supplier_entry_policy")
        marker: object = policy.get("marker")
        rules: object = policy.get("rules")
        if not isinstance(marker, str) or not marker or not isinstance(rules, list):
            raise ValueError("invalid_supplier_entry_policy")
        self._marker = marker
        self._rules: list[tuple[str, str, list[tuple[str, str]]]] = []
        for rule in rules:
            if not isinstance(rule, dict):
                raise TypeError("invalid_supplier_entry_rule")
            start, digest, edits = (
                rule.get("start"),
                rule.get("sha256"),
                rule.get("edits"),
            )
            if (
                not isinstance(start, str)
                or not start
                or not isinstance(digest, str)
                or len(digest) != 64
                or any(char not in "0123456789abcdef" for char in digest)
                or not isinstance(edits, list)
                or not edits
            ):
                raise ValueError("invalid_supplier_entry_rule")
            replacements: list[tuple[str, str]] = []
            for edit in edits:
                if not isinstance(edit, dict):
                    raise TypeError("invalid_supplier_entry_edit")
                old, new = edit.get("old"), edit.get("new")
                if (
                    not isinstance(old, str)
                    or not old
                    or not isinstance(new, str)
                    or not new
                ):
                    raise ValueError("invalid_supplier_entry_edit")
                replacements.append((old, new))
            self._rules.append((start, digest, replacements))
        if len(self._rules) != 2 or len({rule[0] for rule in self._rules}) != 2:
            raise ValueError("invalid_supplier_entry_handlers")

    def render(self, original: str) -> str:
        """Return a bounded patch, rejecting changed handlers or partial installations.

        Args:
            original: Private active JavaScript asset, never published by this patch.

        Returns:
            JavaScript with supplier included in manual and file imports.

        Raises:
            ValueError: A reviewed handler or replacement anchor has drifted.
        """
        staged = original
        installed = self._marker in original
        for start, digest, edits in self._rules:
            if staged.count(start) != 1:
                raise ValueError("supplier_entry_anchor_mismatch")
            left = staged.index(start)
            right = staged.find("\n", left)
            if right < 0:
                raise ValueError("supplier_entry_handler_unbounded")
            right += 1
            block = staged[left:right]
            baseline = block
            if installed:
                for old, new in reversed(edits):
                    if baseline.count(new) != 1:
                        raise ValueError("supplier_entry_installation_drift")
                    baseline = baseline.replace(new, old, 1)
            if hashlib.sha256(baseline.encode()).hexdigest() != digest:
                raise ValueError("supplier_entry_source_mismatch")
            if not installed:
                for old, new in edits:
                    if block.count(old) != 1:
                        raise ValueError("supplier_entry_edit_mismatch")
                    block = block.replace(old, new, 1)
                staged = staged[:left] + block + staged[right:]
        if installed:
            if staged.count(self._marker) != 1:
                raise ValueError("supplier_entry_marker_mismatch")
            return staged
        return staged + f"\n/* {self._marker} */\n"


class WarehouseSupplierEntryCommand:
    """Keep source and destination I/O outside the pure patch facade."""

    def __init__(self, patch: WarehouseSupplierEntryPatch) -> None:
        """Inject the patch facade.

        Args:
            patch: Validated supplier entry patch.
        """
        self._patch = patch

    def run(self) -> None:
        """Stage a new file without overwriting the source or any existing output."""
        parser = argparse.ArgumentParser(description=__doc__)
        parser.add_argument("source", type=Path)
        parser.add_argument("output", type=Path)
        args = parser.parse_args()
        if args.source.resolve() == args.output.resolve():
            raise ValueError("supplier_entry_source_equals_output")
        staged = self._patch.render(args.source.read_text(encoding="utf-8"))
        with args.output.open("x", encoding="utf-8") as stream:
            stream.write(staged)
        print("Supplier entry staged; no server or database writes.")


if __name__ == "__main__":
    WarehouseSupplierEntryCommand(
        WarehouseSupplierEntryPatch(Path(__file__).resolve().parents[1])
    ).run()
