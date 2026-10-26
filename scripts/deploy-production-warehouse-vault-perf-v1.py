#!/usr/bin/env python3
"""Perf: faster serial warehouse tab (cache + single render + fast hydrate)."""
from pathlib import Path
import os
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[1]
MARKER = b'GP_WAREHOUSE_VAULT_PERF_V1_20261026'
UI = REPO / 'assets/warehouse-ui-refine-v53438.js'
PERF = REPO / 'assets/warehouse-vault-perf-v1.js'
APP_REMOTE = '/app.html'
UI_OLD = '/assets/warehouse-ui-refine-v53438.js?v=53438ui5'
UI_NEW = '/assets/warehouse-ui-refine-v53438.js?v=53438ui6'
PERF_TAG = (
    b'<!-- GP_WAREHOUSE_VAULT_PERF_V1_20261026 -->'
    b'<script src="/assets/warehouse-vault-perf-v1.js?v=1"></script>\n'
)


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
    if MARKER in raw:
        raise RuntimeError('STOP: warehouse vault perf already applied')
    text = raw.decode('utf-8')
    if UI_OLD not in text:
        raise RuntimeError('STOP: warehouse-ui-refine ui5 tag missing')
    if b'gpClearWarehouseVaultCache' not in PERF.read_bytes():
        raise RuntimeError('STOP: vault perf asset incomplete')
    if b'byCartonId' not in UI.read_bytes():
        raise RuntimeError('STOP: fast hydrate missing in ui refine')
    text = text.replace(UI_OLD, UI_NEW, 1)
    anchor = UI_NEW
    idx = text.find(anchor)
    if idx < 0:
        raise RuntimeError('STOP: ui refine tag missing after patch')
    line_end = text.find('\n', idx)
    if line_end < 0:
        raise RuntimeError('STOP: ui refine line end missing')
    insert_at = line_end + 1
    if PERF_TAG.decode() not in text:
        text = text[:insert_at] + PERF_TAG.decode() + text[insert_at:]
    return text.encode('utf-8')


def deploy() -> None:
    for path in (UI, PERF):
        if not path.is_file():
            raise RuntimeError('STOP: missing ' + str(path))
    with tempfile.TemporaryDirectory(prefix='gp-wh-vault-perf-') as name:
        temp = Path(name)
        before = temp / 'app-before'
        ftp([f'get {APP_REMOTE} -o {quote(before)}'], temp)
        original = before.read_bytes()
        updated = patch_html(original)
        after = temp / 'app-after'
        after.write_bytes(updated)
        ftp([
            f'put {quote(UI)} -o /assets/warehouse-ui-refine-v53438.js',
            f'put {quote(PERF)} -o /assets/warehouse-vault-perf-v1.js',
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
    print('SUCCESS: warehouse vault perf live')


if __name__ == '__main__':
    if sys.argv[1:] != ['deploy']:
        raise SystemExit('Usage: deploy-production-warehouse-vault-perf-v1.py deploy')
    deploy()
