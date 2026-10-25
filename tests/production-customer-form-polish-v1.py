#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/customer-form-polish-v1.js'
LIVE = Path('/tmp/live-gp/app-now-polish.html')


def load_deploy():
    spec = importlib.util.spec_from_file_location(
        'deploy_polish', ROOT / 'scripts/deploy-production-customer-form-polish-v1.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ensure_live():
    if LIVE.is_file() and LIVE.stat().st_size > 10000:
        raw = LIVE.read_bytes()
        if b'coop-model-v1.js' in raw:
            return raw
    LIVE.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen('https://ghadirpartner.ir/app.html', timeout=40) as resp:
        LIVE.write_bytes(resp.read())
    return LIVE.read_bytes()


def main():
    js = ASSET.read_text()
    for needle in (
        'GP_CUSTOMER_FORM_POLISH_V1_20261025',
        'gp-typeahead',
        'nextCustomerCode',
        'gpAssignCustomerOffers',
        'gpSaveCustomerOffers',
        'gpAgentsList',
        'gpRepsList',
        'تنظیمات مشاهده قیمت‌ها',
        'تخصیص طرح و آفر',
        'gp-q-hide',
    ):
        if needle not in js:
            raise AssertionError('polish overlay missing ' + needle)
    if 'این مشتری کدام کانال است؟' in js:
        raise AssertionError('question copy must stay out of the polish overlay')

    deploy = load_deploy()
    raw = ensure_live()
    if b'customer-form-polish-v1.js?v=1' in raw:
        try:
            deploy.patch_html(raw)
        except RuntimeError as exc:
            if 'already' not in str(exc):
                raise
        else:
            raise AssertionError('second polish patch should fail closed')
        print('customer form polish v1 passed')
        return

    out = deploy.patch_html(raw)
    if deploy.MARKER not in out or b'customer-form-polish-v1.js?v=1' not in out:
        raise AssertionError('patched HTML missing polish tag')
    if b'coop-model-v1.js' not in out:
        raise AssertionError('coop model must stay')
    if b'number-counter-v1.js' in out:
        raise AssertionError('number counter must stay unlinked')
    try:
        deploy.patch_html(out)
    except RuntimeError as exc:
        if 'already' not in str(exc):
            raise
    else:
        raise AssertionError('second polish patch should fail closed')
    print('customer form polish v1 passed')


if __name__ == '__main__':
    main()
