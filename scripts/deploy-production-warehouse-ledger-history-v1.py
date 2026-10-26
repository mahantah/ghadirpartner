#!/usr/bin/env python3
"""Restore full catalog daily grid and per-movement history on warehouseDaily."""
from pathlib import Path
import os
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[1]
MARKER = b'GP_LEDGER_FULL_CATALOG_AND_HISTORY_V1_20261026'
UI = REPO / 'assets' / 'warehouse-ui-refine-v53438.js'
APP_REMOTE = '/app.html'
UI_OLD = '/assets/warehouse-ui-refine-v53438.js?v=53438ui6'
UI_NEW = '/assets/warehouse-ui-refine-v53438.js?v=53438ui7'


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
    if MARKER.decode() in raw.decode('utf-8') and UI_NEW.encode() in raw:
        raise RuntimeError('STOP: ledger history hotfix already applied')
    text = raw.decode('utf-8')
    if UI_OLD not in text:
        if UI_NEW in text and MARKER.decode() in text:
            return raw
        raise RuntimeError('STOP: warehouse-ui-refine ui6 tag missing')
    ui = UI.read_bytes()
    if MARKER not in ui:
        raise RuntimeError('STOP: ledger history marker missing in JS')
    if b'renderDailyMovementSummary()}catch' in ui:
        raise RuntimeError('STOP: movement table still overridden by daily rollup')
    text = text.replace(UI_OLD, UI_NEW, 1)
    note = f'<!-- {MARKER.decode()} -->\n'
    if note.strip() not in text:
        idx = text.find(UI_NEW)
        if idx < 0:
            raise RuntimeError('STOP: script tag not updated')
        line_start = text.rfind('\n', 0, idx) + 1
        text = text[:line_start] + note + text[line_start:]
    return text.encode('utf-8')


def deploy() -> None:
    if not UI.is_file():
        raise RuntimeError('STOP: missing warehouse-ui-refine asset')
    with tempfile.TemporaryDirectory(prefix='gp-wh-ledger-hist-') as name:
        temp = Path(name)
        before = temp / 'app-before'
        ftp([f'get {APP_REMOTE} -o {quote(before)}'], temp)
        original = before.read_bytes()
        updated = patch_html(original)
        after = temp / 'app-after'
        after.write_bytes(updated)
        ftp([f'put {quote(UI)} -o /assets/warehouse-ui-refine-v53438.js'], temp)
        pre = temp / 'pre'
        ftp([f'get {APP_REMOTE} -o {quote(pre)}'], temp)
        if pre.read_bytes() != original:
            raise RuntimeError('STOP: app.html changed during staging')
        try:
            ftp([f'put {quote(after)} -o {APP_REMOTE}'], temp)
        except Exception:
            ftp([f'put {quote(before)} -o {APP_REMOTE}'], temp)
            raise
    print('SUCCESS: warehouse ledger history hotfix live')


if __name__ == '__main__':
    if sys.argv[1:] != ['deploy']:
        raise SystemExit('Usage: deploy-production-warehouse-ledger-history-v1.py deploy')
    deploy()
