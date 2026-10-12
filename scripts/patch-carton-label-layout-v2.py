#!/usr/bin/env python3
from pathlib import Path
import sys

root=Path(sys.argv[1] if len(sys.argv)>1 else ".")
labels=root/"lib"/"labels-v5348.php"
MARK="WAREHOUSE_CARTON_QR_LAYOUT_V2_20261012"

if not labels.exists():
    raise SystemExit("lib/labels-v5348.php not found")

s=labels.read_text(encoding="utf-8")
if MARK in s:
    print("carton label QR layout v2 already applied")
    raise SystemExit(0)

fn=s.find("function gp_carton_ticket_html($c)")
if fn<0:
    raise SystemExit("gp_carton_ticket_html not found")
fn_end=s.find("\n}\n",fn)
if fn_end<0:
    raise SystemExit("gp_carton_ticket_html end not found")
block=s[fn:fn_end+3]

old_return=""" return '<article class="ticket"><div class="t-head"><img src="/brand-v5311.png" alt=""><div><b>قدیر پرداخت</b><div class="subp">09128151868</div><div class="code">'.gp_h($code).'</div></div></div><div class="product">'.gp_h($product).'</div><div class="meta"><span>تعداد: <b>'.$count.'</b>'.($cap?' / '.$cap:'').'</span>'.($color!==''?'<span>رنگ: <b>'.gp_h($color).'</b></span>':'').'</div><div class="qr-mini"><img class="qr-static" src="/assets/carton-static-qr-v53418.png" alt="QR لیبل کارتن"></div>'.gp_code128_svg($payload).'<div class="scantext">اسکن QR = اطلاعات ثابت مدنظر شما | اسکن بارکد = بازیابی باکس در مخزن</div></article>';"""
new_return=""" return '<article class="ticket"><div class="qr-mini"><div class="qrRender" data-value="'.gp_h($payload).'"></div></div><img class="brand-corner" src="/brand-v5311.png" alt="قدیر پرداخت"><div class="t-center"><div class="brand-name">قدیر پرداخت</div><div class="subp">09128151868</div><div class="carton-title">شماره کارتن</div><div class="code">'.gp_h($code).'</div></div><div class="ticket-bottom"><div class="product">'.gp_h($product).'</div><div class="meta"><span>تعداد: <b>'.$count.'</b>'.($cap?' / '.$cap:'').'</span>'.($color!==''?'<span>رنگ: <b>'.gp_h($color).'</b></span>':'').'</div>'.gp_code128_svg($payload).'<div class="scantext">QR و بارکد این لیبل مربوط به شماره کارتن هستند</div></div></article>';"""
if old_return not in block:
    raise SystemExit("carton ticket HTML pattern not found")
block=block.replace(old_return,new_return,1)
s=s[:fn]+"/* "+MARK+" */\n"+block+s[fn_end+3:]

pf=s.find("function gp_print_carton_labels_three_up($cartons,$profile)")
if pf<0:
    raise SystemExit("gp_print_carton_labels_three_up not found")
pf_end=s.find("\n}\n",pf)
if pf_end<0:
    raise SystemExit("gp_print_carton_labels_three_up end not found")
segment=s[pf:pf_end+3]

old_css=".physical:last-child{break-after:auto;page-break-after:auto}.ticket{position:relative;padding:3.4mm 4.5mm;border-bottom:.35mm dashed #8594a6;overflow:hidden}.ticket:last-child{border-bottom:0}.ticket.empty{background:#fff}"
new_css=".physical:last-child{break-after:auto;page-break-after:auto}.ticket{position:relative;padding:2.5mm 4mm;border-bottom:.35mm dashed #8594a6;overflow:hidden}.ticket:last-child{border-bottom:0}.ticket.empty{background:#fff}"
if old_css not in segment:
    raise SystemExit("ticket base CSS pattern not found")
segment=segment.replace(old_css,new_css,1)

old_css2=".t-head{display:flex;justify-content:space-between;align-items:center;gap:3mm}.t-head img{width:10mm;height:10mm;object-fit:contain}.t-head b{font-size:11px}.subp{font-size:7px;color:#5a6d85}.code{direction:ltr;font:900 12px Consolas,monospace;color:#0b1f3a}.product{font-size:12px;font-weight:900;margin:1.3mm 0 1mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.meta{display:flex;gap:7mm;font-size:8.5px;color:#53647b}.qr-mini{display:flex;justify-content:center;align-items:center;margin:.5mm 0}.qr-mini .gp-local-qr,.qr-mini .qr-static{width:21mm;height:21mm;display:block;object-fit:contain;image-rendering:pixelated}.barcode{display:block;width:100%;height:11.5mm;fill:#000;margin-top:1mm}.scantext{text-align:center;font-size:7px;color:#53647b;margin-top:.8mm}"
new_css2=".qr-mini{position:absolute;top:2.5mm;left:3mm;width:28mm;height:28mm;display:flex;align-items:center;justify-content:center;background:#fff}.qr-mini .gp-local-qr{width:28mm;height:28mm;display:block}.brand-corner{position:absolute;top:3mm;right:3mm;width:11mm;height:11mm;object-fit:contain}.t-center{height:28mm;margin:0 15mm 0 31mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.brand-name{font-size:15px;font-weight:900;line-height:1.2}.subp{font-size:10px;color:#334e68;margin-top:.8mm}.carton-title{font-size:8px;color:#6b7f95;margin-top:1.2mm}.code{direction:ltr;font:900 17px Consolas,monospace;color:#0b1f3a;line-height:1.1;margin-top:.4mm}.ticket-bottom{margin-top:.8mm}.product{text-align:center;font-size:11px;font-weight:900;margin:.4mm 0 .6mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.meta{display:flex;justify-content:center;gap:7mm;font-size:8px;color:#53647b}.barcode{display:block;width:100%;height:8.5mm;fill:#000;margin-top:.6mm}.scantext{text-align:center;font-size:6.5px;color:#53647b;margin-top:.3mm}"
if old_css2 not in segment:
    raise SystemExit("carton label QR CSS pattern not found")
segment=segment.replace(old_css2,new_css2,1)

s=s[:pf]+segment+s[pf_end+3:]
labels.write_text(s,encoding="utf-8")
print("carton label QR layout v2 applied")
