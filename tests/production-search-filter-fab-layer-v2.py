#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/search-filter-fab-layer-v2.js'
ASSET_V1 = ROOT / 'assets/search-filter-fab-v1.js'
LIVE = Path('/tmp/live-gp/app-after-sync.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_fab_layer', ROOT / 'scripts/deploy-production-search-filter-fab-layer-v2.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ensure_live():
    if LIVE.is_file() and LIVE.stat().st_size > 10000:
        raw = LIVE.read_bytes()
        if b'search-filter-fab-v1.js' in raw:
            return raw
    LIVE.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen('https://ghadirpartner.ir/app.html', timeout=40) as resp:
        LIVE.write_bytes(resp.read())
    return LIVE.read_bytes()


def main():
    js = ASSET.read_text()
    for needle in (
        'GP_SEARCH_FILTER_FAB_LAYER_V2_20261026',
        'z-index:260',
        'pointer-events:auto',
        'gp-fab-sheet',
        'gp-fab-back',
    ):
        if needle not in js:
            raise AssertionError('fab layer overlay missing ' + needle)

    v1 = ASSET_V1.read_text()
    if 'z-index:260' not in v1 or 'z-index:3' not in v1:
        raise AssertionError('fab v1 missing sheet-above-backdrop fix')

    deploy = load_deploy()
    raw = ensure_live()
    if b'search-filter-fab-layer-v2.js?v=1' in raw:
        try:
            deploy.patch_html(raw)
        except RuntimeError as exc:
            if 'already' not in str(exc):
                raise
        else:
            raise AssertionError('second fab layer patch should fail closed')
        print('search filter fab layer v2 passed')
        return

    if b'search-filter-fab-v1.js' not in raw:
        raise AssertionError('search filter fab v1 must already be live')
    out = deploy.patch_html(raw)
    if deploy.MARKER not in out or b'search-filter-fab-layer-v2.js?v=1' not in out:
        raise AssertionError('patched HTML missing fab layer tag')
    if b'number-counter-v1.js' in out:
        raise AssertionError('number counter must stay unlinked')
    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second fab layer patch should fail closed')
    print('search filter fab layer v2 passed')


if __name__ == '__main__':
    main()
