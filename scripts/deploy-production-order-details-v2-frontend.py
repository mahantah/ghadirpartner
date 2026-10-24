#!/usr/bin/env python3
"""One-shot fail-closed FTPS release of order-details visuals only.

Never calls application APIs, reads user records or alters backend/database state.
Publishes unique immutable assets and inserts three references into the
independently verified live app.html, retaining its serial hydration logic.
"""
from pathlib import Path
import hashlib
import os
import subprocess
import sys
import tempfile


REPO = Path(__file__).resolve().parents[1]
BASELINE_SHA256 = '621f848567271864287e84146cbe587d4a39acb341e96b7ad7f7252a760d4700'
APP_REMOTE = '/app.html'
CSS_REMOTE = '/assets/order-details-v2-approved-20261024.css'
JS_REMOTE = '/assets/order-details-v2-approved-20261024.js'
BRIDGE_REMOTE = '/assets/production-order-details-bridge-v1.js'
ASSETS = (
    (REPO / 'assets/order-details-v2.css', CSS_REMOTE),
    (REPO / 'assets/order-details-v2.js', JS_REMOTE),
    (REPO / 'assets/production-order-details-bridge-v1.js', BRIDGE_REMOTE),
)
CSS_LINK = b'<link rel="stylesheet" href="/assets/order-details-v2-approved-20261024.css?v=1">\n'
BODY_ANCHOR = b'<script src="/assets/production-sidebar-placement-v2.js?v=2" defer></script>\n</body></html>'
BODY_INSERT = b'''<script src="/assets/production-sidebar-placement-v2.js?v=2" defer></script>
<!-- GP_ORDER_DETAILS_LIVE_APPROVED_20261024 -->
<script>window.__gpOdLegacy={open:window.openOrderDetails,close:window.closeOrderDetails};</script>
<script src="/assets/order-details-v2-approved-20261024.js?v=1" defer></script>
<script src="/assets/production-order-details-bridge-v1.js?v=1" defer></script>
</body></html>'''


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def expected_html(before, strict_baseline=True):
    if strict_baseline and sha256(before) != BASELINE_SHA256:
        raise RuntimeError('STOP: live app.html differs from verified public baseline')
    required = (
        b'async function openOrderDetails(id){await ensureOrderSerialMeta(id);',
        b'function orderItemSerials(o,it)',
        b'function closeOrderDetails()',
        b'/assets/production-sidebar-placement-v2.css?v=3',
        b'</head><body>',
        BODY_ANCHOR,
    )
    if any(before.count(marker) != 1 for marker in required):
        raise RuntimeError('STOP: missing or duplicated live compatibility anchor')
    if b'GP_ORDER_DETAILS_LIVE_APPROVED_20261024' in before:
        raise RuntimeError('STOP: release marker already exists')
    return before.replace(b'</head><body>', CSS_LINK + b'</head><body>', 1).replace(
        BODY_ANCHOR, BODY_INSERT, 1)


def validate_assets():
    source = ASSETS[1][0].read_bytes()
    bridge = ASSETS[2][0].read_bytes()
    css = ASSETS[0][0].read_bytes()
    if (source.count(b'GP_ORDER_DETAILS_V2_20261020') != 1 or
            b'function gpOdQuickHtml(o,c)' not in source or
            b'function gpOdPaymentHtml(o)' not in source or
            b'orderItemSerials(o,it)' not in source or
            b'if(!has(\'finance\'))' not in source or
            b'GP_ORDER_DETAILS_PRODUCTION_BRIDGE_V1_20261024' not in bridge or
            b'await window.ensureOrderSerialMeta(id)' not in bridge or
            b'GP_ORDER_DETAILS_V2_20261020' not in css):
        raise RuntimeError('STOP: expected approved UX assets not present')


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


def deploy():
    validate_assets()
    with tempfile.TemporaryDirectory(prefix='gp-orders-ui-only-') as name:
        temp = Path(name)
        old = temp / 'app-before'
        ftp([f'get {APP_REMOTE} -o {quote(old)}'], temp)
        original = old.read_bytes()
        updated = expected_html(original)
        after = temp / 'app-after'
        after.write_bytes(updated)

        # Static assets go live first, but cannot change any page until HTML is updated.
        ftp([f'put {quote(path)} -o {remote}' for path, remote in ASSETS], temp)
        verified = [temp / ('asset-verified-' + str(i)) for i in range(len(ASSETS))]
        ftp([f'get {remote} -o {quote(local)}'
             for (_, remote), local in zip(ASSETS, verified)], temp)
        if any(local.read_bytes() != source.read_bytes()
               for (source, _), local in zip(ASSETS, verified)):
            raise RuntimeError('STOP: staged frontend asset readback mismatch')

        # Revalidate the complete current live HTML before any overwrite.
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
            print('ERROR: checking whether the original HTML can be safely restored', file=sys.stderr)
            current = temp / 'app-rollback-read'
            try:
                ftp([f'get {APP_REMOTE} -o {quote(current)}'], temp)
                if current.read_bytes() != updated:
                    raise RuntimeError('STOP: HTML changed unexpectedly; manual recovery required')
                ftp([f'put {quote(old)} -o {APP_REMOTE}'], temp)
                check = temp / 'app-rollback-check'
                ftp([f'get {APP_REMOTE} -o {quote(check)}'], temp)
                if check.read_bytes() != original:
                    raise RuntimeError('STOP: HTML rollback readback mismatch')
                print('ROLLBACK: original app.html restored', file=sys.stderr)
            except Exception:
                print('CRITICAL: unable to verify automatic rollback', file=sys.stderr)
            raise
    print('SUCCESS: frontend-only order-details UX released')
    print('UNCHANGED: original serial hydration, backend, auth, orders, database and inventory')


if __name__ == '__main__':
    if sys.argv[1:] != ['deploy']:
        raise SystemExit('Usage: deploy-production-order-details-v2-frontend.py deploy')
    deploy()
