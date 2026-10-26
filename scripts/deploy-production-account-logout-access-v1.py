#!/usr/bin/env python3
"""Deploy account logout dock fix (visible when desktop sidebar collapsed)."""
from pathlib import Path
import os
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[1]
MARKER = b'GP_ACCOUNT_LOGOUT_ACCESS_V1_20261026'
JS = REPO / 'assets/account-logout-access-v1.js'
CSS = REPO / 'assets/account-logout-access-v1.css'
APP_REMOTE = '/app.html'
CSS_URL = '/assets/account-logout-access-v1.css?v=1'
JS_URL = '/assets/account-logout-access-v1.js?v=1'


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
        raise RuntimeError('STOP: account logout access already applied')
    text = raw.decode('utf-8')
    if 'production-sidebar-controls-v1.js' not in text:
        raise RuntimeError('STOP: production sidebar controls missing on app.html')
    if 'id="logoutbtn"' not in text:
        raise RuntimeError('STOP: logout button missing')
    insert = (
        f'<!-- {MARKER.decode()} -->\n'
        f'<link rel="stylesheet" href="{CSS_URL}">\n'
        f'<script src="{JS_URL}" defer></script>\n'
    )
    if '</body></html>' in text:
        text = text.replace('</body></html>', insert + '</body></html>', 1)
    elif '</body>' in text:
        text = text.replace('</body>', insert + '</body>', 1)
    else:
        raise RuntimeError('STOP: no </body> in app.html')
    if MARKER.decode() not in text or CSS_URL not in text or JS_URL not in text:
        raise RuntimeError('STOP: patch verification failed')
    return text.encode('utf-8')


def deploy() -> None:
    for path in (JS, CSS):
        if not path.is_file():
            raise RuntimeError('STOP: missing ' + str(path))
    with tempfile.TemporaryDirectory(prefix='gp-account-logout-') as name:
        temp = Path(name)
        before = temp / 'app-before'
        ftp([f'get {APP_REMOTE} -o {quote(before)}'], temp)
        original = before.read_bytes()
        updated = patch_html(original)
        after = temp / 'app-after'
        after.write_bytes(updated)
        ftp([
            f'put {quote(JS)} -o /assets/account-logout-access-v1.js',
            f'put {quote(CSS)} -o /assets/account-logout-access-v1.css',
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
    print('SUCCESS: account logout access fix live')


if __name__ == '__main__':
    if sys.argv[1:] != ['deploy']:
        raise SystemExit('Usage: deploy-production-account-logout-access-v1.py deploy')
    deploy()
