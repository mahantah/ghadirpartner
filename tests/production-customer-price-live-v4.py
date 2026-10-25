#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/customer-price-access-live-v4.js'
LIVE = Path('/tmp/live-gp/app-after-v3.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_v4', ROOT / 'scripts/deploy-production-customer-price-live-v4.py')
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
        'GP_CUSTOMER_PRICE_ACCESS_LIVE_V4_20261025',
        'saveCustomerMenuPrices',
        'customer-price-box',
        "visible_price_groups: readGroups('mp')",
        "visible_price_groups: readGroups('ep')",
        "visible_price_groups: readGroups('cp')",
        'toggleCustomerMenu',
    ):
        if needle not in js:
            raise AssertionError('overlay missing ' + needle)
    for banned in ('openCustomerPriceEdit', 'window.renderCustomers'):
        if banned in js:
            raise AssertionError('v4 must not keep ' + banned)

    deploy = load_deploy()
    raw = ensure_live()
    out = deploy.patch_html(raw)
    if deploy.MARKER not in out:
        raise AssertionError('patched HTML missing v4 marker')
    if deploy.TAG.strip() not in out:
        raise AssertionError('patched HTML missing v4 script tag')
    if b'customer-price-access-live-v3.js' in out:
        raise AssertionError('v3 script should be replaced')
    if out.count(b'customer-price-access-live-v4.js') != 1:
        raise AssertionError('unexpected v4 script count')

    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second live-v4 patch should fail closed')

    print('customer price live v4 passed')


if __name__ == '__main__':
    main()
