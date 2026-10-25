#!/usr/bin/env python3
from pathlib import Path
import os
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[1]
MENU2 = REPO / 'assets/ui-v53435-menu2.js'
MENU2_REMOTE = '/assets/ui-v53435-menu2.js'
V3 = REPO / 'assets/menu-live-v3.js'
V3_REMOTE = '/assets/menu-live-v3.js'
V4 = REPO / 'assets/menu-live-v4.js'
V4_REMOTE = '/assets/menu-live-v4.js'
APP_REMOTE = '/app.html'
MARKER = b'GP_MENU_LIVE_V4_20261025'
TAG = b'<!-- ' + MARKER + b' --><script src="/assets/menu-live-v4.js?v=4"></script>\n'
OLD_V3 = b'<!-- GP_MENU_LIVE_V3_20261025 --><script src="/assets/menu-live-v3.js?v=3"></script>\n'
ANCHOR = b'</body></html>'
OLD_MENU2_Q = b'/assets/ui-v53435-menu2.js?v=2'
NEW_MENU2_Q = b'/assets/ui-v53435-menu2.js?v=3'


def quote(value):
    return '"' + str(value).replace('\\', '\\\\').replace('"', '\\"') + '"'


def ftp(commands, temp):
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


def replace_once(raw: bytes, old: bytes, new: bytes, label: str) -> bytes:
    if raw.count(old) != 1:
        raise RuntimeError(f'STOP: {label} not unique ({raw.count(old)})')
    return raw.replace(old, new, 1)


def patch_html(raw: bytes) -> bytes:
    if MARKER in raw and TAG.strip() in raw and NEW_MENU2_Q in raw:
        raise RuntimeError('STOP: menu live v4 already linked')
    if b'menu-live-v4.js' in raw:
        raise RuntimeError('STOP: v4 script already present')
    if b'ui-v53435-menu2.js' not in raw:
        raise RuntimeError('STOP: menu2 builder missing; refuse to patch')
    if b'id="customerAdd"' not in raw or b'id="gpChannelBox"' not in raw:
        raise RuntimeError('STOP: customer add section missing')

    if OLD_MENU2_Q in raw:
        raw = replace_once(raw, OLD_MENU2_Q, NEW_MENU2_Q, 'menu2 cache buster')
    elif NEW_MENU2_Q not in raw:
        raise RuntimeError('STOP: cannot bump menu2 query string')

    if OLD_V3 in raw:
        raw = raw.replace(OLD_V3, OLD_V3 + TAG, 1)
    elif MARKER not in raw:
        if raw.count(ANCHOR) != 1:
            raise RuntimeError('STOP: app.html closing body not unique')
        raw = raw.replace(ANCHOR, TAG + ANCHOR, 1)
    return raw


def deploy():
    menu2 = MENU2.read_bytes()
    v3 = V3.read_bytes()
    v4 = V4.read_bytes()
    for blob, needles in (
        (menu2, (b'gpNavDump', b'gpNavCatalog', 'قیمت و موجودی'.encode())),
        (v3, (b'GP_MENU_LIVE_V3_20261025', b'sales_channel')),
        (v4, (MARKER, b'gpNavDump', b'gpNavCatalog', b'freezeCatalogWrites')),
    ):
        for needle in needles:
            if needle not in blob:
                raise RuntimeError('STOP: asset incomplete: ' + needle.decode('utf-8', 'replace'))
    if b'setInterval(lockCatalogLabel' in v3:
        raise RuntimeError('STOP: v3 still timers the catalog label')

    with tempfile.TemporaryDirectory(prefix='gp-menu-v4-') as name:
        temp = Path(name)
        before = temp / 'app-before'
        ftp([f'get {APP_REMOTE} -o {quote(before)}'], temp)
        original = before.read_bytes()
        updated = patch_html(original)
        after = temp / 'app-after'
        after.write_bytes(updated)

        ftp([f'put {quote(MENU2)} -o {MENU2_REMOTE}'], temp)
        ftp([f'put {quote(V3)} -o {V3_REMOTE}'], temp)
        ftp([f'put {quote(V4)} -o {V4_REMOTE}'], temp)
        for remote, local in (
            (MENU2_REMOTE, MENU2),
            (V3_REMOTE, V3),
            (V4_REMOTE, V4),
        ):
            readback = temp / (Path(remote).name + '-readback')
            ftp([f'get {remote} -o {quote(readback)}'], temp)
            if readback.read_bytes() != local.read_bytes():
                raise RuntimeError('STOP: asset readback mismatch for ' + remote)

        prewrite = temp / 'app-prewrite'
        ftp([f'get {APP_REMOTE} -o {quote(prewrite)}'], temp)
        if prewrite.read_bytes() != original:
            raise RuntimeError('STOP: live app.html changed during staging')
        try:
            ftp([f'put {quote(after)} -o {APP_REMOTE}'], temp)
            html_read = temp / 'app-readback'
            ftp([f'get {APP_REMOTE} -o {quote(html_read)}'], temp)
            if html_read.read_bytes() != updated:
                raise RuntimeError('STOP: production HTML readback mismatch')
        except Exception:
            try:
                ftp([f'put {quote(before)} -o {APP_REMOTE}'], temp)
                print('ROLLBACK: previous app.html restored', file=sys.stderr)
            except Exception:
                print('CRITICAL: automatic rollback failed', file=sys.stderr)
            raise
    print('SUCCESS: menu live v4 removed leftover sidebar items')


if __name__ == '__main__':
    if sys.argv[1:] != ['deploy']:
        raise SystemExit('Usage: deploy-production-menu-live-v4.py deploy')
    deploy()
