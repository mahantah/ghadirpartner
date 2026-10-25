#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/customer-channel-offers-v1.js'
LIVE = Path('/tmp/live-gp/app-now.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_ch', ROOT / 'scripts/deploy-production-customer-channel-offers-v1.py')
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
        'GP_CUSTOMER_CHANNEL_OFFERS_V1_20261025',
        'sales_channel',
        'gpChannel',
        'gpRepRole',
        'gpRepParent',
        'عاملین فروش',
        'نمایندگان',
        'بازاریاب',
        'زیرمجموعه بازاریاب',
        'customerAdd',
        'portalOffers',
        'portalAccounts',
    ):
        if needle not in js:
            raise AssertionError('channel overlay missing ' + needle)

    deploy = load_deploy()
    raw = ensure_live()
    if b'nav-restructure-v1.js' not in raw:
        raise AssertionError('live app.html lost nav restructure')
    out = deploy.patch_html(raw)
    if deploy.MARKER not in out or b'customer-channel-offers-v1.js?v=1' not in out:
        raise AssertionError('patched HTML missing channel tag')
    if b'nav-restructure-v1.js' not in out:
        raise AssertionError('nav overlay must stay')
    if b'shamsi-calendar-table-v1.js' not in out:
        raise AssertionError('calendar overlay must stay')
    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second channel patch should fail closed')
    print('customer channel offers v1 passed')


if __name__ == '__main__':
    main()
