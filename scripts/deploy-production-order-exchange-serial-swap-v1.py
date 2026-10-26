#!/usr/bin/env python3
"""Deploy order exchange V2: swap returned serials in order items on production."""
from pathlib import Path
import hashlib
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

REPO = Path(__file__).resolve().parents[1]
HELPER = REPO / 'lib' / 'order-return-exchange.php'
REMOTE = '/lib/order-return-exchange.php'
MARKER = b'GP_ORDER_RETURN_EXCHANGE_V2_20261026'
SNAP_PREFIX = '/storage/Backups/release-snapshots/GP_ORDER_EXCHANGE_SERIAL_SWAP_V1_20261026'


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


def deploy() -> None:
    if not HELPER.is_file():
        raise RuntimeError('STOP: helper missing')
    body = HELPER.read_bytes()
    if MARKER not in body or b'returned_serials_replaced' not in body:
        raise RuntimeError('STOP: helper missing V2 swap logic')
    ts = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
    with tempfile.TemporaryDirectory(prefix='gp-exchange-swap-') as name:
        temp = Path(name)
        before = temp / 'helper-before.php'
        ftp([f'get {REMOTE} -o {quote(before)}'], temp)
        original = before.read_bytes()
        snap = f'{SNAP_PREFIX}-{ts}'
        ftp([f'mkdir -p {quote(snap)}', f'put {quote(before)} -o {quote(snap + "/order-return-exchange.php")}'], temp)
        print(f'BACKUP: {snap}')
        pre = temp / 'pre.php'
        ftp([f'get {REMOTE} -o {quote(pre)}'], temp)
        if pre.read_bytes() != original:
            raise RuntimeError('STOP: remote helper changed during staging')
        try:
            ftp([f'put {quote(HELPER)} -o {REMOTE}'], temp)
            rb = temp / 'rb.php'
            ftp([f'get {REMOTE} -o {quote(rb)}'], temp)
            if rb.read_bytes() != body:
                raise RuntimeError('STOP: readback mismatch')
        except Exception:
            try:
                ftp([f'put {quote(before)} -o {REMOTE}'], temp)
                print('ROLLBACK: helper restored', file=sys.stderr)
            except Exception:
                print('CRITICAL: rollback failed', file=sys.stderr)
            raise
    print(f'SUCCESS: exchange serial swap live ({sha256(body)[:12]})')


if __name__ == '__main__':
    if sys.argv[1:] != ['deploy']:
        raise SystemExit('Usage: deploy-production-order-exchange-serial-swap-v1.py deploy')
    deploy()
