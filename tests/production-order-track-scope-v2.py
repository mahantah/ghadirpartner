#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/order-track-scope-v2.js'
LIVE = Path('/tmp/live-gp/app-after-sync.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_order_track_scope', ROOT / 'scripts/deploy-production-order-track-scope-v2.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ensure_live():
    if LIVE.is_file() and LIVE.stat().st_size > 10000:
        raw = LIVE.read_bytes()
        if b'order-track-orders-v1.js' in raw:
            return raw
    LIVE.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen('https://ghadirpartner.ir/app.html', timeout=40) as resp:
        LIVE.write_bytes(resp.read())
    return LIVE.read_bytes()


def main():
    js = ASSET.read_text()
    for needle in (
        'GP_ORDER_TRACK_SCOPE_V2_20261026',
        'shippingAlert',
        'gpOrderTrack',
        'gp-ship-ok',
        'GP_ORDER_SCOPE',
        'dashboard',
        'orders',
        'نمایش همه سفارشات',
        'clearFilter',
    ):
        if needle not in js:
            raise AssertionError('order track scope overlay missing ' + needle)
    if '#gpOrderTrack{display:none!important}' not in js:
        raise AssertionError('rejected tracker card must stay hidden')

    deploy = load_deploy()
    raw = ensure_live()
    if b'order-track-scope-v2.js?v=1' in raw:
        try:
            deploy.patch_html(raw)
        except RuntimeError as exc:
            if 'already' not in str(exc):
                raise
        else:
            raise AssertionError('second order track scope patch should fail closed')
        print('order track scope v2 passed')
        return

    if b'order-track-orders-v1.js' not in raw:
        raise AssertionError('order track orders v1 must already be live')
    out = deploy.patch_html(raw)
    if deploy.MARKER not in out or b'order-track-scope-v2.js?v=1' not in out:
        raise AssertionError('patched HTML missing order track scope tag')
    if b'number-counter-v1.js' in out:
        raise AssertionError('number counter must stay unlinked')
    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second order track scope patch should fail closed')
    print('order track scope v2 passed')


if __name__ == '__main__':
    main()
