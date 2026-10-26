#!/usr/bin/env python3
"""Hotfix: stop account-logout MutationObserver infinite loop (page freeze)."""
from pathlib import Path
import os
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[1]
MARKER = b'GP_ACCOUNT_LOGOUT_PERF_HOTFIX_V1_20261026'
JS = REPO / 'assets/account-logout-access-v1.js'
APP_REMOTE = '/app.html'
OLD = '/assets/account-logout-access-v1.js?v=1'
NEW = '/assets/account-logout-access-v1.js?v=2'


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
        raise RuntimeError('STOP: hotfix already applied')
    text = raw.decode('utf-8')
    if OLD not in text:
        raise RuntimeError('STOP: account logout script tag missing')
    if b'syncQueued' not in JS.read_bytes():
        raise RuntimeError('STOP: perf guard missing in JS')
    text = text.replace(OLD, NEW, 1)
    note = f'<!-- {MARKER.decode()} -->\n'
    if note.strip() not in text:
        idx = text.find(NEW)
        if idx < 0:
            raise RuntimeError('STOP: script tag not updated')
        line_start = text.rfind('\n', 0, idx) + 1
        text = text[:line_start] + note + text[line_start:]
    return text.encode('utf-8')


def deploy() -> None:
    with tempfile.TemporaryDirectory(prefix='gp-logout-perf-') as name:
        temp = Path(name)
        before = temp / 'app-before'
        ftp([f'get {APP_REMOTE} -o {quote(before)}'], temp)
        original = before.read_bytes()
        updated = patch_html(original)
        after = temp / 'app-after'
        after.write_bytes(updated)
        ftp([f'put {quote(JS)} -o /assets/account-logout-access-v1.js'], temp)
        pre = temp / 'pre'
        ftp([f'get {APP_REMOTE} -o {quote(pre)}'], temp)
        if pre.read_bytes() != original:
            raise RuntimeError('STOP: app.html changed during staging')
        try:
            ftp([f'put {quote(after)} -o {APP_REMOTE}'], temp)
        except Exception:
            ftp([f'put {quote(before)} -o {APP_REMOTE}'], temp)
            raise
    print('SUCCESS: account logout perf hotfix live')


if __name__ == '__main__':
    if sys.argv[1:] != ['deploy']:
        raise SystemExit('Usage: deploy-production-account-logout-perf-hotfix-v1.py deploy')
    deploy()
