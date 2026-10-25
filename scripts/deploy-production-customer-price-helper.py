#!/usr/bin/env python3
from pathlib import Path
import os
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[1]
HELPER = REPO / 'lib/customer-price-access.php'
REMOTE = '/lib/customer-price-access.php'


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
        subprocess.run(['lftp', '-f', str(private)], check=True, timeout=120)
    finally:
        private.unlink(missing_ok=True)


def main():
    if b'ghadir_apply_customer_price_groups' not in HELPER.read_bytes():
        raise RuntimeError('STOP: helper missing apply function')
    if b'mixed' in HELPER.read_bytes() or b'strict_types' in HELPER.read_bytes():
        raise RuntimeError('STOP: helper still uses PHP 8-only syntax')
    with tempfile.TemporaryDirectory(prefix='gp-helper-') as name:
        temp = Path(name)
        ftp([f'put {quote(HELPER)} -o {REMOTE}'], temp)
        readback = temp / 'helper-readback'
        ftp([f'get {REMOTE} -o {quote(readback)}'], temp)
        if readback.read_bytes() != HELPER.read_bytes():
            raise RuntimeError('STOP: helper readback mismatch')
    print('SUCCESS: PHP 7 compatible helper published')


if __name__ == '__main__':
    main()
