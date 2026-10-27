#!/usr/bin/env python3
"""Hotfix: keep warehouse table card when removing selective label UI."""
from pathlib import Path
import os
import re
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[1]
MARKER = b'GP_WAREHOUSE_CARTON_SELECT_LABEL_V4_20261027'
JS = REPO / 'assets' / 'warehouse-carton-multilabel-v53438.js'
APP_REMOTE = '/app.html'
OLD_Q = '/assets/warehouse-carton-multilabel-v53438.js?v=53438whprint5'
NEW_Q = '/assets/warehouse-carton-multilabel-v53438.js?v=53438whprint6'
NOTE = '<!-- GP_WAREHOUSE_CARTON_SELECT_LABEL_V4_20261027 -->\n'


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
    if NEW_Q in text and NOTE.strip() in text:
        return raw
    js = JS.read_bytes()
    if MARKER not in js:
        raise RuntimeError('STOP: v4 carton label marker missing')
    if b'#warehouseBody, #whCartonSearch' not in js:
        raise RuntimeError('STOP: table card guard missing')
    if OLD_Q not in text and NEW_Q not in text:
        raise RuntimeError('STOP: carton multilabel script tag missing')
    text = text.replace(OLD_Q, NEW_Q)
    if NOTE.strip() not in text:
        text = re.sub(
            r'(<!-- GP_WAREHOUSE_CARTON_SELECT_LABEL_V3_20261027 -->)',
            NOTE.strip() + r'\n<!-- GP_WAREHOUSE_CARTON_SELECT_LABEL_V3_20261027 -->',
            text,
            count=1,
        )
        if NOTE.strip() not in text:
            idx = text.find(NEW_Q)
            if idx < 0:
                raise RuntimeError('STOP: script tag missing after bump')
            line_start = text.rfind('\n', 0, idx) + 1
            text = text[:line_start] + NOTE + text[line_start:]
    return text.encode('utf-8')


def deploy() -> None:
    with tempfile.TemporaryDirectory(prefix='gp-wh-carton-v2-') as name:
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
    print('SUCCESS: warehouse carton select label v2 hotfix live')


if __name__ == '__main__':
    if sys.argv[1:] != ['deploy']:
        raise SystemExit('Usage: deploy-production-warehouse-carton-select-label-v2.py deploy')
    deploy()
