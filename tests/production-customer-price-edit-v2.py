#!/usr/bin/env python3
from pathlib import Path
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from patch_production_customer_price_edit_v2 import MARKER, patch_app_html

LIVE = Path('/tmp/live-gp/app-now.html')


def ensure_live():
    if LIVE.is_file() and LIVE.stat().st_size > 10000:
        return
    LIVE.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen('https://ghadirpartner.ir/app.html', timeout=40) as resp:
        LIVE.write_bytes(resp.read())


def main():
    ensure_live()
    raw = LIVE.read_text()
    out = patch_app_html(raw)
    assert MARKER in out
    assert 'openCustomerPriceEdit' in out
    assert 'saveCustomerPrices' in out
    assert 'ویرایش قیمت' in out
    try:
        patch_app_html(out)
    except RuntimeError as exc:
        assert 'already' in str(exc)
    else:
        raise AssertionError('second v2 patch should fail closed')
    print('customer price edit v2 passed')


if __name__ == '__main__':
    main()
