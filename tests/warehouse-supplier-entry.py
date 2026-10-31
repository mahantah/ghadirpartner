"""Check bounded staging against a privately supplied active warehouse asset."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Protocol, cast


class Patch(Protocol):
    """Expose only the patch's pure public facade to this regression."""

    def render(self, original: str) -> str:
        """Stage supplier entry while rejecting unexpected source changes."""
        ...


class PatchModule(Protocol):
    """Describe the imported patch constructor without an untyped module."""

    def WarehouseSupplierEntryPatch(self, root: Path) -> Patch:
        """Construct a validated patch with checkout configuration."""
        ...


class SupplierEntrySafetyRegression:
    """Exercise idempotency and rejection of unreviewed active handler changes."""

    def __init__(self, patch: Patch) -> None:
        """Inject the patch facade.

        Args:
            patch: Configured patch under test.
        """
        self._patch = patch

    def run(self, source: str) -> None:
        """Validate safety using private source without printing its contents.

        Args:
            source: Active asset fetched privately for this test.
        """
        staged = self._patch.render(source)
        assert staged != source
        assert self._patch.render(staged) == staged
        for changed in (
            source.replace("window.saveWarehouseFile=", "window.changed=", 1),
            source.replace(
                "window.saveWarehouseCarton=", "window.saveWarehouseCarton= ", 1
            ),
            staged.replace("supplier:$", "supplier: $", 1),
        ):
            try:
                self._patch.render(changed)
            except ValueError:
                continue
            raise AssertionError("unreviewed_source_accepted")
        print("SUPPLIER_ENTRY_SAFETY_PASS")


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    spec = importlib.util.spec_from_file_location(
        "supplier_entry_patch", root / "scripts/patch-warehouse-supplier-entry.py"
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    patch = cast(PatchModule, module).WarehouseSupplierEntryPatch(root)
    SupplierEntrySafetyRegression(patch).run(Path(sys.argv[1]).read_text())
