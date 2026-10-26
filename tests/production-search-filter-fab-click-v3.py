#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/search-filter-fab-click-v3.js'
LIVE = Path('/tmp/live-gp/app-after-sync.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_fab_click', ROOT / 'scripts/deploy-production-search-filter-fab-click-v3.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ensure_live():
    if LIVE.is_file() and LIVE.stat().st_size > 10000:
        raw = LIVE.read_bytes()
        if b'wh-label-v1.js' in raw:
            return raw
    LIVE.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen('https://ghadirpartner.ir/app.html', timeout=40) as resp:
        LIVE.write_bytes(resp.read())
    return LIVE.read_bytes()


def main():
    js = ASSET.read_text()
    for needle in (
        'GP_SEARCH_FILTER_FAB_CLICK_V3_20261026',
        'pointer-events:none',
        'gp-fab-back',
        'display:none',
        'disarmBack',
        'bindOutside',
    ):
        if needle not in js:
            raise AssertionError('fab click overlay missing ' + needle)
    if 'pointer-events:auto!important' in js and '#gpSearchFabRoot .gp-fab-back' in js:
        back_auto = False
        for block in js.split('#gpSearchFabRoot .gp-fab-back'):
            if 'pointer-events:auto' in block[:200]:
                back_auto = True
        if back_auto:
            raise AssertionError('backdrop must not capture clicks')

    deploy = load_deploy()
    raw = ensure_live()
    if b'search-filter-fab-click-v3.js?v=1' in raw:
        try:
            deploy.patch_html(raw)
        except RuntimeError as exc:
            if 'already' not in str(exc):
                raise
        else:
            raise AssertionError('second fab click patch should fail closed')
        print('search filter fab click v3 passed')
        return

    if b'wh-label-v1.js' not in raw:
        raise AssertionError('warehouse label v1 must already be live')
    out = deploy.patch_html(raw)
    if deploy.MARKER not in out or b'search-filter-fab-click-v3.js?v=1' not in out:
        raise AssertionError('patched HTML missing fab click tag')
    if b'number-counter-v1.js' in out:
        raise AssertionError('number counter must stay unlinked')
    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second fab click patch should fail closed')
    print('search filter fab click v3 passed')


if __name__ == '__main__':
    main()
