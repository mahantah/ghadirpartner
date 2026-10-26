#!/usr/bin/env python3
from pathlib import Path
import os
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[1]
ASSET = REPO / 'assets/toggle-switch-cl-v2.js'
ASSET_REMOTE = '/assets/toggle-switch-cl-v2.js'
APP_REMOTE = '/app.html'
MARKER = b'GP_TOGGLE_SWITCH_CL_V2_20261026'
TAG = b'<!-- ' + MARKER + b' --><script src="/assets/toggle-switch-cl-v2.js?v=1"></script>\n'
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
        raise RuntimeError('STOP: cl toggle switch v2 already linked')
    if b'toggle-switch-cl-v2.js' in raw:
        raise RuntimeError('STOP: cl toggle switch script already present')
    if b'toggle-switch-polish-v1.js' not in raw:
        raise RuntimeError('STOP: toggle switch polish v1 missing; refuse to patch')
    if raw.count(ANCHOR) != 1:
        raise RuntimeError('STOP: app.html closing body not unique')
    return raw.replace(ANCHOR, TAG + ANCHOR, 1)


def deploy():
    blob = ASSET.read_bytes()
    for needle in (
        MARKER,
        b'cl-switch',
        b'cl-toggle-switch',
        b'migrate',
        b'#018786',
        b'toggle-border',
        b'customCheckBox',
        b'height:32px',
    ):
        if needle not in blob:
            raise RuntimeError('STOP: overlay asset incomplete: ' + needle.decode('utf-8', 'replace'))
    with tempfile.TemporaryDirectory(prefix='gp-toggle-switch-cl-v2-') as name:
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
    print('SUCCESS: cl toggle switch v2 is live')


if __name__ == '__main__':
    if sys.argv[1:] != ['deploy']:
        raise SystemExit('Usage: deploy-production-toggle-switch-cl-v2.py deploy')
    deploy()
