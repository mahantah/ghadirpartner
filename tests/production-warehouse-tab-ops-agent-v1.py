#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/warehouse-tab-ops-agent-v1.js'
LIVE = Path('/tmp/live-gp/app-after-sync.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_wh_tab_ops', ROOT / 'scripts/deploy-production-warehouse-tab-ops-agent-v1.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ensure_live():
    if LIVE.is_file() and LIVE.stat().st_size > 10000:
        raw = LIVE.read_bytes()
        if b'od-chrome-v1.js' in raw:
            return raw
    LIVE.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen('https://ghadirpartner.ir/app.html', timeout=40) as resp:
        LIVE.write_bytes(resp.read())
    return LIVE.read_bytes()


def main():
    js = ASSET.read_text()
    for needle in (
        'GP_WAREHOUSE_TAB_OPS_AGENT_V1_20261026',
        'isolateWarehouse',
        'gpApplyCoopKind',
        '__gpCoopLock',
        'warehouseDaily',
        'عاملین فروش',
        'انبار سریال',
        'تاریخچه و موجودی کالا',
    ):
        if needle not in js:
            raise AssertionError('warehouse tab ops overlay missing ' + needle)

    deploy = load_deploy()
    raw = ensure_live()
    if b'warehouse-tab-ops-agent-v1.js?v=1' in raw:
        try:
            deploy.patch_html(raw)
        except RuntimeError as exc:
            if 'already' not in str(exc):
                raise
        else:
            raise AssertionError('second warehouse tab ops patch should fail closed')
        print('warehouse tab ops agent v1 passed')
        return

    if b'od-chrome-v1.js' not in raw:
        raise AssertionError('od chrome v1 must already be live')
    out = deploy.patch_html(raw)
    if deploy.MARKER not in out or b'warehouse-tab-ops-agent-v1.js?v=1' not in out:
        raise AssertionError('patched HTML missing warehouse tab ops tag')
    if b'number-counter-v1.js' in out:
        raise AssertionError('number counter must stay unlinked')
    if b'od-chrome-v1.js?v=1' not in out:
        raise AssertionError('od chrome must stay linked')
    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second warehouse tab ops patch should fail closed')
    print('warehouse tab ops agent v1 passed')


if __name__ == '__main__':
    main()
