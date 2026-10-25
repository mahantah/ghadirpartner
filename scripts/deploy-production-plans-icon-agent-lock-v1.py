#!/usr/bin/env python3
from pathlib import Path
import os
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[1]
ASSET = REPO / 'assets/plans-icon-agent-lock-v1.js'
ASSET_REMOTE = '/assets/plans-icon-agent-lock-v1.js'
APP_REMOTE = '/app.html'
STORAGE_REMOTE = '/lib/storage.php'
MARKER = b'GP_PLANS_ICON_AGENT_LOCK_V1_20261025'
PHP_MARKER = b'GP_MYSQL_REV_CACHE_V1_20261025'
TAG = b'<!-- ' + MARKER + b' --><script src="/assets/plans-icon-agent-lock-v1.js?v=1"></script>\n'
ANCHOR = b'</body></html>'

STALE = (
    b"        if (!$write && is_array($readCache)) {\n"
    b"            $s = $readCache;\n"
    b"            if (isset($s['products']) && is_array($s['products'])) $GLOBALS['PRODUCTS'] = $s['products'];\n"
    b"            return $fn($s);\n"
    b"        }\n"
)
FRESH_IF = (
    b"        if (!$write && is_array($readCache)) {\n"
    b"            $revNow = (int)$pdo->query('SELECT revision FROM ghadir_state WHERE id=1')->fetchColumn();\n"
    b"            if ($revNow === (int)($readCacheRev ?? -1)) {\n"
    b"                $s = $readCache;\n"
    b"                if (isset($s['products']) && is_array($s['products'])) $GLOBALS['PRODUCTS'] = $s['products'];\n"
    b"                return $fn($s);\n"
    b"            }\n"
    b"            $readCache = null;\n"
    b"            $readCacheRev = null;\n"
    b"        }\n"
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
    if MARKER in raw and TAG.strip() in raw:
        raise RuntimeError('STOP: plans icon agent lock v1 already linked')
    if b'plans-icon-agent-lock-v1.js' in raw:
        raise RuntimeError('STOP: plans icon agent lock script already present')
    if b'customer-ops-stabilize-v1.js' not in raw:
        raise RuntimeError('STOP: stabilize overlay missing; refuse to patch')
    if raw.count(ANCHOR) != 1:
        raise RuntimeError('STOP: app.html closing body not unique')
    return raw.replace(ANCHOR, TAG + ANCHOR, 1)


def patch_storage(raw: bytes) -> bytes:
    if PHP_MARKER in raw:
        raise RuntimeError('STOP: mysql rev cache already present')
    if b'static $readCache = null;' not in raw:
        raise RuntimeError('STOP: live storage.php missing read cache')
    if STALE not in raw:
        raise RuntimeError('STOP: live storage.php cache block not unique')
    if raw.count(STALE) != 1:
        raise RuntimeError('STOP: live storage.php cache block not unique')
    out = raw.replace(b'static $readCache = null;\n', b'static $readCache = null;\n    static $readCacheRev = null; /* GP_MYSQL_REV_CACHE_V1_20261025 */\n', 1)
    out = out.replace(STALE, FRESH_IF, 1)
    out = out.replace(
        b"        if (!$write) $readCache = $s;\n",
        b"        if (!$write) {\n            $readCache = $s;\n            $readCacheRev = (int)$row['revision'];\n        }\n",
        1,
    )
    out = out.replace(
        b"            $readCache = $s;\n            if (isset($s['products']) && is_array($s['products'])) $GLOBALS['PRODUCTS'] = $s['products'];\n",
        b"            $readCache = $s;\n            $readCacheRev = $revision;\n            if (isset($s['products']) && is_array($s['products'])) $GLOBALS['PRODUCTS'] = $s['products'];\n",
        1,
    )
    if PHP_MARKER not in out:
        raise RuntimeError('STOP: storage patch lost marker')
    if STALE in out:
        raise RuntimeError('STOP: stale cache block still present')
    return out


def deploy():
    blob = ASSET.read_bytes()
    for needle in (
        MARKER,
        b'gpNavPlans',
        b'__gpCoopLock',
        b'sales_channel',
        b'persistChannel',
        'طرح‌ها و تخفیف‌ها'.encode(),
    ):
        if needle not in blob:
            raise RuntimeError('STOP: overlay asset incomplete: ' + needle.decode('utf-8', 'replace'))
    with tempfile.TemporaryDirectory(prefix='gp-plans-icon-agent-lock-v1-') as name:
        temp = Path(name)
        before = temp / 'app-before'
        ftp([f'get {APP_REMOTE} -o {quote(before)}'], temp)
        original = before.read_bytes()
        updated = patch_html(original)
        after = temp / 'app-after'
        after.write_bytes(updated)

        storage_before = temp / 'storage-before'
        ftp([f'get {STORAGE_REMOTE} -o {quote(storage_before)}'], temp)
        storage_original = storage_before.read_bytes()
        storage_updated = patch_storage(storage_original)
        storage_after = temp / 'storage-after'
        storage_after.write_bytes(storage_updated)

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
            ftp([f'put {quote(storage_after)} -o {STORAGE_REMOTE}'], temp)
            storage_readback = temp / 'storage-readback'
            ftp([f'get {STORAGE_REMOTE} -o {quote(storage_readback)}'], temp)
            if storage_readback.read_bytes() != storage_updated:
                raise RuntimeError('STOP: storage.php readback mismatch')
        except Exception:
            try:
                ftp([f'put {quote(before)} -o {APP_REMOTE}'], temp)
                ftp([f'put {quote(storage_before)} -o {STORAGE_REMOTE}'], temp)
                print('ROLLBACK: previous app.html and storage.php restored', file=sys.stderr)
            except Exception:
                print('CRITICAL: automatic rollback failed', file=sys.stderr)
            raise
    print('SUCCESS: plans icon, agent lock, and mysql rev cache are live')


if __name__ == '__main__':
    if sys.argv[1:] != ['deploy']:
        raise SystemExit('Usage: deploy-production-plans-icon-agent-lock-v1.py deploy')
    deploy()
