#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/customer-ops-stabilize-v1.js'
LIVE = Path('/tmp/live-gp/app-after-sync.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_stab', ROOT / 'scripts/deploy-production-customer-ops-stabilize-v1.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ensure_live():
    if LIVE.is_file() and LIVE.stat().st_size > 10000:
        raw = LIVE.read_bytes()
        if b'sales-plans-menu-v1.js' in raw:
            return raw
    LIVE.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen('https://ghadirpartner.ir/app.html', timeout=40) as resp:
        LIVE.write_bytes(resp.read())
    return LIVE.read_bytes()


def main():
    js = ASSET.read_text()
    for needle in (
        'GP_CUSTOMER_OPS_STABILIZE_V1_20261025',
        'rep_role',
        'sales_channel',
        'lightRefresh',
        '/api/notifications',
        'نماینده',
        'طرح‌ها و تخفیف‌ها',
        'عاملین فروش',
        'gpEditChannel',
        'payloadFromKind',
    ):
        if needle not in js:
            raise AssertionError('stabilize overlay missing ' + needle)

    deploy = load_deploy()
    raw = ensure_live()
    if b'customer-ops-stabilize-v1.js?v=1' in raw:
        try:
            deploy.patch_html(raw)
        except RuntimeError as exc:
            if 'already' not in str(exc):
                raise
        else:
            raise AssertionError('second stabilize patch should fail closed')
        print('customer ops stabilize v1 passed')
        return

    out = deploy.patch_html(raw)
    if deploy.MARKER not in out or b'customer-ops-stabilize-v1.js?v=1' not in out:
        raise AssertionError('patched HTML missing stabilize tag')
    if b'sales-plans-menu-v1.js' not in out:
        raise AssertionError('sales plans menu must stay')
    if b'kartabl-sync-v1.js' not in out:
        raise AssertionError('kartabl sync must stay')
    if b'number-counter-v1.js' in out:
        raise AssertionError('number counter must stay unlinked')
    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second stabilize patch should fail closed')
    print('customer ops stabilize v1 passed')


if __name__ == '__main__':
    main()
