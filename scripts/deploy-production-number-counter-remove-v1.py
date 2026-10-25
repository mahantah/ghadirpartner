#!/usr/bin/env python3
from pathlib import Path
import os
import subprocess
import sys
import tempfile

APP_REMOTE = '/app.html'
MARKER = b'GP_NUMBER_COUNTER_V1_20261025'
TAGS = (
    b'<!-- ' + MARKER + b' --><script src="/assets/number-counter-v1.js?v=1"></script>\n',
    b'<!-- ' + MARKER + b' --><script src="/assets/number-counter-v1.js?v=1"></script>',
)


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
    if MARKER not in raw and b'number-counter-v1.js' not in raw:
        raise RuntimeError('STOP: number counter already removed')
    updated = raw
    found = False
    for tag in TAGS:
        if tag in updated:
            if updated.count(tag) != 1:
                raise RuntimeError('STOP: counter script tag not unique')
            updated = updated.replace(tag, b'', 1)
            found = True
            break
    if not found:
        raise RuntimeError('STOP: expected counter script tag missing')
    if MARKER in updated or b'number-counter-v1.js' in updated:
        raise RuntimeError('STOP: counter script still present after removal')
    if b'shamsi-calendar-table-v1.js' not in updated:
        raise RuntimeError('STOP: calendar overlay would be lost')
    if b'</body></html>' not in updated:
        raise RuntimeError('STOP: document close lost')
    return updated


def deploy():
    with tempfile.TemporaryDirectory(prefix='gp-counter-off-') as name:
        temp = Path(name)
        before = temp / 'app-before'
        ftp([f'get {APP_REMOTE} -o {quote(before)}'], temp)
        original = before.read_bytes()
        updated = patch_html(original)
        after = temp / 'app-after'
        after.write_bytes(updated)
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
    print('SUCCESS: number counter effect removed from live automation')


if __name__ == '__main__':
    if sys.argv[1:] != ['deploy']:
        raise SystemExit('Usage: deploy-production-number-counter-remove-v1.py deploy')
    deploy()
