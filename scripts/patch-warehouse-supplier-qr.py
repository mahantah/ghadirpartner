#!/usr/bin/env python3
from pathlib import Path
import sys

root=Path(sys.argv[1] if len(sys.argv)>1 else ".")
index=root/"index.php"
app=root/"app.html"
labels=root/"lib"/"labels-v5348.php"

BACK_MARK="WAREHOUSE_SUPPLIER_SEARCH_20261012"
FRONT_MARK="WAREHOUSE_SUPPLIER_UI_20261012"
QR_MARK="WAREHOUSE_CARTON_QR_LARGE_20261012"

if not index.exists() or not app.exists():
    raise SystemExit("index.php/app.html not found")

s=index.read_text(encoding="utf-8")
if BACK_MARK not in s:
    route_anchor="if($p==='/api/warehouse/import'||$p==='/api/warehouse/import-file')"
    rs=s.find(route_anchor)
    if rs<0: raise SystemExit("warehouse import route not found")
    re=s.find("if($p==='/api/warehouse/carton/delete')",rs)
    if re<0: raise SystemExit("warehouse import route end not found")
    block=s[rs:re]

    old="$prod=$x['product']??'';$cap=(int)($x['capacity']??0);"
    new="$prod=$x['product']??'';$supplier=trim((string)($x['supplier']??''));$cap=(int)($x['capacity']??0);"
    if old not in block: raise SystemExit("warehouse import product/capacity pattern not found")
    block=block.replace(old,new,1)

    old="'product'=>$prod,'color'=>$x['color']??'','capacity'=>$cap"
    new="'product'=>$prod,'color'=>$x['color']??'','supplier'=>$supplier,'capacity'=>$cap"
    if old not in block: raise SystemExit("carton supplier insertion pattern not found")
    block=block.replace(old,new,1)

    old="'carton_id'=>$id,'carton_code'=>$code,'shelf_level'=>"
    new="'carton_id'=>$id,'carton_code'=>$code,'supplier'=>$supplier,'shelf_level'=>"
    if old not in block: raise SystemExit("inventory supplier insertion pattern not found")
    block=block.replace(old,new,1)

    s=s[:rs]+"/* "+BACK_MARK+" */\n"+block+s[re:]

    search_old="(string)($iv['order_number']??''),(string)($meta['name']??'')"
    search_new="(string)($iv['order_number']??''),(string)($iv['supplier']??''),(string)($meta['name']??'')"
    if search_old not in s: raise SystemExit("inventory search text pattern not found")
    s=s.replace(search_old,search_new,1)
    index.write_text(s,encoding="utf-8")

a=app.read_text(encoding="utf-8")
if FRONT_MARK not in a:
    old='<input id="whColor" placeholder="رنگ"></div>'
    new='<input id="whColor" placeholder="رنگ"><input id="whSupplier" placeholder="نام تامین‌کننده"></div>'
    if old not in a: raise SystemExit("warehouse color input pattern not found")
    a=a.replace(old,new,1)

    body_pos=a.find('id="warehouseBody"')
    if body_pos<0: raise SystemExit("warehouseBody not found")
    wrap_pos=a.rfind('<div class="tablewrap"',0,body_pos)
    if wrap_pos<0: raise SystemExit("warehouse table wrapper not found")
    search_ui='<div class="toolbar" style="margin:10px 0"><input id="whCartonSearch" type="search" placeholder="جستجو در ورود کالا: شماره کارتن، مدل، تامین‌کننده، رنگ یا سریال" oninput="renderWarehouse()" style="min-width:340px;max-width:100%"></div>'
    a=a[:wrap_pos]+search_ui+a[wrap_pos:]

    old="color:$('whColor').value.trim(),capacity:+$('whCapacity').value"
    new="color:$('whColor').value.trim(),supplier:$('whSupplier').value.trim(),capacity:+$('whCapacity').value"
    if old not in a: raise SystemExit("manual warehouse save payload pattern not found")
    a=a.replace(old,new,1)

    old="fd.append('color',$('whColor').value.trim());fd.append('capacity',$('whCapacity').value);"
    new="fd.append('color',$('whColor').value.trim());fd.append('supplier',$('whSupplier').value.trim());fd.append('capacity',$('whCapacity').value);"
    if old not in a: raise SystemExit("warehouse file save payload pattern not found")
    a=a.replace(old,new,1)

    a=a.replace("$('whColor').value='';$('whSerials').value='';","$('whColor').value='';$('whSupplier').value='';$('whSerials').value='';",1)
    a=a.replace("$('whFile').value='';$('whColor').value='';","$('whFile').value='';$('whColor').value='';$('whSupplier').value='';",1)

    old='<td>${esc(c.product)}</td><td>${esc(c.color||\'-\')}</td>'
    new='<td>${esc(c.product)}${c.supplier?`<div class="small">تامین‌کننده: ${esc(c.supplier)}</div>`:\'\'}</td><td>${esc(c.color||\'-\')}</td>'
    if old not in a: raise SystemExit("warehouse row product pattern not found")
    a=a.replace(old,new,1)

    old=" let inv=WH.inventory||[],cartons=WH.cartons||[],notice="
    new=" let inv=WH.inventory||[],cartons=WH.cartons||[],whq=String($('whCartonSearch')?.value||'').trim().toLowerCase();if(whq)cartons=cartons.filter(c=>[c.code,c.manufacturer_box_no,c.product,c.color,c.supplier,(c.serials||[]).join(' ')].join(' ').toLowerCase().includes(whq));let notice="
    if old not in a: raise SystemExit("renderWarehouse declaration pattern not found")
    a=a.replace(old,new,1)

    old='<div class="inv-product">${esc(x.product)}</div>'
    new='<div class="inv-product">${esc(x.product)}${x.supplier?`<div class="small">تامین‌کننده: ${esc(x.supplier)}</div>`:\'\'}</div>'
    if old not in a: raise SystemExit("inventory row product pattern not found")
    a=a.replace(old,new,1)

    a=a.replace('کالا یا شماره فاکتور انجام می‌شود.','کالا، تامین‌کننده یا شماره فاکتور انجام می‌شود.')
    a=a.replace('کالا یا فاکتور','کالا، تامین‌کننده یا فاکتور')

    insert=a.find('<section id="warehouse"')
    if insert<0: raise SystemExit("warehouse section marker not found")
    a=a[:insert]+'<!-- '+FRONT_MARK+' -->'+a[insert:]
    app.write_text(a,encoding="utf-8")

if not labels.exists():
    raise SystemExit("lib/labels-v5348.php not found; cannot safely enlarge carton QR")
l=labels.read_text(encoding="utf-8")
if QR_MARK not in l:
    fn=l.find("function gp_print_carton_labels_three_up")
    if fn<0: raise SystemExit("carton label print function not found")
    end=l.find("\n}\n",fn)
    if end<0: raise SystemExit("carton label print function end not found")
    segment=l[fn:end+3]
    old=".qr-mini{display:flex;justify-content:center;align-items:center;margin:1.4mm 0 1.1mm}.qr-mini .gp-local-qr,.qr-mini .qr-static{width:15mm;height:15mm;display:block;object-fit:contain}"
    new=".qr-mini{display:flex;justify-content:center;align-items:center;margin:.5mm 0}.qr-mini .gp-local-qr,.qr-mini .qr-static{width:21mm;height:21mm;display:block;object-fit:contain;image-rendering:pixelated}"
    if old not in segment: raise SystemExit("carton QR CSS pattern not found")
    segment=segment.replace(old,new,1)
    segment="/* "+QR_MARK+" */\n"+segment
    l=l[:fn]+segment+l[end+3:]
    labels.write_text(l,encoding="utf-8")

print("warehouse supplier/search and larger carton QR patch applied")
