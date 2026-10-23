#!/usr/bin/env python3
"""Publish only two new presentation assets plus two links in production app.html.

No application code, databases, session handlers, or warehouse state are edited.
The prewrite HTML is byte-compared to the backup and post-write is verified.
"""
import hashlib
import os
from pathlib import Path
import subprocess
import sys


ROOT = Path('/tmp/ghadir-sidebar-placement-v2')
FILES = {
    'production-sidebar-placement-v2.css': Path('assets/production-sidebar-placement-v2.css'),
    'production-sidebar-placement-v2.js': Path('assets/production-sidebar-placement-v2.js'),
}
OLD_CSS = '/assets/production-sidebar-controls-v1.css?v=1'
OLD_JS = '/assets/production-sidebar-controls-v1.js?v=1'
CSS = '/assets/production-sidebar-placement-v2.css?v=2'
JS = '/assets/production-sidebar-placement-v2.js?v=2'
STYLE = '<link rel="stylesheet" href="' + CSS + '">\n'
SCRIPT = '<script src="' + JS + '" defer></script>\n'


def prepare_html(original: bytes) -> bytes:
    """Fail closed unless only the existing presentation-only release is present."""
    content = original.decode('utf-8')
    for marker in (
        'id="app"', 'id="changePasswordBtn"', 'id="logoutbtn"',
        "desktopCollapse.id='desktopSidebarCollapse'",
        OLD_CSS, OLD_JS, '</head>', '</body>',
    ):
        if content.count(marker) != 1:
            raise ValueError('STOP: incompatible or duplicated live HTML marker: ' + marker)
    if CSS in content or JS in content:
        raise ValueError('STOP: sidebar placement V2 already installed')
    changed = content.replace('</head>', STYLE + '</head>', 1)
    changed = changed.replace('</body>', SCRIPT + '</body>', 1)
    if changed.replace(STYLE, '', 1).replace(SCRIPT, '', 1) != content:
        raise AssertionError('STOP: application code changed outside two asset references')
    return changed.encode('utf-8')


def q(value):
    return '"' + str(value).replace('\\', '\\\\').replace('"', '\\"') + '"'


def ftp(commands):
    server = os.environ.get('FTP_SERVER', '')
    username = os.environ.get('FTP_USERNAME', '')
    password = os.environ.get('FTP_PASSWORD', '')
    if not server or username.lower() != 'deploy@ghadirpartner.ir' or not password:
        raise RuntimeError('STOP: FTPS production deploy identity invalid')
    script = ROOT / 'ftps-commands-private.txt'
    script.write_text('\n'.join([
        'set cmd:fail-exit yes', 'set ftp:ssl-force true',
        'set ftp:ssl-protect-data true', 'set ssl:verify-certificate true',
        'set net:max-retries 2', 'open -p 21 ' + q(server),
        'user ' + q(username) + ' ' + q(password), *commands, 'bye',
    ]) + '\n')
    script.chmod(0o600)
    try:
        subprocess.run(['lftp', '-f', str(script)], check=True, timeout=150)
    finally:
        script.unlink(missing_ok=True)


def inspect():
    ROOT.mkdir(parents=True, exist_ok=True)
    for path in FILES.values():
        if not path.is_file() or path.stat().st_size < 200:
            raise RuntimeError('STOP: missing sidebar-only asset: ' + str(path))
    ftp(['get /app.html -o ' + q(ROOT / 'original-app.html')])
    data = (ROOT / 'original-app.html').read_bytes()
    updated = prepare_html(data)
    (ROOT / 'updated-app.html').write_bytes(updated)
    (ROOT / 'original-sha256').write_text(hashlib.sha256(data).hexdigest())
    print('VERIFIED: live HTML contains the approved sidebar V1 release')
    print('PREPARED: only two additional presentation asset references')


def publish():
    old = (ROOT / 'original-app.html').read_bytes()
    intended = (ROOT / 'updated-app.html').read_bytes()
    if prepare_html(old) != intended:
        raise RuntimeError('STOP: prepared bytes are inconsistent')
    ftp(['get /app.html -o ' + q(ROOT / 'prewrite-app.html')])
    if (ROOT / 'prewrite-app.html').read_bytes() != old:
        raise RuntimeError('STOP: production app.html drift before write')
    try:
        transfers = [
            'put ' + q(path.resolve()) + ' -o /assets/' + name
            for name, path in FILES.items()
        ]
        transfers.append('put ' + q(ROOT / 'updated-app.html') + ' -o /app.html')
        ftp(transfers)
        checks = ['get /app.html -o ' + q(ROOT / 'verify-app.html')]
        checks += [
            'get /assets/' + name + ' -o ' + q(ROOT / ('verify-' + name))
            for name in FILES
        ]
        ftp(checks)
        if (ROOT / 'verify-app.html').read_bytes() != intended:
            raise RuntimeError('STOP: live app.html byte mismatch')
        for name, path in FILES.items():
            if (ROOT / ('verify-' + name)).read_bytes() != path.read_bytes():
                raise RuntimeError('STOP: FTPS asset mismatch: ' + name)
    except Exception:
        print('ERROR: restoring original app.html', file=sys.stderr)
        try:
            ftp(['put ' + q(ROOT / 'original-app.html') + ' -o /app.html'])
            print('ROLLBACK: original app.html restored', file=sys.stderr)
        except Exception:
            print('CRITICAL: automatic HTML rollback failed', file=sys.stderr)
        raise
    print('SUCCESS: sidebar position V2 published, read-back exact')
    print('UNCHANGED: production inventory, cartons, orders, auth and backend code')


if __name__ == '__main__':
    if sys.argv[1:] == ['inspect']:
        inspect()
    elif sys.argv[1:] == ['publish']:
        publish()
    else:
        raise SystemExit('Usage: deploy-production-sidebar-placement-v2.py inspect|publish')
