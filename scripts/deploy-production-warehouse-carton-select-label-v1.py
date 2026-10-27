#!/usr/bin/env python3
"""Row checkboxes + one top TSC print button; drop bulky selective label card."""
from pathlib import Path
import os
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[1]
MARKER = b'GP_WAREHOUSE_CARTON_SELECT_LABEL_V3_20261027'
JS = REPO / 'assets' / 'warehouse-carton-multilabel-v53438.js'
APP_REMOTE = '/app.html'
SCRIPT_TAG = (
    '<!-- GP_WAREHOUSE_CARTON_SELECT_LABEL_V3_20261027 -->'
    '<script src="/assets/warehouse-carton-multilabel-v53438.js?v=53438whprint5"></script>\n'
)
ANCHOR = '<!-- REMOVE_SELECTIVE_CARTON_LABEL_UI_V1_20261014 -->'


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
    if SCRIPT_TAG.strip() in text and 'warehouse-carton-multilabel-v53438.js?v=53438whprint5' in text:
        return raw
    if ANCHOR not in text:
        raise RuntimeError('STOP: REMOVE_SELECTIVE_CARTON_LABEL anchor missing')
    js = JS.read_bytes()
    if MARKER not in js:
        raise RuntimeError('STOP: carton select label marker missing in JS')
    if b"id='gpWarehouseCartonPrintTools'" in js or b'gpWarehouseCartonPrintTools\' class' in js:
        raise RuntimeError('STOP: bulky print tools bar still present')
    if ANCHOR + '\n' + SCRIPT_TAG.strip() not in text:
        text = text.replace(ANCHOR, ANCHOR + '\n' + SCRIPT_TAG.strip(), 1)
    return text.encode('utf-8')


def deploy() -> None:
    if not JS.is_file():
        raise RuntimeError('STOP: missing warehouse-carton-multilabel asset')
    with tempfile.TemporaryDirectory(prefix='gp-wh-carton-label-') as name:
        temp = Path(name)
        before = temp / 'app-before'
        ftp([f'get {APP_REMOTE} -o {quote(before)}'], temp)
        original = before.read_bytes()
        updated = patch_html(original)
        after = temp / 'app-after'
        after.write_bytes(updated)
        ftp([f'put {quote(JS)} -o /assets/warehouse-carton-multilabel-v53438.js'], temp)
        pre = temp / 'pre'
        ftp([f'get {APP_REMOTE} -o {quote(pre)}'], temp)
        if pre.read_bytes() != original:
            raise RuntimeError('STOP: app.html changed during staging')
        try:
            ftp([f'put {quote(after)} -o {APP_REMOTE}'], temp)
        except Exception:
            ftp([f'put {quote(before)} -o {APP_REMOTE}'], temp)
            raise
    print('SUCCESS: warehouse carton select label v1 live')


if __name__ == '__main__':
    if sys.argv[1:] != ['deploy']:
        raise SystemExit('Usage: deploy-production-warehouse-carton-select-label-v1.py deploy')
    deploy()
