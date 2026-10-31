"""Exercise bounded patching using public legacy fixtures, never owner data."""

from __future__ import annotations

import ast
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class SupplierColumnTests(unittest.TestCase):
    """Check staging, repeatability, drift rejection and source preservation."""

    def test_patch_contract(self) -> None:
        """Stage both legacy decorators and reject unknown source variants."""
        root = Path(__file__).resolve().parents[1]
        script = root / "scripts/patch-warehouse-supplier-column.py"
        tree = ast.parse(
            (root / "scripts/patch-supplier-display-live-v5.py").read_text()
        )
        fixture = ""
        for item in tree.body:
            if isinstance(item, ast.Assign) and any(
                isinstance(target, ast.Name) and target.id == "payload"
                for target in item.targets
            ):
                value: object = ast.literal_eval(item.value)
                if isinstance(value, str):
                    fixture = value
        self.assertTrue(fixture)
        fixture += "<script>\n  function gpDecorateWarehouse(state){\n}\n</script>"
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.html"
            staged = Path(directory) / "staged.html"
            repeated = Path(directory) / "repeated.html"
            source.write_text(fixture)
            subprocess.run(
                [sys.executable, str(script), str(source), str(staged)], check=True
            )
            self.assertEqual(source.read_text(), fixture)
            output = staged.read_text()
            self.assertIn("class WarehouseSupplierColumn", output)
            self.assertIn("if(window.GP_SUPPLIER_LIVE_V5) return;", output)
            self.assertNotIn("const code=txt(cells[0]", output)
            subprocess.run(
                [sys.executable, str(script), str(staged), str(repeated)], check=True
            )
            self.assertEqual(output, repeated.read_text())
            source.write_text(
                fixture.replace("if(!cells.length)", "if(cells.length===0)")
            )
            rejected = subprocess.run(
                [sys.executable, str(script), str(source), str(repeated)],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertNotEqual(rejected.returncode, 0)
            self.assertIn("supplier_source_mismatch", rejected.stderr)
            self.assertEqual(repeated.read_text(), output)
            same = subprocess.run(
                [sys.executable, str(script), str(source), str(source)],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertIn("source_and_output_must_differ", same.stderr)


if __name__ == "__main__":
    unittest.main()
