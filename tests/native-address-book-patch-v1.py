from pathlib import Path
import subprocess
import sys
import tempfile

script = Path(__file__).resolve().parents[1] / 'scripts' / 'patch-native-address-book-v1.py'
router = "<?php\nfunction auth($r=[]){}\nfunction db($w,$f){}\n$p='/api/orders';$m='GET';\nfail('مسیر پیدا نشد',404);\n"
with tempfile.TemporaryDirectory() as tmp:
    root = Path(tmp)
    target = root / 'partners' / 'index.php'
    target.parent.mkdir()
    target.write_text(router)
    subprocess.run([sys.executable,str(script),tmp],check=True)
    patched = target.read_text()
    assert "if ($p === '/api/addresses')" in patched
    assert patched.index("if ($p === '/api/addresses')") < patched.index("fail('مسیر پیدا نشد',404);")
    subprocess.run([sys.executable,str(script),tmp],check=True)
    assert target.read_text() == patched
    subprocess.run(['php','-l',str(target)],check=True)
    for invalid in [router.replace("fail('مسیر پیدا نشد',404);",'') , router.replace("$p='/api/orders'", "if($p==='/api/addresses'){};$p='/api/orders'")]:
        target.write_text(invalid)
        r = subprocess.run([sys.executable,str(script),tmp],capture_output=True)
        assert r.returncode != 0 and target.read_text() == invalid
    target.write_text(patched.replace('حساب مشتری لازم است','changed implementation'))
    r = subprocess.run([sys.executable,str(script),tmp],capture_output=True)
    assert r.returncode != 0
print('PASS: patch placement, PHP syntax, idempotence and fail-closed guards')
