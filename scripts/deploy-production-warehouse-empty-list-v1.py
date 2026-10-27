#!/usr/bin/env python3
"""Fix empty warehouse list after checkbox column (FAB filter + row code)."""
from pathlib import Path
import os
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[1]
FAB = REPO / 'assets' / 'search-filter-fab-v1.js'
CARTON = REPO / 'assets' / 'warehouse-carton-multilabel-v53438.js'
APP_REMOTE = '/app.html'
FAB_OLD = '/assets/search-filter-fab-v1.js?v=2'
FAB_NEW = '/assets/search-filter-fab-v1.js?v=3'
CARTON_OLD = '/assets/warehouse-carton-multilabel-v53438.js?v=53438whprint6'
CARTON_NEW = '/assets/warehouse-carton-multilabel-v53438.js?v=53438whprint7'
NOTE = '<!-- GP_WAREHOUSE_EMPTY_LIST_FIX_V1_20261027 -->\n'


def quote(value):
    return '"' + str(value).replace('\\', '\\\\').replace('"', '\\"') + '"'


def ftp(commands, temp: Path) -> None:
    host = os.environ.get('FTP_SERVER', '')
    username = os.environ.get('FTP_USERNAME', '')
    password = os.environ.get('FTP_PASSWORD', '')
    if not host or username.lower() != 'deploy@ghadirpartner.ir' or not password:
        raise RuntimeError('STOP: invalid production FTPS release identity')
    private = temp / 'private-lftp-script'
    private.write_text('\n'.join([
        'set cmd:fail-exit yes', 'set ftp:ssl-force true',
        'set ftp:ssl-protect-data true', 'set ssl:verify-certificate true',
        'set net:max-retries 2', 'open -p 21 ' + quote(host),
        'user ' + quote(username) + ' ' + quote(password),
        *commands, 'bye',
    ]) + '\n')
    private.chmod(0o600)
    try:
        subprocess.run(['lftp', '-f', str(private)], check=True, timeout=180)
    finally:
        private.unlink(missing_ok=True)


def patch_html(raw: bytes) -> bytes:
    text = raw.decode('utf-8')
    if FAB_NEW not in text and FAB_OLD not in text:
        raise RuntimeError('STOP: search-filter-fab script tag missing')
    if CARTON_OLD not in text and CARTON_NEW not in text:
        raise RuntimeError('STOP: carton multilabel script tag missing')
    fab = FAB.read_bytes()
    carton = CARTON.read_bytes()
    if b'warehouseCartonCodeFromRow' not in fab:
        raise RuntimeError('STOP: fab warehouse row code helper missing')
    if b'gpWarehouseRowCartonCode' not in carton:
        raise RuntimeError('STOP: carton row code export missing')
    text = text.replace(FAB_OLD, FAB_NEW).replace(CARTON_OLD, CARTON_NEW)
    if NOTE.strip() not in text:
        idx = text.find(FAB_NEW)
        if idx < 0:
            idx = text.find(CARTON_NEW)
        if idx < 0:
            raise RuntimeError('STOP: script tags missing after bump')
        line_start = text.rfind('\n', 0, idx) + 1
        text = text[:line_start] + NOTE + text[line_start:]
    return text.encode('utf-8')


def deploy() -> None:
    with tempfile.TemporaryDirectory(prefix='gp-wh-empty-') as name:
        temp = Path(name)
        before = temp / 'app-before'
        ftp([f'get {APP_REMOTE} -o {quote(before)}'], temp)
        original = before.read_bytes()
        updated = patch_html(original)
        after = temp / 'app-after'
        after.write_bytes(updated)
        ftp([
            f'put {quote(FAB)} -o /assets/search-filter-fab-v1.js',
            f'put {quote(CARTON)} -o /assets/warehouse-carton-multilabel-v53438.js',
        ], temp)
        pre = temp / 'pre'
        ftp([f'get {APP_REMOTE} -o {quote(pre)}'], temp)
        if pre.read_bytes() != original:
            raise RuntimeError('STOP: app.html changed during staging')
        try:
            ftp([f'put {quote(after)} -o {APP_REMOTE}'], temp)
        except Exception:
            ftp([f'put {quote(before)} -o {APP_REMOTE}'], temp)
            raise
    print('SUCCESS: warehouse empty list fix live')


if __name__ == '__main__':
    if sys.argv[1:] != ['deploy']:
        raise SystemExit('Usage: deploy-production-warehouse-empty-list-v1.py deploy')
    deploy()
