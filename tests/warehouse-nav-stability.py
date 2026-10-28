"""Check bounded patch contracts using fabricated DOM and private-source opt-in."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'config/warehouse-nav-stability.json').read_text())
allowed = {'app.html', 'assets/ui-v53435-menu2.js', 'assets/nav-restructure-v1.js', 'assets/menu-live-v4.js', 'assets/warehouse-ui-refine-v53438.js'}
assert set(manifest['before_files']) == set(manifest['expected_files']) == allowed
assert len(manifest['protected_cartons']) == 18
assert all(op['file'] in allowed and op['old'] and op['count'] > 0 for op in manifest['operations'])
# The old implementation moves known nodes forever if a retired item remains.
with tempfile.TemporaryDirectory() as tmp:
    prefix = "const nav={children:[{id:'retired'},{id:'daily'},{id:'vault'}]};const parent=nav;let moves=0;nav.appendChild=function(el){moves++;this.children=this.children.filter(x=>x!==el);this.children.push(el)};const items=nav.children.slice(1);"
    old = '''let same = parent.children.length === items.length;if (same) {for (let i = 0; i < items.length; i++) {if (parent.children[i] !== items[i]) {same=false;break}}}if(!same)items.forEach(el=>parent.appendChild(el));'''
    new = old
    for op in manifest['operations']:
        if op['file'] == 'assets/ui-v53435-menu2.js' and ('current = [...parent.children]' in op['new'] or op['new'] == 'if (current[i] !== items[i])'):
            new = new.replace(op['old'].strip(), op['new'].strip())
    assert new != old
    test = prefix + '(function(){' + new + '})();if(moves!==0)throw Error("Retired items cause reorder loop");'
    file = Path(tmp) / 'test.cjs'
    file.write_text(test)
    subprocess.run(['node', str(file)], check=True)
# All staged bytes must follow the exact private owner source, when supplied.
source = os.environ.get('GP_OWNER_SOURCE')
if source:
    files = {name: (Path(source) / name).read_text() for name in allowed}
    for name, expected in manifest['before_files'].items():
        assert hashlib.sha256(files[name].encode()).hexdigest() == expected, name
    for op in manifest['operations']:
        assert files[op['file']].count(op['old']) == op['count'], op['file']
        files[op['file']] = files[op['file']].replace(op['old'], op['new'])
    for name, expected in manifest['expected_files'].items():
        assert hashlib.sha256(files[name].encode()).hexdigest() == expected, name
    with tempfile.TemporaryDirectory() as tmp:
        for name, text in files.items():
            if name.endswith('.js'):
                file = Path(tmp) / Path(name).name
                file.write_text(text)
                subprocess.run(['node', '--check', str(file)], check=True)
print('PASS: finite UI-only manifest, stable retired navigation items, source/hash checks')
