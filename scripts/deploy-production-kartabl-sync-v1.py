#!/usr/bin/env python3
from pathlib import Path
import os
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[1]
ASSET = REPO / 'assets/kartabl-sync-v1.js'
ASSET_REMOTE = '/assets/kartabl-sync-v1.js'
APP_REMOTE = '/app.html'
MARKER = b'GP_KARTABL_SYNC_V1_20261025'
TAG = b'<!-- ' + MARKER + b' --><script src="/assets/kartabl-sync-v1.js?v=1"></script>\n'
ANCHOR = b'</body></html>'


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


def patch_html(raw: bytes) -> bytes:
    if MARKER in raw and TAG.strip() in raw:
        raise RuntimeError('STOP: kartabl sync v1 already linked')
    if b'kartabl-sync-v1.js' in raw:
        raise RuntimeError('STOP: kartabl sync script already present')
    if b'customer-form-polish-v1.js' not in raw:
        raise RuntimeError('STOP: customer form polish missing; refuse to patch')
    if b'id="ctbody"' not in raw:
        raise RuntimeError('STOP: customer table body missing')
    if raw.count(ANCHOR) != 1:
        raise RuntimeError('STOP: app.html closing body not unique')
    return raw.replace(ANCHOR, TAG + ANCHOR, 1)


def deploy():
    blob = ASSET.read_bytes()
    for needle in (
        MARKER,
        b'syncGlobals',
        b'renderKartabl',
        b'gpOpenPlanApply',
        b'gpResetCustomerPassword',
        b'gpChangeCoop',
        'کاربران اتوماسیون'.encode(),
        'اعمال طرح جدید'.encode(),
    ):
        if needle not in blob:
            raise RuntimeError('STOP: overlay asset incomplete: ' + needle.decode('utf-8', 'replace'))
    with tempfile.TemporaryDirectory(prefix='gp-kartabl-sync-v1-') as name:
        temp = Path(name)
        before = temp / 'app-before'
        ftp([f'get {APP_REMOTE} -o {quote(before)}'], temp)
        original = before.read_bytes()
        updated = patch_html(original)
        after = temp / 'app-after'
        after.write_bytes(updated)
        ftp([f'put {quote(ASSET)} -o {ASSET_REMOTE}'], temp)
        verified = temp / 'asset-readback'
        ftp([f'get {ASSET_REMOTE} -o {quote(verified)}'], temp)
        if verified.read_bytes() != ASSET.read_bytes():
            raise RuntimeError('STOP: asset readback mismatch')
        prewrite = temp / 'app-prewrite'
        ftp([f'get {APP_REMOTE} -o {quote(prewrite)}'], temp)
        if prewrite.read_bytes() != original:
            raise RuntimeError('STOP: live app.html changed during staging')
        try:
            ftp([f'put {quote(after)} -o {APP_REMOTE}'], temp)
            readback = temp / 'app-readback'
            ftp([f'get {APP_REMOTE} -o {quote(readback)}'], temp)
            if readback.read_bytes() != updated:
                raise RuntimeError('STOP: production HTML readback mismatch')
        except Exception:
            try:
                ftp([f'put {quote(before)} -o {APP_REMOTE}'], temp)
                print('ROLLBACK: previous app.html restored', file=sys.stderr)
            except Exception:
                print('CRITICAL: automatic rollback failed', file=sys.stderr)
            raise
    print('SUCCESS: kartabl sync v1 is live')


if __name__ == '__main__':
    if sys.argv[1:] != ['deploy']:
        raise SystemExit('Usage: deploy-production-kartabl-sync-v1.py deploy')
    deploy()
