#!/usr/bin/env python3
"""Synthetic, offline checks for the guarded production UI-only HTML patch."""
from pathlib import Path
import importlib.util


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    'order_details_ui_release', ROOT / 'scripts/deploy-production-order-details-v2-frontend.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

sample = (b'<html><head></head><body>'
          b'<script>async function openOrderDetails(id){await ensureOrderSerialMeta(id);}\n'
          b'function orderItemSerials(o,it){}\nfunction closeOrderDetails(){}\n</script>\n'
          b'<link href="/assets/production-sidebar-placement-v2.css?v=3">\n'
          + mod.BODY_ANCHOR)
after = mod.expected_html(sample, strict_baseline=False)
assert after.count(b'GP_ORDER_DETAILS_LIVE_APPROVED_20261024') == 1
assert after.count(b'order-details-v2-approved-20261024.js?v=1') == 1
assert after.count(b'order-details-v2-approved-20261024.css?v=1') == 1
assert after.count(b'production-order-details-bridge-v1.js?v=1') == 1
assert after.count(b'async function openOrderDetails(id){await ensureOrderSerialMeta(id);') == 1
restored = after.replace(mod.CSS_LINK, b'', 1).replace(mod.BODY_INSERT, mod.BODY_ANCHOR, 1)
assert restored == sample, 'UI-only release must preserve every original HTML byte'


def must_stop(payload, strict=False):
    try:
        mod.expected_html(payload, strict_baseline=strict)
    except RuntimeError as error:
        assert str(error).startswith('STOP:'), error
    else:
        raise AssertionError('Fail-closed release accepted unsafe HTML')


must_stop(sample, strict=True)
must_stop(after)
must_stop(sample.replace(b'async function openOrderDetails(id)', b'function openOrderDetails(id)'))
must_stop(sample.replace(b'/assets/production-sidebar-placement-v2.css?v=3', b'/assets/x.css?v=1'))
must_stop(sample.replace(b'function orderItemSerials(o,it)', b'function differentOrderSerials(o,it)'))
must_stop(sample.replace(mod.BODY_ANCHOR, b'</body></html>'))
mod.validate_assets()

assert len({remote for _, remote in mod.ASSETS}) == 3
assert all(src.is_file() for src, _ in mod.ASSETS)
print('PASS: guarded frontend-only deployment and byte-for-byte HTML preservation')
