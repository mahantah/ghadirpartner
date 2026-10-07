/* GhadirPartner V5.3.4.38 — selectable warehouse carton labels */
(function(){
'use strict';
if(window.__GP_WAREHOUSE_CARTON_MULTILABEL_53438__) return;
window.__GP_WAREHOUSE_CARTON_MULTILABEL_53438__=true;

const selected=new Set();
const byId=id=>document.getElementById(id);

function visibleCartonIds(){
  const body=byId('warehouseBody');
  if(!body)return[];
  return [...body.querySelectorAll('tr')].map(tr=>{
    const btn=[...tr.querySelectorAll('button')].find(b=>(b.getAttribute('onclick')||'').includes('/print/warehouse-label?id='));
    const m=(btn?.getAttribute('onclick')||'').match(/\/print\/warehouse-label\?id=(\d+)/);
    return m?Number(m[1]):0;
  }).filter(Boolean);
}

function sync(){
  const count=selected.size;
  const badge=byId('gpWarehouseCartonLabelCount');
  if(badge)badge.textContent=count.toLocaleString('fa-IR')+' باکس انتخاب شده';
  const btn=byId('gpWarehousePrintSelectedCartons');
  if(btn)btn.disabled=!count;

  const ids=visibleCartonIds();
  const master=byId('gpWhCartonSelectAll');
  if(master){
    const n=ids.filter(id=>selected.has(id)).length;
    master.checked=ids.length>0&&n===ids.length;
    master.indeterminate=n>0&&n<ids.length;
  }
}

function togglePage(on){
  visibleCartonIds().forEach(id=>on?selected.add(id):selected.delete(id));
  document.querySelectorAll('#warehouseBody .gp-wh-carton-label-check').forEach(x=>x.checked=on);
  sync();
}

function clearSelection(){
  selected.clear();
  document.querySelectorAll('#warehouseBody .gp-wh-carton-label-check').forEach(x=>x.checked=false);
  sync();
}

function ensureToolbar(){
  const body=byId('warehouseBody');
  const wrap=body?.closest('.tablewrap');
  const card=wrap?.parentElement;
  if(!card||byId('gpWarehouseCartonPrintTools'))return;
  const bar=document.createElement('div');
  bar.id='gpWarehouseCartonPrintTools';
  bar.className='toolbar gp-wh-carton-print-tools';
  bar.innerHTML=
    '<span id="gpWarehouseCartonLabelCount" class="badge">۰ باکس انتخاب شده</span>'+
    '<button id="gpWarehousePrintSelectedCartons" class="btn2" type="button" disabled>چاپ لیبل باکس‌های انتخاب‌شده</button>'+
    '<button id="gpWarehouseSelectAllCartons" class="btnlight" type="button">انتخاب همه باکس‌ها</button>'+
    '<button id="gpWarehouseClearCartons" class="btnlight" type="button">لغو انتخاب</button>';
  card.insertBefore(bar,wrap);
  byId('gpWarehousePrintSelectedCartons').onclick=printSelected;
  byId('gpWarehouseSelectAllCartons').onclick=()=>togglePage(true);
  byId('gpWarehouseClearCartons').onclick=clearSelection;
}

function decorate(){
  const body=byId('warehouseBody');
  if(!body)return;
  const table=body.closest('table');
  const head=table?.querySelector('thead tr');
  if(head&&!byId('gpWhCartonSelectAll')){
    const th=document.createElement('th');
    th.className='gp-wh-carton-select-cell';
    th.innerHTML='<input id="gpWhCartonSelectAll" type="checkbox" title="انتخاب همه باکس‌های نمایش‌داده‌شده" aria-label="انتخاب همه باکس‌ها">';
    head.insertBefore(th,head.firstElementChild);
    byId('gpWhCartonSelectAll').addEventListener('change',e=>togglePage(e.target.checked));
  }

  [...body.rows].forEach(tr=>{
    if(tr.querySelector('.gp-wh-carton-label-check'))return;
    const btn=[...tr.querySelectorAll('button')].find(b=>(b.getAttribute('onclick')||'').includes('/print/warehouse-label?id='));
    if(!btn){
      const empty=tr.querySelector('td[colspan]');
      if(empty)empty.colSpan=12;
      return;
    }
    const m=(btn.getAttribute('onclick')||'').match(/\/print\/warehouse-label\?id=(\d+)/);
    if(!m)return;
    const id=Number(m[1]);
    const td=document.createElement('td');
    td.className='gp-wh-carton-select-cell';
    td.innerHTML='<input class="gp-wh-carton-label-check" type="checkbox" aria-label="انتخاب باکس برای چاپ لیبل">';
    const input=td.firstElementChild;
    input.dataset.cartonId=String(id);
    input.checked=selected.has(id);
    input.addEventListener('click',e=>e.stopPropagation());
    input.addEventListener('change',()=>{
      if(input.checked)selected.add(id); else selected.delete(id);
      sync();
    });
    tr.insertBefore(td,tr.firstElementChild);
  });
  ensureToolbar();
  sync();
}

async function printSelected(){
  const ids=[...selected];
  if(!ids.length){alert('حداقل یک باکس را تیک بزنید');return}
  const cartons=ids.map(id=>(WH.cartons||[]).find(c=>Number(c.id)===Number(id))).filter(Boolean);
  if(cartons.length!==ids.length){
    alert('اطلاعات یکی از باکس‌های انتخاب‌شده به‌روز نیست. یک‌بار صفحه را به‌روزرسانی کنید.');
    return;
  }

  const pop=window.open('','_blank');
  if(!pop){alert('مرورگر پنجره چاپ را مسدود کرده است؛ Pop-up را برای سایت فعال کنید.');return}

  const h=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pages=cartons.map(c=>{
    const serials=(c.serials||[]).map(s=>'<span>'+h(s)+'</span>').join('');
    return '<section class="gp-wh-print-page"><div class="label"><h2>'+h(c.code)+'</h2><b>'+h(c.product)+'</b><div class="serials">'+serials+'</div></div></section>';
  });

  pop.document.open();
  pop.document.write('<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>چاپ لیبل باکس‌های انتخاب‌شده</title>'+
    '<style>@page{size:100mm 70mm;margin:3mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#111}body{font-family:Tahoma,Arial;width:94mm}.gp-wh-print-toolbar{position:fixed;left:8px;top:8px;z-index:9999;background:#fff;border:1px solid #d7dee7;border-radius:10px;padding:8px;box-shadow:0 8px 28px #0002;font-family:Tahoma}.gp-wh-print-toolbar button{background:#102a43;color:#fff;border:0;border-radius:8px;padding:9px 16px;font-family:Tahoma;cursor:pointer}.gp-wh-print-page{width:94mm;min-height:64mm;page-break-after:always;break-after:page;padding:0;margin:0;background:#fff}.gp-wh-print-page:last-child{page-break-after:auto;break-after:auto}.label{width:94mm;min-height:64mm;border:2px solid #111;padding:3mm;background:#fff}.label h2{margin:0 0 2mm;font-size:18px}.label>b{display:block;margin-bottom:2mm}.serials{display:grid;grid-template-columns:repeat(4,1fr);gap:.8mm 1.5mm;font:8px Consolas,monospace;direction:ltr}.serials span{white-space:nowrap}@media print{.gp-wh-print-toolbar{display:none!important}}</style></head><body>'+
    '<div class="gp-wh-print-toolbar"><button onclick="window.print()">چاپ '+cartons.length.toLocaleString('fa-IR')+' لیبل انتخاب‌شده</button></div>'+
    pages.join('')+'</body></html>');
  pop.document.close();
}
const old=window.renderWarehouse;
if(typeof old==='function'){
  window.renderWarehouse=function(){
    const r=old.apply(this,arguments);
    decorate();
    return r;
  };
}

window.gpWarehousePrintSelectedCartons=printSelected;
window.gpWarehouseCartonLabelSelection=selected;

const css=document.createElement('style');
css.textContent='.gp-wh-carton-select-cell{width:48px!important;min-width:48px!important;text-align:center!important}.gp-wh-carton-select-cell input{width:19px!important;height:19px!important;min-width:19px!important;margin:0;accent-color:#f58220}.gp-wh-carton-print-tools{margin:0 0 10px 0;gap:8px;align-items:center;flex-wrap:wrap}.gp-wh-carton-print-tools .badge{white-space:nowrap}';
document.head.appendChild(css);

decorate();
setTimeout(decorate,300);
})();
