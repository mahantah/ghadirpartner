#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/warehouse-ledger-eod-freeze-v1.js'
LIVE = Path('/tmp/live-gp/app-after-v4.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_eod', ROOT / 'scripts/deploy-production-warehouse-ledger-eod-v1.py')
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


def stock_on_day(current, movements, product, jday, today, wid=1):
    q = int(current.get(product) or 0)
    if jday == today:
        return q
    for mv in movements:
        if str(mv.get('product') or '') != product:
            continue
        md = str(mv.get('jdate') or '')
        if md and md > jday and md <= today:
            if int(mv.get('to_warehouse_id') or 0) == wid:
                q -= int(mv.get('qty') or 0)
            if int(mv.get('from_warehouse_id') or 0) == wid:
                q += int(mv.get('qty') or 0)
    return q


def main():
    js = ASSET.read_text()
    for needle in (
        'GP_LEDGER_EOD_FREEZE_V1_20261025',
        'gpLedgerStockOnJalaliDay',
        'Asia/Tehran',
        'rememberLive',
        'renderWarehouseLedger',
    ):
        if needle not in js:
            raise AssertionError('overlay missing ' + needle)

    current = {'I90': 17}
    moves = [
        {'product': 'I90', 'from_warehouse_id': 1, 'to_warehouse_id': 0, 'qty': 3, 'jdate': '1405/08/03'},
        {'product': 'I90', 'from_warehouse_id': 1, 'to_warehouse_id': 0, 'qty': 5, 'jdate': '1405/08/04'},
    ]
    if stock_on_day(current, moves, 'I90', '1405/08/04', '1405/08/04') != 17:
        raise AssertionError('today must stay live')
    if stock_on_day(current, moves, 'I90', '1405/08/03', '1405/08/04') != 22:
        raise AssertionError('yesterday must ignore today drop')
    if stock_on_day(current, moves, 'I90', '1405/08/02', '1405/08/04') != 25:
        raise AssertionError('older day must keep both later drops')
    later = {'I90': 14}
    later_moves = moves + [
        {'product': 'I90', 'from_warehouse_id': 1, 'to_warehouse_id': 0, 'qty': 3, 'jdate': '1405/08/04'},
    ]
    if stock_on_day(later, later_moves, 'I90', '1405/08/03', '1405/08/04') != 22:
        raise AssertionError('another drop today must not rewrite yesterday')

    deploy = load_deploy()
    raw = ensure_live()
    out = deploy.patch_html(raw)
    if deploy.MARKER not in out or deploy.TAG.strip() not in out:
        raise AssertionError('patched HTML missing eod freeze tag')
    if out.count(b'warehouse-ledger-eod-freeze-v1.js') != 1:
        raise AssertionError('unexpected eod script count')
    if b'customer-price-access-live-v4.js' not in out:
        raise AssertionError('price overlay must stay linked')
    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second eod patch should fail closed')
    print('warehouse ledger eod freeze v1 passed')


if __name__ == '__main__':
    main()
