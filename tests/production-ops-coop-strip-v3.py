#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/ops-coop-strip-v3.js'
LIVE = Path('/tmp/live-gp/app-after-sync.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_ops_coop_strip', ROOT / 'scripts/deploy-production-ops-coop-strip-v3.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ensure_live():
    if LIVE.is_file() and LIVE.stat().st_size > 10000:
        raw = LIVE.read_bytes()
        if b'warehouse-ops-harden-v2.js' in raw:
            return raw
    LIVE.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen('https://ghadirpartner.ir/app.html', timeout=40) as resp:
        LIVE.write_bytes(resp.read())
    return LIVE.read_bytes()


def main():
    js = ASSET.read_text()
    for needle in (
        'GP_OPS_COOP_STRIP_V3_20261026',
        'gp-ops-quick',
        'stripAll',
        'تغییر نوع همکاری',
        'عاملین فروش',
    ):
        if needle not in js:
            raise AssertionError('ops coop strip overlay missing ' + needle)

    deploy = load_deploy()
    raw = ensure_live()
    if b'ops-coop-strip-v3.js?v=1' in raw:
        try:
            deploy.patch_html(raw)
        except RuntimeError as exc:
            if 'already' not in str(exc):
                raise
        else:
            raise AssertionError('second ops coop strip patch should fail closed')
        print('ops coop strip v3 passed')
        return

    if b'warehouse-ops-harden-v2.js' not in raw:
        raise AssertionError('warehouse ops harden v2 must already be live')
    out = deploy.patch_html(raw)
    if deploy.MARKER not in out or b'ops-coop-strip-v3.js?v=1' not in out:
        raise AssertionError('patched HTML missing ops coop strip tag')
    if b'number-counter-v1.js' in out:
        raise AssertionError('number counter must stay unlinked')
    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second ops coop strip patch should fail closed')
    print('ops coop strip v3 passed')


if __name__ == '__main__':
    main()
