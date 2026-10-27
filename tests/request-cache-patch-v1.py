"""Verify exact patching, idempotency and refusal of unknown source."""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('patch', Path('scripts/patch-request-cache-v1.py'))
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
patch = module.RequestCachePatch()
source = "showSessionExpired();return await new Promise(()=>{})\nlet serialTools=$('customerSerialTools');if(serialTools){let roles=ME.roles||[];\n/assets/warehouse-vault-perf-v1.js?v=1"
result = patch.apply(source)
assert 'new Promise(()=>{})' not in result
assert 'ME?.roles' in result
assert patch.apply(result) == result
try:
    patch.apply('unknown')
except ValueError:
    pass
else:
    raise AssertionError('Unknown application must be rejected')
print('Request patch invariants passed')
