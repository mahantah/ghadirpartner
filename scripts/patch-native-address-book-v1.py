"""Add only the missing partner address route to an assembled release or staged copy."""
from pathlib import Path
import re
import sys

MARK = 'GP_NATIVE_ADDRESS_BOOK_V1_20261020'

def patch(root: Path) -> None:
    target = root / 'partners' / 'index.php'
    source = Path(__file__).resolve().parents[1] / 'lib' / 'native-address-book-v1.php'
    before = target.read_text(encoding='utf-8')
    snippet = source.read_text(encoding='utf-8').removeprefix('<?php').strip()
    block = '// BEGIN ' + MARK + '\n' + snippet + '\n// END ' + MARK + '\n'
    if MARK in before:
        if before.count(block) != 1:
            raise SystemExit('Address route marker differs; review the existing implementation')
        print('Address route already applied')
        return
    if re.search(r"\$p\s*===?\s*['\"]/api/addresses['\"]", before):
        raise SystemExit('Existing address route found; refusing to replace it')
    anchor = "fail('مسیر پیدا نشد',404);"
    if before.count(anchor) != 1 or 'function auth(' not in before or 'function db(' not in before:
        raise SystemExit('Partner router contract differs; no file was changed')
    after = before.replace(anchor, block + anchor, 1)
    target.write_text(after, encoding='utf-8')
    print('Added account-scoped address route to the partner router')

if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: patch-native-address-book-v1.py RELEASE_ROOT')
    patch(Path(sys.argv[1]))
