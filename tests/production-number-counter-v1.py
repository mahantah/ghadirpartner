#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/number-counter-v1.js'
LIVE = Path('/tmp/live-gp/app-after-cal.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_counter', ROOT / 'scripts/deploy-production-number-counter-v1.py')
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


def parse_display(text):
    trans = str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩٬', '01234567890123456789,')
    en = str(text).translate(trans)
    if __import__('re').search(r'\d{4}/\d{1,2}', en):
        return None
    import re
    m = re.search(r'-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?', en)
    if not m:
        return None
    return int(m.group(0).replace(',', ''))


def main():
    js = ASSET.read_text()
    for needle in (
        'GP_NUMBER_COUNTER_V1_20261025',
        '#dall',
        'gpParseDisplayNumber',
        'renderDash',
        'toLocaleString(\'fa-IR\')',
        'prefers-reduced-motion',
    ):
        if needle not in js:
            raise AssertionError('counter overlay missing ' + needle)

    if parse_display('مجموع دوره: ۱۲۳٬۴۵۶ تومان') != 123456:
        raise AssertionError('persian money parse failed')
    if parse_display('۱۴۰۵/۰۸/۰۳') is not None:
        raise AssertionError('dates must not count')
    if parse_display('کل سفارش‌ها 12') != 12:
        raise AssertionError('plain count parse failed')

    deploy = load_deploy()
    raw = ensure_live()
    if b'id="dall"' not in raw:
        raise AssertionError('live dashboard metrics missing')
    out = deploy.patch_html(raw)
    if deploy.MARKER not in out or b'number-counter-v1.js?v=1' not in out:
        raise AssertionError('patched HTML missing counter tag')
    if b'shamsi-calendar-table-v1.js' not in out:
        raise AssertionError('calendar overlay must stay')
    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second counter patch should fail closed')
    print('number counter v1 passed')


if __name__ == '__main__':
    main()
