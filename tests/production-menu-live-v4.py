#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
MENU2 = ROOT / 'assets/ui-v53435-menu2.js'
V3 = ROOT / 'assets/menu-live-v3.js'
V4 = ROOT / 'assets/menu-live-v4.js'
LIVE = Path('/tmp/live-gp/app-v3.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_menu4', ROOT / 'scripts/deploy-production-menu-live-v4.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ensure_live():
    if LIVE.is_file() and LIVE.stat().st_size > 10000 and b'ui-v53435-menu2.js' in LIVE.read_bytes():
        return LIVE.read_bytes()
    LIVE.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen('https://ghadirpartner.ir/app.html', timeout=40) as resp:
        LIVE.write_bytes(resp.read())
    return LIVE.read_bytes()


def assert_patched(out):
    if b'GP_MENU_LIVE_V4_20261025' not in out or b'menu-live-v4.js?v=4' not in out:
        raise AssertionError('patched HTML missing v4 tag')
    if b'ui-v53435-menu2.js?v=3' not in out:
        raise AssertionError('menu2 cache was not busted')
    if b'ui-v53435-menu2.js?v=2"' in out:
        raise AssertionError('old menu2 query must not stay')
    if b'menu-live-v3.js?v=3' not in out:
        raise AssertionError('v3 overlay should stay for add-customer')
    if b'id="customerAdd"' not in out or b'id="gpChannelBox"' not in out:
        raise AssertionError('customer add section missing')
    if b'number-counter-v1.js' in out:
        raise AssertionError('number counter must stay unlinked')


def main():
    menu2 = MENU2.read_text()
    for needle in ('gpNavDump', 'gpNavCatalog', 'قیمت و موجودی'):
        if needle not in menu2:
            raise AssertionError('menu2 missing ' + needle)

    v3 = V3.read_text()
    if 'setInterval(lockCatalogLabel' in v3:
        raise AssertionError('v3 must not keep a catalog timer')

    v4 = V4.read_text()
    for needle in (
        'GP_MENU_LIVE_V4_20261025',
        'gpNavDump',
        'gpNavCatalog',
        'freezeCatalogWrites',
        'لیست قیمت',
    ):
        if needle not in v4:
            raise AssertionError('v4 overlay missing ' + needle)

    deploy = load_deploy()
    raw = ensure_live()
    if b'menu-live-v4.js?v=4' in raw and b'ui-v53435-menu2.js?v=3' in raw:
        assert_patched(raw)
        try:
            deploy.patch_html(raw)
        except RuntimeError as exc:
            if 'already' not in str(exc):
                raise
        else:
            raise AssertionError('second v4 patch should fail closed')
        print('menu live v4 passed')
        return

    out = deploy.patch_html(raw)
    assert_patched(out)
    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second v4 patch should fail closed')
    print('menu live v4 passed')


if __name__ == '__main__':
    main()
