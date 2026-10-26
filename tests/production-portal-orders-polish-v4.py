#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/portal-orders-polish-v4.js'
LIVE = Path('/tmp/live-gp/app-after-sync.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_portal_orders_polish', ROOT / 'scripts/deploy-production-portal-orders-polish-v4.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ensure_live():
    if LIVE.is_file() and LIVE.stat().st_size > 10000:
        raw = LIVE.read_bytes()
        if b'order-track-hide-list-v3.js' in raw:
            return raw
    LIVE.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen('https://ghadirpartner.ir/app.html', timeout=40) as resp:
        LIVE.write_bytes(resp.read())
    return LIVE.read_bytes()


def main():
    js = ASSET.read_text()
    for needle in (
        'GP_PORTAL_ORDERS_POLISH_V4_20261026',
        'data-portal-view="resets"',
        'data-portal-view="sms"',
        'gpClearOrderFilter',
        'shipping-alert-orders',
        'stripPortalRows',
        'dropExtraBoxes',
        'نمایش همه سفارشات',
    ):
        if needle not in js:
            raise AssertionError('portal orders polish overlay missing ' + needle)

    deploy = load_deploy()
    raw = ensure_live()
    if b'portal-orders-polish-v4.js?v=1' in raw:
        try:
            deploy.patch_html(raw)
        except RuntimeError as exc:
            if 'already' not in str(exc):
                raise
        else:
            raise AssertionError('second portal orders polish patch should fail closed')
        print('portal orders polish v4 passed')
        return

    if b'order-track-hide-list-v3.js' not in raw:
        raise AssertionError('order track hide list v3 must already be live')
    out = deploy.patch_html(raw)
    if deploy.MARKER not in out or b'portal-orders-polish-v4.js?v=1' not in out:
        raise AssertionError('patched HTML missing portal orders polish tag')
    if b'number-counter-v1.js' in out:
        raise AssertionError('number counter must stay unlinked')
    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second portal orders polish patch should fail closed')
    print('portal orders polish v4 passed')


if __name__ == '__main__':
    main()
