#!/usr/bin/env python3
"""Stock availability regression using synthetic serials only (no live data)."""
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[1]
patch = root / "scripts/patch-warehouse-free-stock-v1.py"
main_old = (
    "function warehouse_free_stock($s,$product){$n=0;"
    "foreach($s['inventory']??[] as $iv)"
    "if(($iv['product']??'')===$product&&empty($iv['order_id']))$n++;return $n;}"
)
portal_old = """<?php
if($p==='/api/bootstrap'&&$m==='GET'){
        $free=[];
        foreach($s['inventory']??[] as $iv){
            if(!empty($iv['order_id']))continue;
            $name=(string)($iv['product']??'');
            if($name!=='')$free[$name]=($free[$name]??0)+1;
        }
}
"""
with tempfile.TemporaryDirectory() as td:
    dest = Path(td)
    (dest / "partners").mkdir()
    (dest / "index.php").write_text("<?php\n" + main_old + "\n", encoding="utf-8")
    (dest / "partners/index.php").write_text(portal_old, encoding="utf-8")
    subprocess.run([sys.executable, str(patch), td], check=True, capture_output=True, text=True)
    first = ((dest / "index.php").read_text(encoding="utf-8"),
             (dest / "partners/index.php").read_text(encoding="utf-8"))
    subprocess.run([sys.executable, str(patch), td], check=True, capture_output=True, text=True)
    assert first == ((dest / "index.php").read_text(encoding="utf-8"),
                     (dest / "partners/index.php").read_text(encoding="utf-8")), "Patch not idempotent"
    assert "GP_PHYSICAL_AVAILABLE_STOCK_V1_20261018" in first[0]
    assert "GP_PHYSICAL_AVAILABLE_STOCK_V1_20261018" in first[1]
    assert "(int)($iv['warehouse_id']??0)>0" in first[0]
    assert "(int)($iv['warehouse_id']??0)<1" in first[1]
    if shutil.which("php"):
        rows = (
            "$s=['inventory'=>["
            "['product'=>'I90','warehouse_id'=>1,'order_id'=>0],"
            "['product'=>'I90','warehouse_id'=>2,'order_id'=>0],"
            "['product'=>'I90','warehouse_id'=>0,'order_id'=>0],"
            "['product'=>'I90','warehouse_id'=>1,'order_id'=>88],"
            "['product'=>'I90','warehouse_id'=>0,'order_id'=>88],"
            "['product'=>'I80','warehouse_id'=>1,'order_id'=>0]"
            "]];"
        )
        main_test = first[0] + rows + "echo warehouse_free_stock($s,'I90'),':',warehouse_free_stock($s,'I80');"
        (dest / "main-test.php").write_text(main_test, encoding="utf-8")
        result = subprocess.run(["php", str(dest / "main-test.php")], capture_output=True, text=True, check=True)
        assert result.stdout.strip() == "2:1", result.stdout
        # Run the extracted partner $free aggregation; it must match available warehouse serials.
        marker = "        /* GP_PHYSICAL_AVAILABLE_STOCK_V1_20261018 */"
        snippet = first[1].split(marker, 1)[1].split("\n        }", 1)[0] + "\n        }"
        (dest / "partner-test.php").write_text("<?php\n"+rows+"\n"+snippet+"\necho ($free['I90']??0),':',($free['I80']??0);", encoding="utf-8")
        result = subprocess.run(["php", str(dest / "partner-test.php")], capture_output=True, text=True, check=True)
        assert result.stdout.strip() == "2:1", result.stdout
print("physical stock available quantity tests pass (in-warehouse vs shipped/reserved)")
