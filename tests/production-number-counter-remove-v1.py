#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
LIVE = Path('/tmp/live-gp/app-after-counter.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'remove_counter', ROOT / 'scripts/deploy-production-number-counter-remove-v1.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ensure_live():
    if LIVE.is_file() and LIVE.stat().st_size > 10000:
        return LIVE.read_bytes()
    LIVE.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen('https://ghadirpartner.ir/app.html', timeout=40) as resp:
        LIVE.write_bytes(resp.read())
    return LIVE.read_bytes()


def main():
    deploy = load_deploy()
    raw = ensure_live()
    if b'number-counter-v1.js' not in raw:
        raise AssertionError('live snapshot has no counter to remove')
    out = deploy.patch_html(raw)
    if b'number-counter-v1.js' in out or b'GP_NUMBER_COUNTER_V1_20261025' in out:
        raise AssertionError('counter tag still present')
    if b'shamsi-calendar-table-v1.js' not in out:
        raise AssertionError('calendar overlay must stay')
    if b'customer-price-access-live-v4.js' not in out:
        raise AssertionError('price overlay must stay')
    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second removal should fail closed')
    print('number counter remove v1 passed')


if __name__ == '__main__':
    main()
