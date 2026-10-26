#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/toggle-switch-cl-v2.js'
LIVE = Path('/tmp/live-gp/app-after-sync.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_cl', ROOT / 'scripts/deploy-production-toggle-switch-cl-v2.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ensure_live():
    if LIVE.is_file() and LIVE.stat().st_size > 10000:
        raw = LIVE.read_bytes()
        if b'toggle-switch-polish-v1.js' in raw:
            return raw
    LIVE.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen('https://ghadirpartner.ir/app.html', timeout=40) as resp:
        LIVE.write_bytes(resp.read())
    return LIVE.read_bytes()


def main():
    js = ASSET.read_text()
    for needle in (
        'GP_TOGGLE_SWITCH_CL_V2_20261026',
        'cl-switch',
        'cl-toggle-switch',
        'migrate',
        '#018786',
        '#85b8b7',
        'toggle-border',
        'customCheckBox',
        'height:32px',
        'height:34px',
        'gp-toggle-row',
        'dataset.gpToggle',
    ):
        if needle not in js:
            raise AssertionError('cl toggle overlay missing ' + needle)

    deploy = load_deploy()
    raw = ensure_live()
    if b'toggle-switch-cl-v2.js?v=1' in raw:
        try:
            deploy.patch_html(raw)
        except RuntimeError as exc:
            if 'already' not in str(exc):
                raise
        else:
            raise AssertionError('second cl toggle patch should fail closed')
        print('toggle switch cl v2 passed')
        return

    if b'toggle-switch-polish-v1.js' not in raw:
        raise AssertionError('polish v1 must already be live')
    out = deploy.patch_html(raw)
    if deploy.MARKER not in out or b'toggle-switch-cl-v2.js?v=1' not in out:
        raise AssertionError('patched HTML missing cl toggle tag')
    if b'toggle-switch-polish-v1.js' not in out:
        raise AssertionError('polish v1 must stay linked')
    if b'number-counter-v1.js' in out:
        raise AssertionError('number counter must stay unlinked')
    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second cl toggle patch should fail closed')
    print('toggle switch cl v2 passed')


if __name__ == '__main__':
    main()
