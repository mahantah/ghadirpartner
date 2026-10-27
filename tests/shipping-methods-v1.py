#!/usr/bin/env python3
"""Exercise shipping validation and UI against a sanitized canonical build."""

from __future__ import annotations

import importlib.util
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class ShippingRegression(unittest.TestCase):
    """Check configuration, repeatability, dispatch guards and courier snapshots."""

    def test_canonical_shipping(self) -> None:
        """Run PHP validation and JavaScript field/payload scenarios on built source."""
        root = Path(sys.argv[1])
        repo = Path(__file__).resolve().parents[1]
        patch = repo / "scripts/patch-shipping-methods-v1.py"
        html = (root / "app.html").read_text()
        php = (root / "index.php").read_text()
        for name in ("ماهکس", "ترمینال"):
            self.assertIn("<option>" + name + "</option>", html)
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory)
            (fixture / "app.html").write_text(html)
            (fixture / "index.php").write_text(php)
            subprocess.run([sys.executable, str(patch), str(fixture)], check=True)
            self.assertEqual(html, (fixture / "app.html").read_text())
            self.assertEqual(php, (fixture / "index.php").read_text())
            (fixture / "index.php").write_text(
                php.replace("GP_SHIPPING_METHODS_V1_20261027", "MISSING")
            )
            result = subprocess.run(
                [sys.executable, str(patch), str(fixture)],
                capture_output=True,
                check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(html, (fixture / "app.html").read_text())
            validation = php[
                php.index("   $shipping=trim((string)($x['shipping_type']") : php.index(
                    "   $oldTracking="
                )
            ]
            fixture_php = """<?php
function fail(string $message): never { throw new RuntimeException($message); }
function validate(array $x, string $new='ارسال شد'): void {
$o=[];
VALIDATION
}
$cases=[
 [['shipping_type'=>'ماهکس'],false],
 [['shipping_type'=>'ماهکس','tracking_code'=>'000123'],true],
 [['shipping_type'=>'ترمینال'],true],
 [['shipping_type'=>'پیک'],false],
 [['shipping_type'=>'پیک','courier_name'=>'نمونه'],false],
 [['shipping_type'=>'پیک','courier_phone'=>'09120000000'],false],
 [['shipping_type'=>'پیک','courier_name'=>'نمونه','courier_phone'=>'09120000000'],true],
 [['shipping_type'=>'تیپاکس'],false],
 [['shipping_type'=>'چاپار'],false],
 [['shipping_type'=>'حضوری'],true],
];
foreach($cases as [$input,$expected]){
 try {validate($input);$valid=true;} catch(RuntimeException $e){$valid=false;}
 if($valid!==$expected)throw new RuntimeException('Unexpected validation: '.json_encode($input));
}
validate(['shipping_type'=>'پیک'],'در حال آماده سازی');
echo "shipping PHP validation: PASS\\n";
""".replace("VALIDATION", validation)
            target = fixture / "validation.php"
            target.write_text(fixture_php)
            subprocess.run(
                ["php", "-l", str(root / "index.php")], check=True, capture_output=True
            )
            subprocess.run(["php", str(target)], check=True)
            subprocess.run(
                ["node", str(repo / "tests/shipping-methods-v1.cjs"), str(root)],
                check=True,
            )
        self.assertEqual(
            php.count("'courier_name'=>$shipping==='پیک'?$courierName:''"), 2
        )
        self.assertIn("$o['courier_name']=$courierName", php)
        self.assertIn("$o['courier_phone']=$courierPhone", php)
        self.assertIn("['تیپاکس','چاپار','ماهکس'],true))", php)

    def test_invalid_configuration(self) -> None:
        """Reject duplicate and inconsistent YAML before any source mutation."""
        repo = Path(__file__).resolve().parents[1]
        spec = importlib.util.spec_from_file_location(
            "shipping_patch", repo / "scripts/patch-shipping-methods-v1.py"
        )
        assert spec is not None and spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "shipping.yaml"
            for text in (
                "methods:\n  - پیک\n  - پیک\ntracking_methods:\n  - پیک\ncourier_method: پیک\n",
                "methods:\n  - پیک\ntracking_methods:\n  - ماهکس\ncourier_method: پیک\n",
            ):
                target.write_text(text)
                with self.assertRaises(ValueError):
                    module.ShippingPatch(Path(directory), target)


if __name__ == "__main__":
    unittest.main(argv=[sys.argv[0]])
