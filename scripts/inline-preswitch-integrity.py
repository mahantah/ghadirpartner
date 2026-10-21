#!/usr/bin/env python3
"""Inline the reviewed read-only validator into the temporary preflight probe."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
MARKER = "// GP_PRESWITCH_INTEGRITY_INLINE_20261021"


def inline_probe(source):
    library = (ROOT / "lib/preswitch-carton-integrity.php").read_text(encoding="utf-8")
    if not library.startswith("<?php\n") or "?>" in library:
        raise ValueError("Unexpected validator PHP format")
    library = library[len("<?php\n"):].rstrip()
    if source.count(MARKER) != 1:
        raise ValueError("Expected one preflight integrity marker")
    return source.replace(MARKER, library, 1)


if __name__ == "__main__":
    path = Path(sys.argv[1])
    path.write_text(inline_probe(path.read_text(encoding="utf-8")), encoding="utf-8")
