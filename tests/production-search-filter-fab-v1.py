#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/search-filter-fab-v1.js'
LIVE = Path('/tmp/live-gp/app-after-sync.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_fab', ROOT / 'scripts/deploy-production-search-filter-fab-v1.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ensure_live():
    if LIVE.is_file() and LIVE.stat().st_size > 10000:
        raw = LIVE.read_bytes()
        if b'session-keep-v1.js' in raw:
            return raw
    LIVE.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen('https://ghadirpartner.ir/app.html', timeout=40) as resp:
        LIVE.write_bytes(resp.read())
    return LIVE.read_bytes()


def main():
    js = ASSET.read_text()
    for needle in (
        'GP_SEARCH_FILTER_FAB_V1_20261026',
        'gpSearchFab',
        'جستجو و فیلتر',
        'مخزن',
        'applyWarehouse',
        'gpFabAdopted',
        'ensureWarehouseFields',
        'gpFabWhQ',
        'shouldAdopt',
    ):
        if needle not in js:
            raise AssertionError('search filter fab overlay missing ' + needle)

    deploy = load_deploy()
    raw = ensure_live()
    if b'search-filter-fab-v1.js?v=1' in raw:
        try:
            deploy.patch_html(raw)
        except RuntimeError as exc:
            if 'already' not in str(exc):
                raise
        else:
            raise AssertionError('second search filter fab patch should fail closed')
        print('search filter fab v1 passed')
        return

    if b'session-keep-v1.js' not in raw:
        raise AssertionError('session keep must already be live')
    out = deploy.patch_html(raw)
    if deploy.MARKER not in out or b'search-filter-fab-v1.js?v=1' not in out:
        raise AssertionError('patched HTML missing search filter fab tag')
    if b'number-counter-v1.js' in out:
        raise AssertionError('number counter must stay unlinked')
    if out.count(b'search-filter-fab-v1.js?v=1') != 1:
        raise AssertionError('search filter fab must be linked once')
    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second search filter fab patch should fail closed')
    print('search filter fab v1 passed')


if __name__ == '__main__':
    main()
