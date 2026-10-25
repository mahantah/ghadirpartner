#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/choice-ui-icons-v1.js'
LIVE = Path('/tmp/live-gp/app-after-sync.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_choice', ROOT / 'scripts/deploy-production-choice-ui-icons-v1.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ensure_live():
    if LIVE.is_file() and LIVE.stat().st_size > 10000:
        raw = LIVE.read_bytes()
        if b'plans-icon-agent-lock-v1.js' in raw:
            return raw
    LIVE.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen('https://ghadirpartner.ir/app.html', timeout=40) as resp:
        LIVE.write_bytes(resp.read())
    return LIVE.read_bytes()


def main():
    js = ASSET.read_text()
    for needle in (
        'GP_CHOICE_UI_ICONS_V1_20261025',
        'customCheckBoxHolder',
        'customCheckBoxInput',
        'gpNavAddCustomer',
        'gpNavKartabl',
        'gpNavAgents',
        'gpNavReps',
        'gpNavPlans',
        'gp-coop-rep',
        'background:#fff!important',
        'نماینده',
        'عامل فروش',
        'عاملین فروش',
    ):
        if needle not in js:
            raise AssertionError('choice overlay missing ' + needle)

    deploy = load_deploy()
    raw = ensure_live()
    if b'choice-ui-icons-v1.js?v=1' in raw:
        try:
            deploy.patch_html(raw)
        except RuntimeError as exc:
            if 'already' not in str(exc):
                raise
        else:
            raise AssertionError('second choice patch should fail closed')
        print('choice ui icons v1 passed')
        return

    out = deploy.patch_html(raw)
    if deploy.MARKER not in out or b'choice-ui-icons-v1.js?v=1' not in out:
        raise AssertionError('patched HTML missing choice tag')
    if b'plans-icon-agent-lock-v1.js' not in out:
        raise AssertionError('plans icon lock must stay')
    if b'number-counter-v1.js' in out:
        raise AssertionError('number counter must stay unlinked')
    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second choice patch should fail closed')
    print('choice ui icons v1 passed')


if __name__ == '__main__':
    main()
