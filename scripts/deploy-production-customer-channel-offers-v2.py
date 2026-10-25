#!/usr/bin/env python3
from pathlib import Path
import os
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[1]
ASSET = REPO / 'assets/customer-channel-offers-v2.js'
ASSET_REMOTE = '/assets/customer-channel-offers-v2.js'
REFINE_REMOTE = '/assets/warehouse-ui-refine-v53438.js'
APP_REMOTE = '/app.html'
MARKER = b'GP_CUSTOMER_CHANNEL_OFFERS_V2_20261025'
TAG = b'<!-- ' + MARKER + b' --><script src="/assets/customer-channel-offers-v2.js?v=2"></script>\n'
OLD_V1 = b'<!-- GP_CUSTOMER_CHANNEL_OFFERS_V1_20261025 --><script src="/assets/customer-channel-offers-v1.js?v=1"></script>\n'
ANCHOR = b'</body></html>'
OLD_LABEL = "setGpMenuLabel(b,'لیست قیمت')"
NEW_LABEL = "setGpMenuLabel(b,'قیمت و موجودی')"


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
        raise RuntimeError('STOP: customer channel v2 already linked')
    if b'customer-channel-offers-v2.js' in raw:
        raise RuntimeError('STOP: v2 script already present')
    if b'nav-restructure-v1.js' not in raw:
        raise RuntimeError('STOP: nav restructure overlay missing; refuse to patch')
    if OLD_V1 in raw:
        return raw.replace(OLD_V1, TAG, 1)
    if raw.count(ANCHOR) != 1:
        raise RuntimeError('STOP: app.html closing body not unique')
    return raw.replace(ANCHOR, TAG + ANCHOR, 1)


def patch_refine(raw: bytes) -> bytes:
    old = OLD_LABEL.encode()
    new = NEW_LABEL.encode()
    if new in raw and old not in raw:
        return raw
    if old not in raw:
        raise RuntimeError('STOP: expected refine price-list label missing')
    if raw.count(old) != 1:
        raise RuntimeError('STOP: refine price-list label not unique')
    return raw.replace(old, new, 1)


def deploy():
    blob = ASSET.read_bytes()
    for needle in (
        MARKER,
        'sales_channel'.encode(),
        'gpRepParent'.encode(),
        'interceptNavClick'.encode(),
        'قیمت و موجودی'.encode(),
        'عاملین فروش'.encode(),
        'زیرمجموعه بازاریاب'.encode(),
    ):
        if needle not in blob:
            raise RuntimeError('STOP: overlay asset incomplete')
    with tempfile.TemporaryDirectory(prefix='gp-channel-v2-') as name:
        temp = Path(name)
        before = temp / 'app-before'
        ftp([f'get {APP_REMOTE} -o {quote(before)}'], temp)
        original = before.read_bytes()
        updated = patch_html(original)
        after = temp / 'app-after'
        after.write_bytes(updated)

        refine_before = temp / 'refine-before'
        ftp([f'get {REFINE_REMOTE} -o {quote(refine_before)}'], temp)
        refine_updated = patch_refine(refine_before.read_bytes())
        refine_after = temp / 'refine-after'
        refine_after.write_bytes(refine_updated)

        ftp([f'put {quote(ASSET)} -o {ASSET_REMOTE}'], temp)
        verified = temp / 'asset-readback'
        ftp([f'get {ASSET_REMOTE} -o {quote(verified)}'], temp)
        if verified.read_bytes() != ASSET.read_bytes():
            raise RuntimeError('STOP: overlay readback mismatch')

        ftp([f'put {quote(refine_after)} -o {REFINE_REMOTE}'], temp)
        refine_read = temp / 'refine-readback'
        ftp([f'get {REFINE_REMOTE} -o {quote(refine_read)}'], temp)
        if refine_read.read_bytes() != refine_updated:
            raise RuntimeError('STOP: refine readback mismatch')

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
    print('SUCCESS: customer channel v2 and price-menu label are live')


if __name__ == '__main__':
    if sys.argv[1:] != ['deploy']:
        raise SystemExit('Usage: deploy-production-customer-channel-offers-v2.py deploy')
    deploy()
