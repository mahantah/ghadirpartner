#!/usr/bin/env python3
"""Hotfix: smart-list observer + search-filter FAB observer (page freeze on boot)."""
from pathlib import Path
import os
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / 'scripts'))
from patch_smart_list_perf_v1 import MARKER, patch_smart_list_html  # noqa: E402

FAB_JS = REPO / 'assets/search-filter-fab-v1.js'
STAB_JS = REPO / 'assets/customer-ops-stabilize-v1.js'
APP_REMOTE = '/app.html'
FAB_OLD = '/assets/search-filter-fab-v1.js?v=1'
FAB_NEW = '/assets/search-filter-fab-v1.js?v=2'
STAB_OLD = '/assets/customer-ops-stabilize-v1.js?v=2'
STAB_NEW = '/assets/customer-ops-stabilize-v1.js?v=3'
HTML_MARKER = b'GP_APP_PERF_HOTFIX_V2_20261026'


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
    if HTML_MARKER in raw:
        raise RuntimeError('STOP: app perf hotfix v2 already applied')
    text = raw.decode('utf-8')
    if FAB_OLD not in text:
        raise RuntimeError('STOP: search-filter-fab v1 script tag missing')
    if STAB_OLD not in text:
        raise RuntimeError('STOP: customer-ops-stabilize v2 script tag missing')
    fab = FAB_JS.read_bytes()
    stab = STAB_JS.read_bytes()
    if b'window.__gpBusy' not in fab or b'childList: true, subtree: true' not in fab:
        raise RuntimeError('STOP: search-filter-fab perf guard missing locally')
    if b'hardenBoot' not in stab or b'__gpStabBoot' not in stab:
        raise RuntimeError('STOP: boot busy guard missing in stabilize JS')
    text = patch_smart_list_html(text)  # smart-list + boot __gpBusy guard
    text = text.replace(FAB_OLD, FAB_NEW, 1)
    text = text.replace(STAB_OLD, STAB_NEW, 1)
    note = f'<!-- {HTML_MARKER.decode()} -->\n'
    if note.strip() not in text:
        idx = text.find(FAB_NEW)
        if idx < 0:
            raise RuntimeError('STOP: fab script tag not updated')
        line_start = text.rfind('\n', 0, idx) + 1
        text = text[:line_start] + note + text[line_start:]
    return text.encode('utf-8')


def deploy() -> None:
    for path in (FAB_JS, STAB_JS):
        if not path.is_file():
            raise RuntimeError('STOP: missing ' + str(path))
    with tempfile.TemporaryDirectory(prefix='gp-app-perf-v2-') as name:
        temp = Path(name)
        before = temp / 'app-before'
        ftp([f'get {APP_REMOTE} -o {quote(before)}'], temp)
        original = before.read_bytes()
        updated = patch_html(original)
        after = temp / 'app-after'
        after.write_bytes(updated)
        ftp([
            f'put {quote(FAB_JS)} -o /assets/search-filter-fab-v1.js',
            f'put {quote(STAB_JS)} -o /assets/customer-ops-stabilize-v1.js',
        ], temp)
        pre = temp / 'pre'
        ftp([f'get {APP_REMOTE} -o {quote(pre)}'], temp)
        if pre.read_bytes() != original:
            raise RuntimeError('STOP: app.html changed during staging')
        try:
            ftp([f'put {quote(after)} -o {APP_REMOTE}'], temp)
            rb = temp / 'readback'
            ftp([f'get {APP_REMOTE} -o {quote(rb)}'], temp)
            if rb.read_bytes() != updated:
                raise RuntimeError('STOP: app.html readback mismatch')
        except Exception:
            try:
                ftp([f'put {quote(before)} -o {APP_REMOTE}'], temp)
                print('ROLLBACK: app.html restored', file=sys.stderr)
            except Exception:
                print('CRITICAL: rollback failed', file=sys.stderr)
            raise
    print('SUCCESS: app perf hotfix v2 live')


if __name__ == '__main__':
    if sys.argv[1:] != ['deploy']:
        raise SystemExit('Usage: deploy-production-app-perf-hotfix-v2.py deploy')
    deploy()
