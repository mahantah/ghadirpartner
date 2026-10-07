/* GhadirPartner Web V5.3.4.9 — unified physical TSC label */
(function(){
'use strict';
if(window.__GP_TSC_5349__)return;
window.__GP_TSC_5349__=true;
const $id=id=>document.getElementById(id),num=(id,d)=>{const e=$id(id),v=e?Number(e.value):NaN;return Number.isFinite(v)?v:d},setv=(id,v)=>{const e=$id(id);if(e)e.value=v??''};

function ensureCenter(){
 const settings=$id('settings');if(!settings||$id('gpPrintCenter'))return;
 const card=document.createElement('div');card.id='gpPrintCenter';card.className='card';
 card.innerHTML=`<div class="gp-print-card">
 <div class="gp-print-top"><div><h3 style="margin:0">تنظیمات چاپ لیبل</h3><div class="small">یک سایز فیزیکی برای TSC — سفارش یک لیبل کامل، مخزن سه برچسب در هر لیبل</div></div><span class="gp-print-badge">TSC TTP-244 Pro · 203dpi</span></div>
 <div class="gp-grid">
  <label>عرض فیزیکی (mm)<input id="gp_label_w" type="number" min="25" max="108" step="0.01" value="93.98"></label>
  <label>طول فیزیکی (mm)<input id="gp_label_h" type="number" min="20" max="300" step="0.01" value="191.77"></label>
  <label>Gap (mm)<input id="gp_label_gap" type="number" min="0" max="15" step="0.1" value="3"></label>
  <label>Offset X (mm)<input id="gp_label_x" type="number" min="-10" max="10" step="0.1" value="0"></label>
  <label>Offset Y (mm)<input id="gp_label_y" type="number" min="-10" max="10" step="0.1" value="0"></label>
  <label>چاپ مخزن گروهی<select id="gp_wh_batch_mode"><option value="continuous">پشت سر هم؛ ۳ باکس در هر لیبل</option><option value="pdf">PDF همین قالب</option></select></label>
  <label>چاپ سفارش<select id="gp_order_mode"><option value="label">لیبل ارسال + QR</option><option value="pdf">PDF A4 جزئیات سفارش</option></select></label>
 </div>
 <div class="gp-actions"><button class="btn2" type="button" onclick="gpSavePrint5349()">ذخیره</button><button class="btnlight" type="button" onclick="window.open('/print/tsc-test?profile=label','_blank')">چاپ تست</button><span id="gpPrintMsg" class="small"></span></div>
 <div class="gp-note"><b>سایز پیشنهادی فعلی:</b> 3.70 × 7.55 inch = 93.98 × 191.77 mm. مخزن در هر لیبل فیزیکی سه برچسب دارد و سریال‌ها چاپ نمی‌شوند؛ هر باکس بارکد مستقل دارد. سفارش یک لیبل کامل با QR همان سفارش دارد. در Driver: Scale=100%، Margin=0 و Paper Size دقیقاً همین اندازه باشد.</div>
 </div>`;
 const first=settings.querySelector('.card');if(first)first.after(card);else settings.appendChild(card);
}
window.gpLoadPrint5349=async function(){ensureCenter();if(typeof req!=='function')return;try{const x=await req('/api/settings');setv('gp_label_w',x.print_label_w??93.98);setv('gp_label_h',x.print_label_h??191.77);setv('gp_label_gap',x.print_label_gap??3);setv('gp_label_x',x.print_label_x??0);setv('gp_label_y',x.print_label_y??0);setv('gp_wh_batch_mode',x.print_warehouse_batch_mode??'continuous');setv('gp_order_mode',x.print_order_mode??'label')}catch(e){if($id('gpPrintMsg'))$id('gpPrintMsg').textContent=e.message||String(e)}};
window.gpSavePrint5349=async function(){const body={print_profiles_v5349:true,print_printer:'TSC TTP-244 Pro',print_dpi:203,print_label_w:num('gp_label_w',93.98),print_label_h:num('gp_label_h',191.77),print_label_gap:num('gp_label_gap',3),print_label_x:num('gp_label_x',0),print_label_y:num('gp_label_y',0),print_order_w:num('gp_label_w',93.98),print_order_h:num('gp_label_h',191.77),print_order_x:num('gp_label_x',0),print_order_y:num('gp_label_y',0),print_warehouse_batch_mode:($id('gp_wh_batch_mode')||{}).value||'continuous',print_order_mode:($id('gp_order_mode')||{}).value||'label'};const m=$id('gpPrintMsg');try{await req('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(m){m.className='ok';m.textContent='تنظیمات چاپ ذخیره شد.'}}catch(e){if(m){m.className='msg';m.textContent=e.message||String(e)}}};
document.addEventListener('click',e=>{if(e.target.closest?.('[data-tab="settings"]'))setTimeout(()=>window.gpLoadPrint5349(),80)},true);
ensureCenter();
})();