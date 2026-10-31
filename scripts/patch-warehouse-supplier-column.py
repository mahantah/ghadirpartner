"""Stage a bounded supplier-column correction against private owner HTML."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


class SupplierColumnPatch:
    """Validate known legacy anchors before replacing the supplier renderer."""

    def __init__(self, root: Path) -> None:
        """Load validated patch policy and the compiled rendering dependency.

        Args:
            root: Checkout containing the patch policy and generated JavaScript.
        """
        config: object = json.loads(
            (root / "config/warehouse-supplier-column.yaml").read_text()
        )
        if not isinstance(config, dict):
            raise TypeError("invalid_supplier_policy")
        self._policy: dict[str, str] = {}
        for key in ("marker", "legacy_sha256", "v4_anchor", "v5_start", "v5_end"):
            value: object = config.get(key)
            if not isinstance(value, str) or not value:
                raise ValueError("invalid_supplier_policy")
            self._policy[key] = value
        if len(self._policy["legacy_sha256"]) != 64:
            raise ValueError("invalid_supplier_policy")
        self._javascript = (root / "assets/warehouse-supplier-column.js").read_text(
            encoding="utf-8"
        )
        if "class WarehouseSupplierColumn" not in self._javascript:
            raise ValueError("missing_supplier_renderer")

    def render(self, original: str) -> str:
        """Return corrected HTML without modifying files or application data.

        Args:
            original: Owner HTML to validate and stage privately.

        Returns:
            HTML with only the reviewed supplier renderer changes.

        Raises:
            ValueError: The source differs from the reviewed legacy renderer.
        """
        start = self._policy["v5_start"]
        end = self._policy["v5_end"]
        marker = self._policy["marker"]
        wrapper = (
            f"/* {marker} */\n{self._javascript}\n"
            + "  function decorateWarehouse(state){\n"
            + "    const maps=mapsFrom(state);\n"
            + "    new WarehouseSupplierColumn(document,\n"
            + "      carton=>supplierForCarton(carton,maps)).render(state);\n"
            + "  }\n\n"
        )
        v4 = self._policy["v4_anchor"]
        guarded_v4 = v4 + "\n    if(window.GP_SUPPLIER_LIVE_V5) return;"
        if marker in original:
            if original.count(wrapper) != 1 or (
                v4 in original and original.count(guarded_v4) != 1
            ):
                raise ValueError("supplier_patch_drift")
            return original
        if original.count(start) != 1 or original.count(end) != 1:
            raise ValueError("supplier_anchor_mismatch")
        left = original.index(start)
        right = original.index(end, left)
        legacy = original[left:right]
        if hashlib.sha256(legacy.encode()).hexdigest() != self._policy["legacy_sha256"]:
            raise ValueError("supplier_source_mismatch")
        staged = original[:left] + wrapper + original[right:]
        if staged.count(v4) > 1:
            raise ValueError("supplier_v4_anchor_mismatch")
        if v4 in staged:
            staged = staged.replace(v4, guarded_v4, 1)
        return staged


class SupplierColumnCommand:
    """Expose an offline staging command, keeping source I/O outside patch logic."""

    def __init__(self, patch: SupplierColumnPatch) -> None:
        """Inject the validated patch facade.

        Args:
            patch: Pure renderer used to stage the proposed correction.
        """
        self._patch = patch

    def run(self) -> None:
        """Stage a new output file without overwriting the owner's source."""
        parser = argparse.ArgumentParser(description=__doc__)
        parser.add_argument("source", type=Path)
        parser.add_argument("output", type=Path)
        args = parser.parse_args()
        source = Path(args.source)
        output = Path(args.output)
        if source.resolve() == output.resolve():
            raise ValueError("source_and_output_must_differ")
        staged = self._patch.render(source.read_text(encoding="utf-8"))
        with output.open("x", encoding="utf-8") as stream:
            stream.write(staged)
        print("Supplier column staged; production and database unchanged.")


if __name__ == "__main__":
    SupplierColumnCommand(
        SupplierColumnPatch(Path(__file__).resolve().parents[1])
    ).run()
