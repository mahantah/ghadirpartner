#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/coop-model-v1.js'
LIVE = Path('/tmp/live-gp/app-v4.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_coop', ROOT / 'scripts/deploy-production-coop-model-v1.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ensure_live():
    if LIVE.is_file() and LIVE.stat().st_size > 10000:
        raw = LIVE.read_bytes()
        if b'menu-live-v4.js' in raw:
            return raw
    LIVE.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen('https://ghadirpartner.ir/app.html', timeout=40) as resp:
        LIVE.write_bytes(resp.read())
    return LIVE.read_bytes()


def main():
    js = ASSET.read_text()
    for needle in (
        'GP_COOP_MODEL_V1_20261025',
        'gp-coop-agent',
        'gp-coop-marketer',
        'gp-coop-sub',
        'gpEditCoopBox',
        'sales_channel',
        'visible_price_groups',
        'panel',
        'serial',
        'مدل همکاری',
    ):
        if needle not in js:
            raise AssertionError('coop overlay missing ' + needle)
    if "pricesFor('agent')" not in js and "kind === 'agent'" not in js:
        raise AssertionError('agent price rule missing')

    deploy = load_deploy()
    raw = ensure_live()
    if b'coop-model-v1.js?v=1' in raw:
        try:
            deploy.patch_html(raw)
        except RuntimeError as exc:
            if 'already' not in str(exc):
                raise
        else:
            raise AssertionError('second coop patch should fail closed')
        print('coop model v1 passed')
        return

    out = deploy.patch_html(raw)
    if deploy.MARKER not in out or b'coop-model-v1.js?v=1' not in out:
        raise AssertionError('patched HTML missing coop tag')
    if b'menu-live-v4.js' not in out:
        raise AssertionError('menu v4 must stay')
    if b'number-counter-v1.js' in out:
        raise AssertionError('number counter must stay unlinked')
    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second coop patch should fail closed')
    print('coop model v1 passed')


if __name__ == '__main__':
    main()
