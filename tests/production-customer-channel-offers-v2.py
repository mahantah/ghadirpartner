#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/customer-channel-offers-v2.js'
LIVE = Path('/tmp/live-gp/app-check.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_ch2', ROOT / 'scripts/deploy-production-customer-channel-offers-v2.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ensure_live():
    if LIVE.is_file() and LIVE.stat().st_size > 10000:
        raw = LIVE.read_bytes()
        if b'nav-restructure-v1.js' in raw:
            return raw
    LIVE.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen('https://ghadirpartner.ir/app.html', timeout=40) as resp:
        LIVE.write_bytes(resp.read())
    return LIVE.read_bytes()


def main():
    js = ASSET.read_text()
    for needle in (
        'GP_CUSTOMER_CHANNEL_OFFERS_V2_20261025',
        'sales_channel',
        'interceptNavClick',
        'gpChannelBox',
        'قیمت و موجودی',
        'عاملین فروش',
        'زیرمجموعه بازاریاب',
        'customerAdd',
        'portalOffers',
    ):
        if needle not in js:
            raise AssertionError('v2 overlay missing ' + needle)

    deploy = load_deploy()
    raw = ensure_live()
    out = deploy.patch_html(raw)
    if deploy.MARKER not in out or b'customer-channel-offers-v2.js?v=2' not in out:
        raise AssertionError('patched HTML missing v2 tag')
    if b'customer-channel-offers-v1.js' in out:
        raise AssertionError('v1 script should be replaced')
    if b'nav-restructure-v1.js' not in out:
        raise AssertionError('nav overlay must stay')
    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second v2 patch should fail closed')

    refine = Path('/tmp/live-gp/assets/warehouse-ui-refine-v53438.js')
    if refine.is_file():
        patched = deploy.patch_refine(refine.read_bytes())
        if "setGpMenuLabel(b,'لیست قیمت')".encode() in patched:
            raise AssertionError('refine still forces old price label')
        if "setGpMenuLabel(b,'قیمت و موجودی')".encode() not in patched:
            raise AssertionError('refine was not retitled')
    print('customer channel offers v2 passed')


if __name__ == '__main__':
    main()
