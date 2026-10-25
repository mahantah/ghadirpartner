#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/shamsi-calendar-table-v1.js'
LIVE = Path('/tmp/live-gp/app-after-eod.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_cal', ROOT / 'scripts/deploy-production-shamsi-calendar-v1.py')
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


def month_days(jy, jm):
    if jm <= 6:
        return 31
    if jm <= 11:
        return 30
    return 30 if ((jy % 33) in (1, 5, 9, 13, 17, 22, 26, 30)) else 29


def main():
    js = ASSET.read_text()
    for needle in (
        'GP_SHAMSI_CALENDAR_TABLE_V1_20261025',
        'gp-cal-days',
        'فروردین',
        'toggleJPicker',
        'warehouseLedgerMonth',
        'data-gp-cal="day"',
    ):
        if needle not in js:
            raise AssertionError('calendar overlay missing ' + needle)
    if 'jpicker-grid' in js and 'select class="jd"' in js:
        raise AssertionError('old three-dropdown picker must not remain')

    if month_days(1403, 12) != 30:
        raise AssertionError('1403 Esfand must be 30')
    if month_days(1404, 12) != 29:
        raise AssertionError('1404 Esfand must be 29')
    if month_days(1405, 1) != 31 or month_days(1405, 8) != 30:
        raise AssertionError('month lengths are wrong')

    deploy = load_deploy()
    raw = ensure_live()
    if b'function toggleJPicker' not in raw:
        raise AssertionError('live app.html lost jalali picker')
    out = deploy.patch_html(raw)
    if deploy.MARKER not in out or b'shamsi-calendar-table-v1.js?v=1' not in out:
        raise AssertionError('patched HTML missing calendar tag')
    if b'warehouse-ledger-eod-freeze-v1.js' not in out:
        raise AssertionError('ledger freeze overlay must stay')
    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second calendar patch should fail closed')
    print('shamsi calendar table v1 passed')


if __name__ == '__main__':
    main()
