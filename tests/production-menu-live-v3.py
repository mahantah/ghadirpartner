#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
MENU2 = ROOT / 'assets/ui-v53435-menu2.js'
OVERLAY = ROOT / 'assets/menu-live-v3.js'
REFINE = ROOT / 'assets/warehouse-ui-refine-v53438.js'
LIVE = Path('/tmp/live-gp/app-now2.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_menu3', ROOT / 'scripts/deploy-production-menu-live-v3.py')
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


def assert_patched(out):
    if b'GP_MENU_LIVE_V3_20261025' not in out or b'menu-live-v3.js?v=3' not in out:
        raise AssertionError('patched HTML missing v3 tag')
    if b'ui-v53435-menu2.js?v=2' not in out:
        raise AssertionError('menu builder was not retargeted')
    if b'ui-v53435.js?v=53435' in out:
        raise AssertionError('old menu builder must not stay linked')
    if b'warehouse-ui-refine-v53438.js?v=53438ui5' not in out:
        raise AssertionError('refine cache was not busted')
    if b"customerAdd:['sales','viewer']" not in out:
        raise AssertionError('TAB_ACCESS missing customerAdd')
    if b'id="customerAdd"' not in out or b'id="gpChannelBox"' not in out:
        raise AssertionError('customer add tab/channel box missing')
    if b'id="salesAgents"' not in out or b'id="salesReps"' not in out:
        raise AssertionError('agents/reps sections missing')
    if b'customer-channel-offers-v2.js' in out:
        raise AssertionError('v2 overlay should be replaced')
    if b'nav-restructure-v1.js' not in out:
        raise AssertionError('nav overlay must stay')
    if b'number-counter-v1.js' in out:
        raise AssertionError('number counter must stay unlinked')


def main():
    menu2 = MENU2.read_text()
    for needle in (
        'GP_UI_MENU2_20261025',
        'قیمت و موجودی',
        'افزودن مشتری جدید',
        'کارتابل مشتریان',
        'عاملین فروش',
        'نمایندگان فروش',
        'دفتر روزانه انبار',
        'انبارگردانی',
        'customerAdd',
        'salesAgents',
    ):
        if needle not in menu2:
            raise AssertionError('menu2 missing ' + needle)
    if "group('gpCustomers','مشتریان و فروش'" in menu2:
        raise AssertionError('menu2 still uses the old customers group title')

    js = OVERLAY.read_text()
    for needle in (
        'GP_MENU_LIVE_V3_20261025',
        'sales_channel',
        'interceptNavClick',
        'gpChannelBox',
        'اضافه کردن محصول جدید',
        'زیرمجموعه بازاریاب',
        'portalOffers',
    ):
        if needle not in js:
            raise AssertionError('v3 overlay missing ' + needle)

    refine = REFINE.read_text()
    if "setGpMenuLabel(b,'لیست قیمت')" in refine:
        raise AssertionError('refine still forces old price label')
    if "setGpMenuLabel(b,'قیمت و موجودی')" not in refine:
        raise AssertionError('refine was not retitled')

    deploy = load_deploy()
    raw = ensure_live()
    if b'menu-live-v3.js?v=3' in raw and b'ui-v53435-menu2.js?v=2' in raw:
        assert_patched(raw)
        try:
            deploy.patch_html(raw)
        except RuntimeError as exc:
            if 'already' not in str(exc):
                raise
        else:
            raise AssertionError('second v3 patch should fail closed')
        print('menu live v3 passed')
        return

    out = deploy.patch_html(raw)
    assert_patched(out)
    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second v3 patch should fail closed')
    print('menu live v3 passed')


if __name__ == '__main__':
    main()
