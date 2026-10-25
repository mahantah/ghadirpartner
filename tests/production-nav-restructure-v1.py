#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/nav-restructure-v1.js'
LIVE = Path('/tmp/live-gp/app-after-counter-off.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_nav', ROOT / 'scripts/deploy-production-nav-restructure-v1.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ensure_live():
    if LIVE.is_file() and LIVE.stat().st_size > 10000:
        return LIVE.read_bytes()
    LIVE.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen('https://ghadirpartner.ir/app.html', timeout=40) as resp:
        LIVE.write_bytes(resp.read())
    return LIVE.read_bytes()


def main():
    js = ASSET.read_text()
    for needle in (
        'GP_NAV_RESTRUCTURE_V1_20261025',
        'قیمت و موجودی',
        'دفتر روزانه انبار',
        'گزارش خروج',
        'انبارگردانی',
        'اضافه کردن محصول جدید',
        'افزودن مشتری جدید',
        'کارتابل مشتریان',
        'عاملین فروش',
        'نمایندگان فروش',
        'gpWarehouseProducts',
        'data-gp-view="offers"',
        'portalAccounts',
    ):
        if needle not in js:
            raise AssertionError('nav overlay missing ' + needle)
    if 'طرح‌های فروش' in js and 'showOffers' in js:
        raise AssertionError('offers must stay removed from the live submenu')

    deploy = load_deploy()
    raw = ensure_live()
    if b'ui-v53435.js' not in raw or b'warehouseNavGroup' not in raw:
        raise AssertionError('live app.html lost the navigation shell')
    out = deploy.patch_html(raw)
    if deploy.MARKER not in out or b'nav-restructure-v1.js?v=1' not in out:
        raise AssertionError('patched HTML missing nav tag')
    if b'shamsi-calendar-table-v1.js' not in out:
        raise AssertionError('calendar overlay must stay')
    if b'customer-price-access-live-v4.js' not in out:
        raise AssertionError('customer price overlay must stay')
    if b'warehouse-ledger-eod-freeze-v1.js' not in out:
        raise AssertionError('ledger freeze overlay must stay')
    if b'number-counter-v1.js' in out:
        raise AssertionError('number counter must stay unlinked')
    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second nav patch should fail closed')
    print('nav restructure v1 passed')


if __name__ == '__main__':
    main()
