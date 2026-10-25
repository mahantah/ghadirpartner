#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/plans-icon-agent-lock-v1.js'
STORAGE = ROOT / 'lib/storage.php'
LIVE = Path('/tmp/live-gp/app-after-sync.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_lock', ROOT / 'scripts/deploy-production-plans-icon-agent-lock-v1.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ensure_live():
    if LIVE.is_file() and LIVE.stat().st_size > 10000:
        raw = LIVE.read_bytes()
        if b'customer-ops-stabilize-v1.js' in raw:
            return raw
    LIVE.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen('https://ghadirpartner.ir/app.html', timeout=40) as resp:
        LIVE.write_bytes(resp.read())
    return LIVE.read_bytes()


def main():
    js = ASSET.read_text()
    for needle in (
        'GP_PLANS_ICON_AGENT_LOCK_V1_20261025',
        'gpNavPlans',
        '__gpCoopLock',
        'persistChannel',
        'sales_channel',
        'طرح‌ها و تخفیف‌ها',
        'gp-menu-icon',
    ):
        if needle not in js:
            raise AssertionError('overlay missing ' + needle)

    php = STORAGE.read_text()
    if 'GP_MYSQL_REV_CACHE_V1_20261025' not in php:
        raise AssertionError('repo storage.php missing revision cache')
    if 'SELECT revision FROM ghadir_state' not in php:
        raise AssertionError('repo storage.php missing revision compare')

    deploy = load_deploy()
    stale = STORAGE.read_bytes().replace(
        b'    static $readCacheRev = null; /* GP_MYSQL_REV_CACHE_V1_20261025 */\n',
        b'',
    )
    # Reconstruct a stale-shaped copy from the known STALE block in the deploy module
    # by using the pre-patch snippet embedded in the deploy script itself.
    sample = (
        b"function ghadir_mysql_db(bool $write, callable $fn) {\n"
        b"    static $readCache = null;\n"
        + deploy.STALE +
        b"        if (!$write) $readCache = $s;\n"
        b"            $readCache = $s;\n"
        b"            if (isset($s['products']) && is_array($s['products'])) $GLOBALS['PRODUCTS'] = $s['products'];\n"
        b"}\n"
    )
    patched = deploy.patch_storage(sample)
    if deploy.PHP_MARKER not in patched or deploy.STALE in patched:
        raise AssertionError('storage patch did not apply cleanly')
    try:
        deploy.patch_storage(patched)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second storage patch should fail closed')

    raw = ensure_live()
    if b'plans-icon-agent-lock-v1.js?v=1' in raw:
        try:
            deploy.patch_html(raw)
        except RuntimeError as exc:
            if 'already' not in str(exc):
                raise
        else:
            raise AssertionError('second html patch should fail closed')
        print('plans icon agent lock v1 passed')
        return

    out = deploy.patch_html(raw)
    if deploy.MARKER not in out or b'plans-icon-agent-lock-v1.js?v=1' not in out:
        raise AssertionError('patched HTML missing lock tag')
    if b'customer-ops-stabilize-v1.js' not in out:
        raise AssertionError('stabilize overlay must stay')
    if b'number-counter-v1.js' in out:
        raise AssertionError('number counter must stay unlinked')
    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second html patch should fail closed')
    print('plans icon agent lock v1 passed')


if __name__ == '__main__':
    main()
