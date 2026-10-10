/* GhadirPartner V5.3.4.38 — warehouse UI refinements 2026-10-10 */
(function(){
'use strict';
if(window.__GP_WAREHOUSE_UI_REFINE_53438__) return;
window.__GP_WAREHOUSE_UI_REFINE_53438__=true;

function walkTextReplace(root, fromRe, to){
  if(!root) return;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(w.nextNode()) nodes.push(w.currentNode);
  nodes.forEach(n=>{ const old=String(n.nodeValue||''); const neu=old.replace(fromRe,to); if(neu!==old) n.nodeValue=neu; });
}

function setGpMenuLabel(btn,text){
  if(!btn)return;
  const span=btn.querySelector('.gp-menu-text');
  if(span){span.textContent=text;return;}
  const icon=[...btn.childNodes].find(n=>n.nodeType===1&&n.classList?.contains('gp-menu-icon'));
  if(icon){
    [...btn.childNodes].filter(n=>n!==icon).forEach(n=>n.remove());
    const s=document.createElement('span');s.className='gp-menu-text';s.textContent=text;btn.append(s);
  }else{
    btn.textContent=text;
  }
}
function fixWarehouseAndPriceMenuLabels(){
  const warehouseProducts=document.querySelector('#warehouseNavGroup [data-tab="products"]')||document.querySelector('[data-tab="products"]');
  setGpMenuLabel(warehouseProducts,'محصولات');
  document.querySelectorAll('[data-tab="portalAdmin"][data-gp-view="catalog"]').forEach(b=>setGpMenuLabel(b,'لیست قیمت'));
}
function mergeCustomerSerialCards(){
  const sec=document.getElementById('inventory');
  if(!sec) return;
  const cards=[...sec.children].filter(x=>x.classList&&x.classList.contains('card'));
  const relevant=cards.filter(card=>{
    const h=(card.querySelector('h3')?.textContent||'').trim();
    return /سریال/.test(h) || !!card.querySelector('#inventoryWriteTools') ||
      [...card.querySelectorAll('button')].some(b=>/Excel|PDF|فاکتور/.test(b.textContent||'')) &&
      /مشتری|سریال|فاکتور/.test(card.textContent||'');
  });
  if(!relevant.length) return;

  const base=relevant[0];
  const h=base.querySelector('h3');
  if(h) h.textContent='سریال‌های مشتریان';

  for(const extra of relevant.slice(1)){
    if(extra===base) continue;
    const divider=document.createElement('div');
    divider.className='gp-serial-merge-divider';
    base.appendChild(divider);
    [...extra.childNodes].forEach(node=>{
      if(node.nodeType===1){
        const el=node;
        const head=el.matches?.('.section-title') ? el.querySelector('h3') : (el.matches?.('h3')?el:null);
        if(head && /سریال/.test(head.textContent||'')) return;
      }
      base.appendChild(node);
    });
    extra.remove();
  }
}

function positionJDate(target){
  const input=document.getElementById(target);
  const pop=document.getElementById(target+'_picker');
  if(!input||!pop||pop.classList.contains('hidden')) return;
  const rect=input.getBoundingClientRect();
  const width=Math.min(290,Math.max(260,Math.min(rect.width||270,290)),window.innerWidth-16);
  pop.style.position='fixed';
  pop.style.zIndex='1000000';
  pop.style.right='auto';
  pop.style.width=width+'px';
  pop.style.maxHeight='min(420px, calc(100vh - 16px))';
  pop.style.overflow='auto';
  let left=Math.max(8,Math.min(window.innerWidth-width-8,rect.right-width));
  let top=rect.bottom+6;
  pop.style.left=left+'px';
  pop.style.top=top+'px';
  requestAnimationFrame(()=>{
    const h=pop.getBoundingClientRect().height||260;
    if(top+h>window.innerHeight-8) top=Math.max(8,rect.top-h-6);
    pop.style.top=top+'px';
  });
}

function installJDateFix(){
  if(typeof toggleJPicker==='function' && !toggleJPicker.__gpFixed){
    const base=toggleJPicker;
    const wrapped=function(target){
      const r=base.apply(this,arguments);
      setTimeout(()=>positionJDate(target),0);
      setTimeout(()=>positionJDate(target),40);
      return r;
    };
    wrapped.__gpFixed=true;
    toggleJPicker=wrapped;
  }
  document.querySelectorAll('.jdate').forEach(input=>{
    if(input.dataset.gpJdateFixed) return;
    input.dataset.gpJdateFixed='1';
    input.addEventListener('click',()=>setTimeout(()=>positionJDate(input.id),10));
  });
}

function addQty(map,product,qty){
  product=String(product||'بدون عنوان');
  map.set(product,(map.get(product)||0)+(Number(qty)||0));
}
function bucketHtml(map){
  const entries=[...map.entries()].filter(([,q])=>q);
  if(!entries.length) return '<span class="small">—</span>';
  const total=entries.reduce((n,[,q])=>n+Math.abs(q),0);
  return '<b>'+total.toLocaleString('fa-IR')+' دستگاه</b><div class="gp-move-products">'+
    entries.map(([p,q])=>'<span>'+esc(p)+': '+Math.abs(q).toLocaleString('fa-IR')+'</span>').join('')+
    '</div>';
}
function transferHtml(ins,outs){
  const inN=[...ins.values()].reduce((n,q)=>n+Math.abs(q),0);
  const outN=[...outs.values()].reduce((n,q)=>n+Math.abs(q),0);
  if(!inN&&!outN) return '<span class="small">—</span>';
  let s='';
  if(inN) s+='<div><b>ورود '+inN.toLocaleString('fa-IR')+'</b><div class="gp-move-products">'+[...ins].map(([p,q])=>'<span>'+esc(p)+': '+Math.abs(q).toLocaleString('fa-IR')+'</span>').join('')+'</div></div>';
  if(outN) s+='<div'+(inN?' style="margin-top:5px"':'')+'><b>خروج '+outN.toLocaleString('fa-IR')+'</b><div class="gp-move-products">'+[...outs].map(([p,q])=>'<span>'+esc(p)+': '+Math.abs(q).toLocaleString('fa-IR')+'</span>').join('')+'</div></div>';
  return s;
}

function renderDailyMovementSummary(){
  if(typeof WAREHOUSE_STATE==='undefined'||!WAREHOUSE_STATE) return;
  const body=document.getElementById('warehouseMovementBody');
  if(!body) return;
  const table=body.closest('table');
  if(!table) return;
  const ym=(document.getElementById('warehouseLedgerMonth')?.value||'').trim();
  const wid=Number(typeof WAREHOUSE_SELECTED!=='undefined'?WAREHOUSE_SELECTED:1);

  const days=new Map();
  (WAREHOUSE_STATE.movements||[]).forEach(m=>{
    const d=typeof warehouseMovementDate==='function'?warehouseMovementDate(m):'';
    if(!d || (ym&&!d.startsWith(ym))) return;
    if(Number(m.from_warehouse_id)!==wid && Number(m.to_warehouse_id)!==wid) return;
    if(!days.has(d)) days.set(d,{in:new Map(),out:new Map(),tin:new Map(),tout:new Map(),notes:new Set(),count:0});
    const g=days.get(d),qty=Number(m.qty)||0,prod=m.product||'بدون عنوان',type=String(m.type||'');
    g.count++;
    if(type==='transfer'){
      if(Number(m.to_warehouse_id)===wid) addQty(g.tin,prod,qty);
      if(Number(m.from_warehouse_id)===wid) addQty(g.tout,prod,qty);
    }else{
      const delta=(Number(m.to_warehouse_id)===wid?qty:0)-(Number(m.from_warehouse_id)===wid?qty:0);
      if(delta>0) addQty(g.in,prod,delta);
      if(delta<0) addQty(g.out,prod,-delta);
    }
    if(type==='return') g.notes.add('مرجوعی '+qty.toLocaleString('fa-IR')+' دستگاه');
    if(type==='adjustment') g.notes.add('اصلاح موجودی');
  });

  let thead=table.querySelector('thead tr');
  if(thead) thead.innerHTML='<th>تاریخ</th><th>ورود</th><th>خروج</th><th>انتقال</th><th>توضیحات</th>';

  const sig=ym+'|'+wid+'|'+[...days.entries()].map(([d,g])=>[d,g.count,[...g.in],[...g.out],[...g.tin],[...g.tout]].join(':')).join('|');
  if(body.dataset.gpGroupedSig===sig && table.querySelectorAll('thead th').length===5) return;
  const rows=[...days.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([d,g])=>{
    const notes=[...g.notes];
    if(g.count>1) notes.push(g.count.toLocaleString('fa-IR')+' ثبت تجمیع‌شده');
    return '<tr><td><b>'+esc(d)+'</b></td><td>'+bucketHtml(g.in)+'</td><td>'+bucketHtml(g.out)+'</td><td>'+transferHtml(g.tin,g.tout)+'</td><td>'+(notes.length?notes.map(esc).join('، '):'<span class="small">—</span>')+'</td></tr>';
  }).join('');
  body.innerHTML=rows||'<tr><td colspan="5">در این ماه هنوز گردش جدیدی ثبت نشده است.</td></tr>';
  body.dataset.gpGroupedSig=sig;
}


function warehouseTotalsFor(wid){
  if(typeof WAREHOUSE_STATE==='undefined'||!WAREHOUSE_STATE) return {total:0,free:0,reserved:0};
  const current=WAREHOUSE_STATE.current?.[wid]||WAREHOUSE_STATE.current?.[String(wid)]||{};
  const freeMap=WAREHOUSE_STATE.free?.[wid]||WAREHOUSE_STATE.free?.[String(wid)]||{};
  const reservedMap=WAREHOUSE_STATE.reserved?.[wid]||WAREHOUSE_STATE.reserved?.[String(wid)]||{};
  return {
    total:Object.values(current).reduce((s,n)=>s+(Number(n)||0),0),
    free:Object.values(freeMap).reduce((s,n)=>s+(Number(n)||0),0),
    reserved:Object.values(reservedMap).reduce((s,n)=>s+(Number(n)||0),0)
  };
}

function renderSeparateWarehouseLiveSummary(){
  if(typeof WAREHOUSE_STATE==='undefined'||!WAREHOUSE_STATE) return;
  const host=document.getElementById('warehouseLedgerSummary');
  if(!host) return;
  const rows=[
    {id:1,name:'انبار عمده'},
    {id:2,name:'انبار خرده تهرانپارس'}
  ];
  host.innerHTML=rows.map(w=>{
    const t=warehouseTotalsFor(w.id);
    const active=(typeof WAREHOUSE_SELECTED!=='undefined'&&Number(WAREHOUSE_SELECTED)===w.id)?' active':'';
    return '<div class="card gp-wh-live-card'+active+'">'+
      '<div class="gp-wh-live-head"><b>'+esc(w.name)+'</b><span class="badge">'+(active?'نمایش دفتر':'مجزا')+'</span></div>'+
      '<div class="gp-wh-live-stats">'+
        '<div><span>موجودی فیزیکی</span><strong>'+t.total.toLocaleString('fa-IR')+'</strong></div>'+
        '<div><span>آزاد</span><strong>'+t.free.toLocaleString('fa-IR')+'</strong></div>'+
        '<div><span>رزرو / تخصیص</span><strong>'+t.reserved.toLocaleString('fa-IR')+'</strong></div>'+
      '</div></div>';
  }).join('');
}


function stocktakeProductRows(state,wid){
  const products=(state.products||[]).map(p=>p.name).filter(Boolean);
  const names=new Set(products);
  const current=state.current?.[wid]||state.current?.[String(wid)]||{};
  const free=state.free?.[wid]||state.free?.[String(wid)]||{};
  const reserved=state.reserved?.[wid]||state.reserved?.[String(wid)]||{};
  Object.keys(current).forEach(x=>names.add(x));
  (state.baseline||[]).filter(x=>Number(x.warehouse_id)===wid).forEach(x=>names.add(x.product));
  (state.movements||[]).filter(m=>Number(m.from_warehouse_id)===wid||Number(m.to_warehouse_id)===wid).forEach(m=>names.add(m.product));

  return [...names].map(product=>{
    let incoming=(state.baseline||[]).filter(x=>Number(x.warehouse_id)===wid&&x.product===product).reduce((n,x)=>n+(Number(x.qty)||0),0);
    let outgoing=0;
    (state.movements||[]).forEach(m=>{
      if(m.product!==product)return;
      const q=Number(m.qty)||0;
      if(Number(m.to_warehouse_id)===wid) incoming+=q;
      if(Number(m.from_warehouse_id)===wid) outgoing+=q;
    });
    const physical=Number(current[product]||0);
    const fr=Number(free[product]||0);
    const rs=Number(reserved[product]||0);
    return {product,incoming,outgoing,physical,free:fr,reserved:rs,balance_ok:(incoming-outgoing)===physical};
  }).filter(r=>r.incoming||r.outgoing||r.physical||r.free||r.reserved)
    .sort((a,b)=>warehouseProductOrder(a.product)-warehouseProductOrder(b.product)||a.product.localeCompare(b.product,'fa'));
}

function renderSeparateStocktake(){
  const totals=document.getElementById('stocktakeTotals');
  const body=document.getElementById('stocktakeBody');
  if(!totals||!body)return;
  req('/api/warehouses').then(state=>{
    const all=[
      {id:1,name:'انبار عمده'},
      {id:2,name:'انبار خرده تهرانپارس'}
    ].map(w=>({w,rows:stocktakeProductRows(state,w.id)}));

    totals.innerHTML=all.map(({w,rows})=>{
      const physical=rows.reduce((n,r)=>n+r.physical,0);
      const free=rows.reduce((n,r)=>n+r.free,0);
      const reserved=rows.reduce((n,r)=>n+r.reserved,0);
      return '<div class="mutedbox gp-stocktake-wh"><b>'+esc(w.name)+'</b>'+
        '<div class="gp-stocktake-wh-stats"><span>فیزیکی <strong>'+physical.toLocaleString('fa-IR')+'</strong></span>'+
        '<span>آزاد <strong>'+free.toLocaleString('fa-IR')+'</strong></span>'+
        '<span>رزرو <strong>'+reserved.toLocaleString('fa-IR')+'</strong></span></div></div>';
    }).join('');

    const table=body.closest('table');
    const head=table?.querySelector('thead tr');
    if(head)head.innerHTML='<th>انبار</th><th>کالا / مدل</th><th>ورودی</th><th>خروج / انتقال</th><th>موجودی فیزیکی</th><th>آزاد</th><th>رزرو / تخصیص</th><th>تراز</th>';

    const html=all.map(({w,rows})=>rows.map(r=>
      '<tr><td><b>'+esc(w.name)+'</b></td><td><b>'+esc(r.product)+'</b></td><td>'+r.incoming.toLocaleString('fa-IR')+'</td>'+
      '<td>'+r.outgoing.toLocaleString('fa-IR')+'</td><td><b>'+r.physical.toLocaleString('fa-IR')+'</b></td>'+
      '<td>'+r.free.toLocaleString('fa-IR')+'</td><td>'+r.reserved.toLocaleString('fa-IR')+'</td>'+
      '<td><span class="badge '+(r.balance_ok?'st-ready':'st-cancel')+'">'+(r.balance_ok?'صحیح':'مغایرت')+'</span></td></tr>'
    ).join('')).join('');
    body.innerHTML=html||'<tr><td colspan="8">هنوز موجودی ثبت نشده است.</td></tr>';

    const card=body.closest('.card');
    const hint=card?.querySelector('.section-title .small');
    if(hint)hint.textContent='انبار عمده و انبار خرده تهرانپارس جداگانه محاسبه و نمایش داده می‌شوند؛ جمع مشترک نمایش داده نمی‌شود.';
  }).catch(e=>{
    body.innerHTML='<tr><td colspan="8">'+esc(e.message)+'</td></tr>';
  });
}

function installSeparateStocktake(){
  if(typeof loadStocktake==='function'&&!loadStocktake.__gpSeparateWarehouses){
    const wrapped=async function(){renderSeparateStocktake();};
    wrapped.__gpSeparateWarehouses=true;
    loadStocktake=wrapped;
  }
}

function emphasizeForceOrders(){
  document.querySelectorAll('#otbody tr').forEach(tr=>{
    tr.classList.toggle('gp-force-order',tr.classList.contains('fros-row'));
  });
}

function wrapWarehouseRender(){
  if(typeof renderWarehouseLedger==='function' && !renderWarehouseLedger.__gpDailyGrouped){
    const base=renderWarehouseLedger;
    const wrapped=function(){
      const body=document.getElementById('warehouseMovementBody'); if(body) delete body.dataset.gpGroupedSig;
      const r=base.apply(this,arguments);
      try{renderSeparateWarehouseLiveSummary()}catch(e){}
      try{renderDailyMovementSummary()}catch(e){}
      return r;
    };
    wrapped.__gpDailyGrouped=true;
    renderWarehouseLedger=wrapped;
  }
}

function normalizeUI(){
  fixWarehouseAndPriceMenuLabels();
  mergeCustomerSerialCards();
  installJDateFix();
  wrapWarehouseRender();
  installSeparateStocktake();
  emphasizeForceOrders();
  try{ if(document.getElementById('warehouseDaily') && !document.getElementById('warehouseDaily').classList.contains('hidden')){renderSeparateWarehouseLiveSummary();renderDailyMovementSummary();} }catch(e){}
}

const css=document.createElement('style');
css.textContent=
  '.jdate-pop{z-index:1000000!important}.jdate-wrap{overflow:visible!important}.report-grid,.card{overflow:visible}'+
  '#warehouseDaily .warehouse-ledger-bottom{display:none!important}'+
  '.gp-serial-merge-divider{height:1px;background:#e4eaf1;margin:14px 0}'+
  '#inventory>.card{overflow:visible}.gp-move-products{display:flex;flex-wrap:wrap;gap:4px 7px;margin-top:4px}.gp-move-products span{display:inline-block;background:#f4f7fb;border:1px solid #e1e8f0;border-radius:7px;padding:3px 6px;font-size:11px}.warehouse-movement-table{min-width:900px}.warehouse-movement-table td{vertical-align:top}'+
  '#warehouseLedgerSummary{display:grid!important;grid-template-columns:repeat(2,minmax(280px,1fr))!important;gap:10px!important}.gp-wh-live-card{padding:12px 14px!important;border:1px solid #dce5ee!important}.gp-wh-live-card.active{border-color:#f58220!important;box-shadow:0 0 0 2px #f5822026!important}.gp-wh-live-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px}.gp-wh-live-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.gp-wh-live-stats>div{background:#f7f9fc;border:1px solid #e5ebf2;border-radius:9px;padding:8px;text-align:center}.gp-wh-live-stats span{display:block;font-size:11px;color:#64748b;margin-bottom:4px}.gp-wh-live-stats strong{font-size:17px;color:#102a43}'+
  '#otbody tr.gp-force-order td{border-top:2px solid #ef233c!important;border-bottom:2px solid #ef233c!important;animation:gpForceGlow 1.35s linear infinite;background-clip:padding-box}#otbody tr.gp-force-order td:first-child{border-right:2px solid #ef233c!important;border-radius:0 10px 10px 0}#otbody tr.gp-force-order td:last-child{border-left:2px solid #ef233c!important;border-radius:10px 0 0 10px}#otbody tr.gp-force-order .order-no:after{content:"فورس";display:inline-block;margin-right:6px;padding:2px 6px;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:10px;font-weight:900;vertical-align:middle}@keyframes gpForceGlow{0%{box-shadow:inset 0 2px 0 #ef233c,inset 0 -2px 0 #ff758f,0 0 0 rgba(239,35,60,0)}25%{box-shadow:inset 0 2px 0 #ff758f,inset 0 -2px 0 #ef233c,0 0 8px rgba(239,35,60,.28)}50%{box-shadow:inset 0 2px 0 #ef233c,inset 0 -2px 0 #ffb3c1,0 0 13px rgba(239,35,60,.38)}75%{box-shadow:inset 0 2px 0 #ffb3c1,inset 0 -2px 0 #ef233c,0 0 8px rgba(239,35,60,.28)}100%{box-shadow:inset 0 2px 0 #ef233c,inset 0 -2px 0 #ff758f,0 0 0 rgba(239,35,60,0)}}'+
  '.gp-stocktake-wh{padding:12px!important}.gp-stocktake-wh-stats{display:flex;gap:8px;flex-wrap:wrap;margin-top:7px}.gp-stocktake-wh-stats span{background:#f7f9fc;border:1px solid #e5ebf2;border-radius:8px;padding:6px 9px}.gp-stocktake-wh-stats strong{margin-right:4px;color:#102a43}'+
  '@media(max-width:720px){#warehouseLedgerSummary{grid-template-columns:1fr!important}.gp-wh-live-stats{grid-template-columns:repeat(3,1fr)}}';
document.head.appendChild(css);

normalizeUI();
setTimeout(normalizeUI,250);
setTimeout(normalizeUI,900);

let queued=false;
new MutationObserver(()=>{
  if(queued)return; queued=true;
  setTimeout(()=>{queued=false;normalizeUI()},100);
}).observe(document.body,{subtree:true,childList:true});

window.addEventListener('resize',()=>{
  document.querySelectorAll('.jdate-pop:not(.hidden)').forEach(p=>{
    const id=p.id.replace(/_picker$/,'');positionJDate(id);
  });
});
})();
