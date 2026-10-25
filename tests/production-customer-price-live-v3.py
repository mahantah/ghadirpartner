#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/customer-price-access-live-v3.js'
LIVE = Path('/tmp/live-gp/app-now.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_v3', ROOT / 'scripts/deploy-production-customer-price-live-v3.py')
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
        'GP_CUSTOMER_PRICE_ACCESS_LIVE_V3_20261025',
        'openCustomerPriceEdit',
        'saveCustomerPrices',
        "visible_price_groups: readGroups('ep')",
        "visible_price_groups: readGroups('cp')",
        'ویرایش قیمت',
        'setTimeout(bind, 400)',
        'setTimeout(bind, 1200)',
        'toggleCustomerMenu',
        'customer-price-edit',
    ):
        if needle not in js:
            raise AssertionError('overlay missing ' + needle)

    deploy = load_deploy()
    raw = ensure_live()
    if b'business-v53437.js' not in raw:
        raise AssertionError('live app.html no longer has the business overlay')
    if b'</body></html>' not in raw:
        raise AssertionError('live app.html closing body changed')

    out = deploy.patch_html(raw)
    if deploy.MARKER not in out:
        raise AssertionError('patched HTML missing overlay marker')
    if deploy.TAG.strip() not in out:
        raise AssertionError('patched HTML missing overlay script tag')
    if out.count(b'customer-price-access-live-v3.js') != 1:
        raise AssertionError('unexpected overlay script count')
    if not out.endswith(b'</body></html>\n') and not out.endswith(b'</body></html>'):
        raise AssertionError('patched HTML lost document close')

    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second live-v3 patch should fail closed')

    print('customer price live v3 passed')


if __name__ == '__main__':
    main()
