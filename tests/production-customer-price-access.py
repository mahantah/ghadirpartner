#!/usr/bin/env python3
from pathlib import Path
import sys
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from patch_production_customer_price_access import (
    MARKER,
    patch_app_html,
    patch_php,
    patch_portal_html,
)

LIVE_DIR = Path('/tmp/live-gp')
LIVE_APP = LIVE_DIR / 'app.html'
LIVE_PORTAL = LIVE_DIR / 'portal.html'
ZIP = ROOT / 'GhadirPartner-Web-V5.3.4.38-FINAL-TOMAN-SESSION24H-HOMA-SERVICE.zip'


def ensure_live():
    LIVE_DIR.mkdir(parents=True, exist_ok=True)
    for url, dest in (
        ('https://ghadirpartner.ir/app.html', LIVE_APP),
        ('https://ghadirpartner.ir/partners/portal.html', LIVE_PORTAL),
    ):
        if dest.is_file() and dest.stat().st_size > 10000:
            continue
        with urllib.request.urlopen(url, timeout=40) as resp:
            dest.write_bytes(resp.read())


def test_live_app():
    raw = LIVE_APP.read_text()
    out = patch_app_html(raw)
    assert MARKER in out
    assert 'visible_price_groups:readPriceGroups(\'ep\')' in out
    assert 'visible_price_groups:readPriceGroups(\'cp\')' in out
    assert 'function customerPriceGroups(c)' in out
    assert 'cp_agent' in out
    try:
        patch_app_html(out)
    except RuntimeError as exc:
        assert 'already' in str(exc)
    else:
        raise AssertionError('second app patch should fail closed')


def test_live_portal():
    raw = LIVE_PORTAL.read_text()
    out = patch_portal_html(raw)
    assert MARKER in out
    assert 'function visiblePriceGroups()' in out
    assert 'allowed.includes(priceKeyGroup(k))' in out
    assert 'visiblePriceGroups().includes(\'panel\')' in out


def test_zip_php():
    with zipfile.ZipFile(ZIP) as zf:
        for name in ('index.php', 'partners/index.php'):
            out = patch_php(zf.read(name).decode('utf-8'))
            assert 'customer-price-access.php' in out
            assert 'ghadir_filter_prices' in out
            assert "ghadir_apply_customer_price_groups($c,$x['visible_price_groups'])" in out
            assert '/api/native/customer-access' in out


if __name__ == '__main__':
    ensure_live()
    test_live_app()
    test_live_portal()
    test_zip_php()
    print('customer price-access production patches passed')
