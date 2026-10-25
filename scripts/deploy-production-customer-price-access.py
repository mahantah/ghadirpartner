#!/usr/bin/env python3
"""Targeted FTPS deploy of customer price-access onto the live site."""
from pathlib import Path
import hashlib
import os
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / 'scripts'))
from patch_production_customer_price_access import (  # noqa: E402
    MARKER,
    patch_app_html,
    patch_php,
    patch_portal_html,
)

HELPER = REPO / 'lib/customer-price-access.php'
HELPER_REMOTE = '/lib/customer-price-access.php'
TARGETS = {
    'app': '/app.html',
    'portal': '/partners/portal.html',
    'index': '/index.php',
    'partners': '/partners/index.php',
}


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
        subprocess.run(['lftp', '-f', str(private)], check=True, timeout=180)
    finally:
        private.unlink(missing_ok=True)


def patch_file(kind: str, raw: bytes) -> bytes:
    text = raw.decode('utf-8')
    if kind == 'app':
        out = patch_app_html(text)
    elif kind == 'portal':
        out = patch_portal_html(text)
    else:
        out = patch_php(text)
    return out.encode('utf-8')


def deploy() -> None:
    if not HELPER.is_file() or MARKER.encode() not in HELPER.read_bytes() and b'ghadir_apply_customer_price_groups' not in HELPER.read_bytes():
        if b'ghadir_apply_customer_price_groups' not in HELPER.read_bytes():
            raise RuntimeError('STOP: helper missing apply function')
    with tempfile.TemporaryDirectory(prefix='gp-price-access-') as name:
        temp = Path(name)
        before = {kind: temp / f'{kind}-before' for kind in TARGETS}
        ftp([f'get {remote} -o {quote(before[kind])}' for kind, remote in TARGETS.items()], temp)
        original = {kind: before[kind].read_bytes() for kind in TARGETS}
        updated = {kind: patch_file(kind, original[kind]) for kind in TARGETS}
        after = {}
        for kind, data in updated.items():
            path = temp / f'{kind}-after'
            path.write_bytes(data)
            after[kind] = path
            print(f'patched {kind} {sha256(original[kind])} -> {sha256(data)}')

        ftp([f'put {quote(HELPER)} -o {HELPER_REMOTE}'], temp)
        helper_read = temp / 'helper-readback'
        ftp([f'get {HELPER_REMOTE} -o {quote(helper_read)}'], temp)
        if helper_read.read_bytes() != HELPER.read_bytes():
            raise RuntimeError('STOP: helper readback mismatch')

        prewrite = {kind: temp / f'{kind}-prewrite' for kind in TARGETS}
        ftp([f'get {remote} -o {quote(prewrite[kind])}' for kind, remote in TARGETS.items()], temp)
        if any(prewrite[kind].read_bytes() != original[kind] for kind in TARGETS):
            raise RuntimeError('STOP: live files changed during staging')

        try:
            ftp([f'put {quote(after[kind])} -o {remote}' for kind, remote in TARGETS.items()], temp)
            readback = {kind: temp / f'{kind}-readback' for kind in TARGETS}
            ftp([f'get {remote} -o {quote(readback[kind])}' for kind, remote in TARGETS.items()], temp)
            if any(readback[kind].read_bytes() != updated[kind] for kind in TARGETS):
                raise RuntimeError('STOP: production readback mismatch')
        except Exception:
            print('ERROR: restoring previous live files', file=sys.stderr)
            try:
                ftp([f'put {quote(before[kind])} -o {remote}' for kind, remote in TARGETS.items()], temp)
                print('ROLLBACK: previous live files restored', file=sys.stderr)
            except Exception:
                print('CRITICAL: automatic rollback failed', file=sys.stderr)
            raise
    print('SUCCESS: customer price-access released to production')
    print('UNCHANGED: inventory, orders history, auth, MySQL, and unrelated UI')


if __name__ == '__main__':
    if sys.argv[1:] != ['deploy']:
        raise SystemExit('Usage: deploy-production-customer-price-access.py deploy')
    deploy()
