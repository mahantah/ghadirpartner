#!/usr/bin/env python3
"""Hotfix: bootstrap refresh perf + lazy-inventory exchange serial picker."""
from pathlib import Path
import os
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[1]
MARKER = b'GP_PERF_EXCHANGE_HOTFIX_V1_20261026'
STAB = REPO / 'assets/customer-ops-stabilize-v1.js'
EX_V2 = REPO / 'assets/order-return-exchange-v2.js'
CSS = REPO / 'assets/order-return-exchange-v1.css'
APP_REMOTE = '/app.html'


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
    if 'order-return-exchange-v1.js' not in text:
        raise RuntimeError('STOP: exchange v1 script tag missing')
    if 'customer-ops-stabilize-v1.js' not in text:
        raise RuntimeError('STOP: customer ops stabilize missing')
    if b'refreshUsesBootstrap' not in STAB.read_bytes():
        raise RuntimeError('STOP: stabilize bootstrap guard missing locally')
    if b'GP_ORDER_RETURN_EXCHANGE_V2_20261026' not in EX_V2.read_bytes():
        raise RuntimeError('STOP: exchange v2 marker missing')
    text = text.replace(
        '/assets/order-return-exchange-v1.js?v=1',
        '/assets/order-return-exchange-v2.js?v=1',
        1,
    )
    text = text.replace(
        '/assets/customer-ops-stabilize-v1.js?v=1',
        '/assets/customer-ops-stabilize-v1.js?v=2',
        1,
    )
    note = '<!-- GP_PERF_EXCHANGE_HOTFIX_V1_20261026 -->\n'
    if note.strip() not in text:
        anchor = 'order-return-exchange-v2.js?v=1'
        idx = text.find(anchor)
        if idx < 0:
            raise RuntimeError('STOP: v2 script tag not patched')
        line_start = text.rfind('\n', 0, idx) + 1
        text = text[:line_start] + note + text[line_start:]
    return text.encode('utf-8')


def deploy() -> None:
    for path in (STAB, EX_V2, CSS):
        if not path.is_file():
            raise RuntimeError('STOP: missing ' + str(path))
    with tempfile.TemporaryDirectory(prefix='gp-perf-exchange-hotfix-') as name:
        temp = Path(name)
        before = temp / 'app-before'
        ftp([f'get {APP_REMOTE} -o {quote(before)}'], temp)
        original = before.read_bytes()
        updated = patch_html(original)
        after = temp / 'app-after'
        after.write_bytes(updated)
        ftp([
            f'put {quote(STAB)} -o /assets/customer-ops-stabilize-v1.js',
            f'put {quote(EX_V2)} -o /assets/order-return-exchange-v2.js',
            f'put {quote(CSS)} -o /assets/order-return-exchange-v1.css',
        ], temp)
        pre = temp / 'app-prewrite'
        ftp([f'get {APP_REMOTE} -o {quote(pre)}'], temp)
        if pre.read_bytes() != original:
            raise RuntimeError('STOP: app.html changed during staging')
        try:
            ftp([f'put {quote(after)} -o {APP_REMOTE}'], temp)
            rb = temp / 'app-rb'
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
    print('SUCCESS: perf + exchange hotfix live')


if __name__ == '__main__':
    if sys.argv[1:] != ['deploy']:
        raise SystemExit('Usage: deploy-production-perf-exchange-hotfix-v1.py deploy')
    deploy()
