"""Check the exact live drift is repaired idempotently and fails closed."""
import importlib.util
from pathlib import Path
root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('patch', root / 'scripts/patch-storage-cache-revision.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
patch = module.StorageCacheRevisionPatch()
correct = (root / 'lib/storage.php').read_text()
drift = correct.replace('    static $readCacheRev = null;', '    static $readRevision = null;\n    static $readCacheRev = null;').replace("$readCacheRev = (int)$row['revision'];", "$readRevision = (int)$row['revision'];").replace('$readCacheRev = $revision;', '$readRevision = $revision;')
assert patch.apply(drift) == correct
assert patch.apply(correct) == correct
try:
    patch.apply(drift.replace('$readRevision = $revision;', ''))
except ValueError:
    pass
else:
    raise AssertionError('Unknown drift accepted')
print('Storage revision patch passed')
