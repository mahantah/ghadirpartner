#!/usr/bin/env python3
"""FTPS release: return replacement API + order exchange UI overlay."""
from pathlib import Path
import hashlib
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / 'scripts'))
from patch_production_order_return_exchange import (  # noqa: E402
    MARKER,
    patch_app_html,
    patch_index_php,
    patch_warehouse_php,
)

HELPER = REPO / 'lib' / 'order-return-exchange.php'
HELPER_REMOTE = '/lib/order-return-exchange.php'
JS = REPO / 'assets' / 'order-return-exchange-v1.js'
CSS = REPO / 'assets' / 'order-return-exchange-v1.css'
JS_REMOTE = '/assets/order-return-exchange-v1.js'
CSS_REMOTE = '/assets/order-return-exchange-v1.css'
TARGETS = {
    'app': '/app.html',
    'index': '/index.php',
    'warehouse': '/lib/warehouse-v53438.php',
}
SNAP_PREFIX = '/storage/Backups/release-snapshots/GP_ORDER_RETURN_EXCHANGE_V1_20261026'


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def quote(value) -> str:
    return '"' + str(value).replace('\\', '\\\\').replace('"', '\\"') + '"'


def ftp(commands, temp: Path) -> None:
    host = os.environ.get('FTP_SERVER', '')
    username = os.environ.get('FTP_USERNAME', '')
    password = os.environ.get('FTP_PASSWORD', '')
    if not host or username.lower() != 'deploy@ghadirpartner.ir' or not password:
        raise RuntimeError('STOP: invalid production FTPS release identity')
    private = temp / 'private-lftp-script'
    private.write_text('\n'.join([
        'set cmd:fail-exit yes',
        'set ftp:ssl-force true',
        'set ftp:ssl-protect-data true',
        'set ssl:verify-certificate true',
        'set net:max-retries 2',
        'open -p 21 ' + quote(host),
        'user ' + quote(username) + ' ' + quote(password),
        *commands,
        'bye',
    ]) + '\n')
    private.chmod(0o600)
    try:
        subprocess.run(['lftp', '-f', str(private)], check=True, timeout=240)
    finally:
        private.unlink(missing_ok=True)


def patch_file(kind: str, raw: bytes) -> bytes:
    text = raw.decode('utf-8')
    if kind == 'app':
        out = patch_app_html(text)
    elif kind == 'warehouse':
        out = patch_warehouse_php(text)
    else:
        out = patch_index_php(text)
    return out.encode('utf-8')


def deploy() -> None:
    ts = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
    for path in (HELPER, JS, CSS):
        if not path.is_file():
            raise RuntimeError('STOP: missing asset ' + str(path))
    if MARKER.encode() not in HELPER.read_bytes():
        raise RuntimeError('STOP: helper marker missing')
    if b'openOrderExchange' not in JS.read_bytes():
        raise RuntimeError('STOP: overlay JS incomplete')

    with tempfile.TemporaryDirectory(prefix='gp-order-return-exchange-') as name:
        temp = Path(name)
        before = {k: temp / f'{k}-before' for k in TARGETS}
        ftp([f'get {remote} -o {quote(before[k])}' for k, remote in TARGETS.items()], temp)
        original = {k: before[k].read_bytes() for k in TARGETS}

        snap_dir = f'{SNAP_PREFIX}-{ts}'
        for k, remote in TARGETS.items():
            local_snap = temp / f'snap-{k}'
            local_snap.write_bytes(original[k])
        ftp([
            f'mkdir -p {quote(snap_dir)}',
            *[f'put {quote(temp / f"snap-{k}")} -o {quote(snap_dir + "/" + Path(remote).name)}' for k, remote in TARGETS.items()],
        ], temp)
        print(f'BACKUP: remote snapshot {snap_dir}')

        updated = {k: patch_file(k, original[k]) for k in TARGETS}
        after = {k: temp / f'{k}-after' for k in TARGETS}
        for k, data in updated.items():
            after[k].write_bytes(data)
            print(f'patched {k} {sha256(original[k])[:12]} -> {sha256(data)[:12]}')

        ftp([f'put {quote(HELPER)} -o {HELPER_REMOTE}'], temp)
        ftp([f'put {quote(JS)} -o {JS_REMOTE}', f'put {quote(CSS)} -o {CSS_REMOTE}'], temp)
        for path, remote in ((HELPER, HELPER_REMOTE), (JS, JS_REMOTE), (CSS, CSS_REMOTE)):
            rb = temp / ('rb-' + Path(remote).name)
            ftp([f'get {remote} -o {quote(rb)}'], temp)
            if rb.read_bytes() != path.read_bytes():
                raise RuntimeError('STOP: readback mismatch ' + remote)

        prewrite = {k: temp / f'{k}-prewrite' for k in TARGETS}
        ftp([f'get {remote} -o {quote(prewrite[k])}' for k, remote in TARGETS.items()], temp)
        if any(prewrite[k].read_bytes() != original[k] for k in TARGETS):
            raise RuntimeError('STOP: live files changed during staging')

        try:
            ftp([f'put {quote(after[k])} -o {remote}' for k, remote in TARGETS.items()], temp)
            readback = {k: temp / f'{k}-readback' for k in TARGETS}
            ftp([f'get {remote} -o {quote(readback[k])}' for k, remote in TARGETS.items()], temp)
            if any(readback[k].read_bytes() != updated[k] for k in TARGETS):
                raise RuntimeError('STOP: production readback mismatch')
        except Exception:
            print('ERROR: restoring previous live files', file=sys.stderr)
            try:
                ftp([f'put {quote(before[k])} -o {remote}' for k, remote in TARGETS.items()], temp)
                print('ROLLBACK: previous live files restored', file=sys.stderr)
            except Exception:
                print('CRITICAL: automatic rollback failed', file=sys.stderr)
            raise
    print('SUCCESS: order return exchange v1 is live')


if __name__ == '__main__':
    if sys.argv[1:] != ['deploy']:
        raise SystemExit('Usage: deploy-production-order-return-exchange-v1.py deploy')
    deploy()
