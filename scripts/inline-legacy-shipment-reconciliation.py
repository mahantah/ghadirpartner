#!/usr/bin/env python3
"""Inline the tested reconciliation helpers into an ephemeral production probe."""
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
probe = Path(sys.argv[1])
text = probe.read_text(encoding="utf-8")
marker = "// __INLINE_RECONCILE_DEPENDENCIES__"
if text.count(marker) != 1:
    raise SystemExit("legacy reconciliation probe marker missing or duplicated")

integrity = (root / "lib" / "preswitch-carton-integrity.php").read_text(encoding="utf-8")
reconcile = (root / "lib" / "legacy-shipment-reconciliation.php").read_text(encoding="utf-8")
for field in (integrity, reconcile):
    if not field.startswith("<?php\n"):
        raise SystemExit("unexpected php helper layout")
reconcile = reconcile.replace(
    "require_once __DIR__.'/preswitch-carton-integrity.php';", ""
)
fragment = integrity.removeprefix("<?php\n") + "\n" + reconcile.removeprefix("<?php\n")
text = text.replace(marker, fragment)
probe.write_text(text, encoding="utf-8")
