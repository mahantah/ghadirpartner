#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def load_patch():
    spec = importlib.util.spec_from_file_location(
        'patch_exchange', ROOT / 'scripts/patch_production_order_return_exchange.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main():
    patch = load_patch()
    for path in (
        ROOT / 'lib/order-return-exchange.php',
        ROOT / 'assets/order-return-exchange-v1.js',
        ROOT / 'assets/order-return-exchange-v1.css',
    ):
        assert path.is_file(), 'missing ' + str(path)
    assert patch.MARKER in (ROOT / 'lib/order-return-exchange.php').read_text(encoding='utf-8')
    js = (ROOT / 'assets/order-return-exchange-v1.js').read_text(encoding='utf-8')
    for needle in ('GP_ORDER_RETURN_EXCHANGE_V1_20261026', 'openOrderExchange', 'request_id', 'gp-exchange-modal'):
        assert needle in js, 'js missing ' + needle

    subprocess.run(['php', str(ROOT / 'tests/order-return-exchange-scenarios.php')], check=True)

    with urllib.request.urlopen('https://ghadirpartner.ir/app.html', timeout=40) as resp:
        live = resp.read().decode('utf-8', 'replace')
    if patch.MARKER in live:
        assert 'order-return-exchange-v1.js?v=1' in live
        assert 'order-return-exchange-v1.css?v=1' in live
        with urllib.request.urlopen(
            'https://ghadirpartner.ir/assets/order-return-exchange-v1.js?v=1', timeout=30
        ) as resp:
            assert b'openOrderExchange' in resp.read()
    else:
        sample = live + '\n<!-- anchor -->\n<script src="/assets/portal-orders-polish-v4.js?v=1"></script>\n'
        out = patch.patch_app_html(sample)
        assert patch.MARKER in out
    print('production-order-return-exchange-v1 checks passed')


if __name__ == '__main__':
    main()
