#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/form-card-compact-v1.js'
LIVE = Path('/tmp/live-gp/app-after-sync.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_compact', ROOT / 'scripts/deploy-production-form-card-compact-v1.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ensure_live():
    if LIVE.is_file() and LIVE.stat().st_size > 10000:
        raw = LIVE.read_bytes()
        if b'toggle-switch-cl-v2.js' in raw:
            return raw
    LIVE.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen('https://ghadirpartner.ir/app.html', timeout=40) as resp:
        LIVE.write_bytes(resp.read())
    return LIVE.read_bytes()


def main():
    js = ASSET.read_text()
    for needle in (
        'GP_FORM_CARD_COMPACT_V1_20261026',
        'gp-form-compact',
        'max-width:680px',
        'fit-content',
        'customCheckBoxHolder',
        'customerAddCard',
        'gpChannelBox',
    ):
        if needle not in js:
            raise AssertionError('compact overlay missing ' + needle)

    deploy = load_deploy()
    raw = ensure_live()
    if b'form-card-compact-v1.js?v=1' in raw:
        try:
            deploy.patch_html(raw)
        except RuntimeError as exc:
            if 'already' not in str(exc):
                raise
        else:
            raise AssertionError('second compact patch should fail closed')
        print('form card compact v1 passed')
        return

    if b'toggle-switch-cl-v2.js' not in raw:
        raise AssertionError('cl toggle v2 must already be live')
    out = deploy.patch_html(raw)
    if deploy.MARKER not in out or b'form-card-compact-v1.js?v=1' not in out:
        raise AssertionError('patched HTML missing compact tag')
    if b'toggle-switch-cl-v2.js' not in out:
        raise AssertionError('cl toggle v2 must stay linked')
    if b'number-counter-v1.js' in out:
        raise AssertionError('number counter must stay unlinked')
    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second compact patch should fail closed')
    print('form card compact v1 passed')


if __name__ == '__main__':
    main()
