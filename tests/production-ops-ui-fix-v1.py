#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/ops-ui-fix-v1.js'
LIVE = Path('/tmp/live-gp/app-after-sync.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_ops', ROOT / 'scripts/deploy-production-ops-ui-fix-v1.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ensure_live():
    if LIVE.is_file() and LIVE.stat().st_size > 10000:
        raw = LIVE.read_bytes()
        if b'kartabl-sync-v1.js' in raw:
            return raw
    LIVE.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen('https://ghadirpartner.ir/app.html', timeout=40) as resp:
        LIVE.write_bytes(resp.read())
    return LIVE.read_bytes()


def main():
    js = ASSET.read_text()
    for needle in (
        'GP_OPS_UI_FIX_V1_20261025',
        'isMarketer',
        'gpResetCustomerPassword',
        'تغییر شماره تماس',
        'background:#fff!important',
        'color:#111!important',
        'data-portal-view="catalog"',
        'data-portal-view="offers"',
        'نام بازاریاب را بنویسید',
    ):
        if needle not in js:
            raise AssertionError('ops ui fix overlay missing ' + needle)

    deploy = load_deploy()
    raw = ensure_live()
    if b'ops-ui-fix-v1.js?v=1' in raw:
        try:
            deploy.patch_html(raw)
        except RuntimeError as exc:
            if 'already' not in str(exc):
                raise
        else:
            raise AssertionError('second ops ui patch should fail closed')
        print('ops ui fix v1 passed')
        return

    out = deploy.patch_html(raw)
    if deploy.MARKER not in out or b'ops-ui-fix-v1.js?v=1' not in out:
        raise AssertionError('patched HTML missing ops ui tag')
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
        raise AssertionError('second ops ui patch should fail closed')
    print('ops ui fix v1 passed')


if __name__ == '__main__':
    main()
