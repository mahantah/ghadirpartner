/* GhadirPartner V5.3.4.38 — warehouse UI refinements 2026-10-10 */
(function(){
'use strict';
if(window.__GP_WAREHOUSE_UI_REFINE_53438__) return;
window.__GP_WAREHOUSE_UI_REFINE_53438__=true;

/* GP_UI_HOTFIX_20261010
   GP_UI_HOTFIX_DEPLOY_RETRY_2
   - compact warehouse summary cards
   - keep stocktake product sorting self-contained
   - make stocktake warehouse switch use a real global state
*/
/* GP_LEDGER_CURRENT_ANCHOR_20261010
   Daily ledger must be anchored to the canonical current inventory, not a possibly
   contaminated baseline. This prevents the first receipt after warehouse activation
   from being counted once inside the baseline and once again as a movement.
*/
/* GP_LEDGER_CURRENT_ANCHOR_V2_20261017
   warehouse-v53438.js renders the day grid from baseline+movements and never
   calls warehouseStockAtDay. Rewrite that grid from physical current so
   movement-only product names cannot go negative.
*/
/* GP_WAREHOUSE_SERIALS_FROM_INVENTORY_V3_20261018
   After protected-carton repair, carton.serials can stay empty while inventory
   still holds the serial rows. List and hydrate from inventory, not serials[].
*/
/* GP_WHOLESALE_LEDGER_REPORTS_V4_20261018
   Daily ledger and stocktake reports are wholesale-only; retail is not shown.
   Stocktake lists every serial-tracked model; ledger leaves future days blank.
*/
const GP_WHOLESALE_WAREHOUSE_ID=1;
/* GP_I90_LEDGER_FAMILY_V5_20261018 — one ledger row for split I90 product names. */
function gpWarehouseLedgerFamilyKey(name){
  const n=String(name||'').trim();
  if(/\bI90\b/i.test(n)) return 'FAMILY:I90';
  if(/\bI80\b/i.test(n)) return 'FAMILY:I80';
  return 'SKU:'+n;
}
function gpWarehouseLedgerFamilyLabel(familyKey,sampleName){
  if(familyKey==='FAMILY:I90') return 'دستگاه کارتخوان I90';
  if(familyKey==='FAMILY:I80') return 'دستگاه کارتخوان I80';
  return String(sampleName||'').trim();
}
function gpWarehouseLedgerRows(state,wid){
  if(!state) return [];
  const catalog=(state.products||[]).map(p=>String(p.name||'').trim()).filter(Boolean);
  const fam=new Map();
  const touch=(name)=>{
    const n=String(name||'').trim();
    if(!n) return;
    const fk=gpWarehouseLedgerFamilyKey(n);
    if(!fam.has(fk)) fam.set(fk,{familyKey:fk,label:gpWarehouseLedgerFamilyLabel(fk,n),keys:new Set(),catalog:false});
    const row=fam.get(fk);
    row.keys.add(n);
    if(catalog.includes(n)) row.catalog=true;
  };
  catalog.forEach(touch);
  Object.keys((state.current&&state.current[wid])||{}).forEach(touch);
  (state.baseline||[]).filter(x=>Number(x.warehouse_id)===wid).forEach(x=>touch(x.product));
  (state.movements||[]).forEach(m=>{
    if(Number(m.from_warehouse_id)!==wid && Number(m.to_warehouse_id)!==wid) return;
    touch(m.product);
  });
  return [...fam.values()]
    .filter(r=>[...r.keys].some(k=>gpWarehouseCurrentQty(state,wid,k)>0))
    .map(r=>({product:r.label,keys:[...r.keys]}))
    .sort((a,b)=>warehouseProductOrder(a.product)-warehouseProductOrder(b.product)||a.product.localeCompare(b.product,'fa'));
}
function gpWarehouseCurrentQty(state,wid,product){
  const current=state?.current?.[wid]||state?.current?.[String(wid)]||{};
  return Number(current?.[product]||0);
}
function gpWarehouseCurrentQtyKeys(state,wid,keys){
  return (keys||[]).reduce((n,k)=>n+gpWarehouseCurrentQty(state,wid,k),0);
}
function gpWarehouseMovementMatchesProduct(m,product){
  return String(m?.product||'')===String(product||'');
}
function gpWarehouseStockOnJalaliDayKeys(state,wid,keys,jday,today){
  if(!state) return 0;
  let q=gpWarehouseCurrentQtyKeys(state,wid,keys);
  const day=String(jday||'');
  const now=String(today||'');
  for(const m of (state.movements||[])){
    if(!(keys||[]).some(k=>gpWarehouseMovementMatchesProduct(m,k))) continue;
    const md=gpWarehouseMovementJalali(m);
    if(md && now && md>day && md<=now) q-=gpWarehouseMovementDelta(m,wid);
  }
  return q;
}
window.gpWarehouseLedgerRows=gpWarehouseLedgerRows;
window.gpWarehouseCurrentQtyKeys=gpWarehouseCurrentQtyKeys;
window.gpWarehouseStockOnJalaliDayKeys=gpWarehouseStockOnJalaliDayKeys;
function gpWarehouseMovementDelta(m,wid){
  let d=0;
  if(Number(m?.to_warehouse_id)===Number(wid)) d+=Number(m?.qty)||0;
  if(Number(m?.from_warehouse_id)===Number(wid)) d-=Number(m?.qty)||0;
  return d;
}
function gpWarehouseEffectiveBaselineQty(state,wid,product){
  if(!state) return 0;
  let q=gpWarehouseCurrentQty(state,wid,product);
  for(const m of (state.movements||[])){
    if(m?.product!==product) continue;
    q-=gpWarehouseMovementDelta(m,wid);
  }
  return q;
}
function gpWarehouseMovementJalali(m){
  if(!m) return '';
  if(m.jdate) return String(m.jdate);
  try{ if(typeof jalaliDate==='function') return String(jalaliDate(m.created_at||'')||''); }catch(e){}
  return '';
}
function gpWarehouseStockOnJalaliDay(state,wid,product,jday,today){
  if(!state) return 0;
  let q=gpWarehouseCurrentQty(state,wid,product);
  const day=String(jday||'');
  const now=String(today||'');
  for(const m of (state.movements||[])){
    if(String(m?.product||'')!==String(product||'')) continue;
    const md=gpWarehouseMovementJalali(m);
    if(md && now && md>day && md<=now) q-=gpWarehouseMovementDelta(m,wid);
  }
  return q;
}
window.gpWarehouseStockOnJalaliDay=gpWarehouseStockOnJalaliDay;
window.gpWarehouseCurrentQty=gpWarehouseCurrentQty;
function installWarehouseLedgerCurrentAnchor(){
  if(typeof warehouseBaselineQty==='function' && !warehouseBaselineQty.__gpCurrentAnchor){
    const fn=function(wid,product){return gpWarehouseEffectiveBaselineQty(WAREHOUSE_STATE,wid,product)};
    fn.__gpCurrentAnchor=true;
    warehouseBaselineQty=fn;
  }
  if(typeof warehouseStockAtDay==='function' && !warehouseStockAtDay.__gpCurrentAnchor){
    const fn=function(wid,product,jday){
      if(typeof WAREHOUSE_STATE==='undefined'||!WAREHOUSE_STATE) return null;
      const activation=typeof jalaliDate==='function'?jalaliDate(WAREHOUSE_STATE.activated_at||''):'';
      const today=typeof warehouseTodayJ==='function'?warehouseTodayJ():'';
      if(!activation||!today||jday<activation||jday>today) return null;
      let q=gpWarehouseCurrentQty(WAREHOUSE_STATE,wid,product);
      for(const m of (WAREHOUSE_STATE.movements||[])){
        if(m?.product!==product) continue;
        const md=typeof warehouseMovementDate==='function'?warehouseMovementDate(m):'';
        if(md && md>jday && md<=today) q-=gpWarehouseMovementDelta(m,wid);
      }
      return q;
    };
    fn.__gpCurrentAnchor=true;
    warehouseStockAtDay=fn;
  }
}

function warehouseProductOrder(p){
  const n=String(p||'').toUpperCase();
  const keys=['I90','I80','T3 2G','T3 4G ECONOMY','H9 PRO','MF919','M3P','T3 4G','AF-75 - پلاس','Z-990','V77','AF-70 - پلاس','M3P- 4G','K9'];
  const i=keys.findIndex(k=>n.includes(String(k).toUpperCase()));
  return i<0?999:i;
}

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
  const wid=GP_WHOLESALE_WAREHOUSE_ID;

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
  const wid=GP_WHOLESALE_WAREHOUSE_ID;
  const t=warehouseTotalsFor(wid);
  host.innerHTML=
    '<div class="card"><div class="small">انبار</div><b>انبار عمده</b></div>'+
    '<div class="card"><div class="small">موجودی فیزیکی</div><b>'+t.total.toLocaleString('fa-IR')+' دستگاه</b></div>'+
    '<div class="card"><div class="small">آزاد</div><b>'+t.free.toLocaleString('fa-IR')+'</b></div>'+
    '<div class="card"><div class="small">رزرو / تخصیص</div><b>'+t.reserved.toLocaleString('fa-IR')+'</b></div>';
}


function stocktakeProductRows(state,wid){
  const current=state.current?.[wid]||state.current?.[String(wid)]||{};
  const free=state.free?.[wid]||state.free?.[String(wid)]||{};
  const reserved=state.reserved?.[wid]||state.reserved?.[String(wid)]||{};
  return gpWarehouseLedgerRows(state,wid).map(({product,keys})=>{
    let incoming=0,outgoing=0,physical=0,fr=0,rs=0;
    keys.forEach(k=>{
      incoming+=gpWarehouseEffectiveBaselineQty(state,wid,k);
      physical+=Number(current[k]||0);
      fr+=Number(free[k]||0);
      rs+=Number(reserved[k]||0);
      (state.movements||[]).forEach(m=>{
        if(!gpWarehouseMovementMatchesProduct(m,k)) return;
        const q=Number(m.qty)||0;
        if(Number(m.to_warehouse_id)===wid) incoming+=q;
        if(Number(m.from_warehouse_id)===wid) outgoing+=q;
      });
    });
    return {product,incoming,outgoing,physical,free:fr,reserved:rs,balance_ok:(incoming-outgoing)===physical};
  });
}

function renderSeparateStocktake(){
  const totals=document.getElementById('stocktakeTotals');
  const body=document.getElementById('stocktakeBody');
  if(!totals||!body)return;
  req('/api/warehouses').then(state=>{
    const wid=GP_WHOLESALE_WAREHOUSE_ID;
    const rows=stocktakeProductRows(state,wid);
    const physical=rows.reduce((n,r)=>n+r.physical,0);
    const free=rows.reduce((n,r)=>n+r.free,0);
    const reserved=rows.reduce((n,r)=>n+r.reserved,0);
    const incoming=rows.reduce((n,r)=>n+r.incoming,0);
    totals.innerHTML=
      '<div class="mutedbox"><span class="small">کل ورودی (همه مدل‌ها)</span><h2>'+incoming.toLocaleString('fa-IR')+'</h2></div>'+
      '<div class="mutedbox"><span class="small">موجودی فیزیکی — انبار عمده</span><h2>'+physical.toLocaleString('fa-IR')+'</h2></div>'+
      '<div class="mutedbox"><span class="small">آزاد</span><h2>'+free.toLocaleString('fa-IR')+'</h2></div>'+
      '<div class="mutedbox"><span class="small">رزرو / تخصیص</span><h2>'+reserved.toLocaleString('fa-IR')+'</h2></div>';

    const table=body.closest('table');
    const head=table?.querySelector('thead tr');
    if(head)head.innerHTML='<th>کالا / مدل</th><th>ورودی ثبت‌شده</th><th>خروج / انتقال</th><th>موجودی فیزیکی</th><th>آزاد</th><th>رزرو / تخصیص</th><th>تراز</th>';

    body.innerHTML=rows.map(r=>
      '<tr><td><b>'+esc(r.product)+'</b></td><td>'+r.incoming.toLocaleString('fa-IR')+'</td>'+
      '<td>'+r.outgoing.toLocaleString('fa-IR')+'</td><td><b>'+r.physical.toLocaleString('fa-IR')+'</b></td>'+
      '<td>'+r.free.toLocaleString('fa-IR')+'</td><td>'+r.reserved.toLocaleString('fa-IR')+'</td>'+
      '<td><span class="badge '+(r.balance_ok?'st-ready':'st-cancel')+'">'+(r.balance_ok?'صحیح':'مغایرت')+'</span></td></tr>'
    ).join('')||'<tr><td colspan="7">هنوز مدلی تعریف نشده است.</td></tr>';

    const card=body.closest('.card');
    const hint=card?.querySelector('.section-title .small');
    if(hint)hint.textContent='گزارش فقط انبار عمده است؛ فقط مدل‌هایی که موجودی فیزیکی دارند نمایش داده می‌شوند.';
  }).catch(e=>{
    body.innerHTML='<tr><td colspan="7">'+esc(e.message)+'</td></tr>';
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

function gpPad2(n){return String(n).padStart(2,'0')}
function gpRewriteLedgerGridToCurrent(){
  const d=window.WAREHOUSE_LEDGER_DATA;
  window.WAREHOUSE_STATE=d||window.WAREHOUSE_STATE;
  const wrap=document.getElementById('warehouseLedgerWrap');
  if(!d||!wrap) return;
  const monthEl=document.getElementById('warehouseLedgerMonth');
  const raw=String(monthEl?.value||(typeof whCurrentJMonth==='function'?whCurrentJMonth():''));
  const m=raw.match(/^(\d{4})\/(\d{1,2})$/);
  if(!m) return;
  const jy=+m[1], jm=+m[2];
  if(monthEl) monthEl.value=jy+'/'+gpPad2(jm);
  const days=typeof whMonthDays==='function'?whMonthDays(jy,jm):31;
  const wid=GP_WHOLESALE_WAREHOUSE_ID;
  window.WAREHOUSE_LEDGER_ID=wid;
  if(typeof WAREHOUSE_SELECTED!=='undefined') WAREHOUSE_SELECTED=wid;
  const rows=gpWarehouseLedgerRows(d,wid);
  const activation=String(d.activated_at||'');
  const now=new Date();
  const tj=typeof g2j==='function'?g2j(now.getFullYear(),now.getMonth()+1,now.getDate()):null;
  const today=tj?tj[0]+'/'+gpPad2(tj[1])+'/'+gpPad2(tj[2]):'';
  const head='<tr><th class="model-cell">مدل دستگاه</th>'+Array.from({length:days},(_,i)=>'<th>'+gpPad2(i+1)+'</th>').join('')+'</tr>';
  const body=rows.map(({product,keys})=>{
    const cells=[];
    for(let day=1;day<=days;day++){
      const iso=typeof whIsoDate==='function'?whIsoDate(jy,jm,day):'';
      const jdate=jy+'/'+gpPad2(jm)+'/'+gpPad2(day);
      const before=activation && iso && iso<activation.slice(0,10);
      const future=today && jdate>today;
      let val=null;
      if(!before && !future){
        val=(jdate===today)?gpWarehouseCurrentQtyKeys(d,wid,keys):gpWarehouseStockOnJalaliDayKeys(d,wid,keys,jdate,today);
      }
      cells.push('<td class="'+(before?'before-activation ':'')+(future?'future-cell ':'')+(jdate===today?'today-cell ':'')+(val===0?'zero':'')+'">'+(val===null?'—':Number(val).toLocaleString('fa-IR'))+'</td>');
    }
    return '<tr><td class="model-cell">'+(typeof esc==='function'?esc(product):String(product))+'</td>'+cells.join('')+'</tr>';
  }).join('');
  wrap.innerHTML='<table class="warehouse-ledger-table"><thead>'+head+'</thead><tbody>'+body+'</tbody></table>';
}
function gpCartonInventorySerials(c){
  if(!c) return [];
  const inv=(typeof WH!=='undefined'&&WH&&Array.isArray(WH.inventory))?WH.inventory:[];
  const cid=Number(c.id||0);
  const code=String(c.code||'').trim().toUpperCase();
  const fromInv=inv.filter(iv=>{
    const sn=String(iv.serial||'').trim();
    if(!sn) return false;
    if(cid>0 && Number(iv.carton_id||0)===cid) return true;
    return code && String(iv.carton_code||'').trim().toUpperCase()===code;
  }).map(iv=>String(iv.serial||'').trim()).filter(Boolean);
  const fromCarton=Array.isArray(c.serials)?c.serials.map(s=>String(s||'').trim()).filter(Boolean):[];
  const seen=new Set(), out=[];
  fromCarton.concat(fromInv).forEach(sn=>{
    const key=sn.toUpperCase();
    if(seen.has(key)) return;
    seen.add(key);
    out.push(sn);
  });
  return out;
}
function gpHydrateCartonSerialsFromInventory(){
  if(typeof WH==='undefined'||!WH||!Array.isArray(WH.cartons)) return;
  WH.cartons.forEach(c=>{ c.serials=gpCartonInventorySerials(c); });
}
function gpOpenWarehouseSerialsFromInventory(id){
  if(typeof WH==='undefined'||!WH) return;
  const c=(WH.cartons||[]).find(x=>Number(x.id)===Number(id));
  if(!c) return;
  const inv=WH.inventory||[];
  const serials=gpCartonInventorySerials(c);
  c.serials=serials;
  if(typeof modal!=='function') return;
  const body=serials.map(s=>{
    const iv=inv.find(x=>(Number(x.carton_id||0)===Number(c.id)||String(x.carton_code||'').toUpperCase()===String(c.code||'').toUpperCase())&&String(x.serial||'').toUpperCase()===String(s).toUpperCase());
    const free=iv&&!iv.order_id;
    const escFn=typeof esc==='function'?esc:(v=>String(v||''));
    return '<div class="inv-serial-row" style="grid-template-columns:1fr auto"><b class="code">'+escFn(s)+'</b>'+(free?'<button class="danger" onclick="deleteWarehouseSerial('+c.id+',\''+escFn(s)+'\')">حذف</button>':'<span class="badge st-sent">تخصیص‌یافته</span>')+'</div>';
  }).join('');
  modal('<h3>مدیریت سریال‌های باکس <span class="code">'+(typeof esc==='function'?esc(c.code):String(c.code||''))+'</span></h3><p class="small">فقط سریال‌های آزاد قابل حذف هستند.</p><div style="max-height:55vh;overflow:auto">'+(body||'<div class="small">برای این باکس سریالی در inventory ثبت نشده است.</div>')+'</div><button class="btnlight" onclick="closeModal()" style="margin-top:10px">بستن</button>');
}
function installWholesaleOnlyLedgerUI(){
  const btn2=document.getElementById('warehouseBtn2');
  if(btn2) btn2.style.display='none';
  const btn1=document.getElementById('warehouseBtn1');
  if(btn1) btn1.classList.add('active');
  window.WAREHOUSE_LEDGER_ID=GP_WHOLESALE_WAREHOUSE_ID;
  if(typeof WAREHOUSE_SELECTED!=='undefined') window.WAREHOUSE_SELECTED=GP_WHOLESALE_WAREHOUSE_ID;
  if(typeof selectWarehouseLedger==='function' && !selectWarehouseLedger.__gpWholesaleOnly){
    const base=selectWarehouseLedger;
    const wrapped=function(id){
      if(Number(id)!==GP_WHOLESALE_WAREHOUSE_ID) return;
      return base.apply(this,arguments);
    };
    wrapped.__gpWholesaleOnly=true;
    selectWarehouseLedger=wrapped;
  }
  if(typeof loadWarehouseLedger==='function' && !loadWarehouseLedger.__gpWholesaleOnly){
    const base=loadWarehouseLedger;
    const wrapped=async function(){
      window.WAREHOUSE_LEDGER_ID=GP_WHOLESALE_WAREHOUSE_ID;
      if(typeof WAREHOUSE_SELECTED!=='undefined') window.WAREHOUSE_SELECTED=GP_WHOLESALE_WAREHOUSE_ID;
      return base.apply(this,arguments);
    };
    wrapped.__gpWholesaleOnly=true;
    loadWarehouseLedger=wrapped;
  }
}
function wrapWarehouseRender(){
  if(typeof renderWarehouse==='function' && !renderWarehouse.__gpHydrateSerials){
    const base=renderWarehouse;
    const wrapped=function(){
      try{gpHydrateCartonSerialsFromInventory()}catch(e){}
      return base.apply(this,arguments);
    };
    wrapped.__gpHydrateSerials=true;
    renderWarehouse=wrapped;
  }
  if(typeof renderWarehouseLedger==='function' && !renderWarehouseLedger.__gpCurrentGrid){
    const base=renderWarehouseLedger;
    const wrapped=function(){
      window.WAREHOUSE_STATE=window.WAREHOUSE_LEDGER_DATA||window.WAREHOUSE_STATE;
      const body=document.getElementById('warehouseMovementBody'); if(body) delete body.dataset.gpGroupedSig;
      const r=base.apply(this,arguments);
      try{gpRewriteLedgerGridToCurrent()}catch(e){}
      try{renderSeparateWarehouseLiveSummary()}catch(e){}
      try{renderDailyMovementSummary()}catch(e){}
      return r;
    };
    wrapped.__gpCurrentGrid=true;
    wrapped.__gpDailyGrouped=true;
    renderWarehouseLedger=wrapped;
  }
  if(typeof loadWarehouse==='function' && !loadWarehouse.__gpHydrateSerials){
    const base=loadWarehouse;
    const wrapped=async function(){
      const r=await base.apply(this,arguments);
      try{gpHydrateCartonSerialsFromInventory()}catch(e){}
      try{if(typeof renderWarehouse==='function') renderWarehouse()}catch(e){}
      return r;
    };
    wrapped.__gpHydrateSerials=true;
    loadWarehouse=wrapped;
  }
  if(!openWarehouseSerials || !openWarehouseSerials.__gpInvSerials){
    openWarehouseSerials=gpOpenWarehouseSerialsFromInventory;
    openWarehouseSerials.__gpInvSerials=true;
  }
}


window.GP_STOCKTAKE_WAREHOUSE=Number(window.GP_STOCKTAKE_WAREHOUSE||1);
async function loadStocktakeSeparated(){
  const body=document.getElementById('stocktakeBody'),totals=document.getElementById('stocktakeTotals');
  if(!body||!totals)return;
  try{
    const ws=await req('/api/warehouses');
    window.GP_STOCKTAKE_WAREHOUSE=GP_WHOLESALE_WAREHOUSE_ID;
    const rows=stocktakeProductRows(ws,GP_WHOLESALE_WAREHOUSE_ID);
    const totalPhysical=rows.reduce((n,r)=>n+r.physical,0);
    const totalFree=rows.reduce((n,r)=>n+r.free,0);
    const totalReserved=rows.reduce((n,r)=>n+r.reserved,0);
    const totalIncoming=rows.reduce((n,r)=>n+r.incoming,0);

    totals.innerHTML=
      '<div class="gp-stocktake-summary">'+
        '<div class="mutedbox"><span class="small">انبار</span><h3>انبار عمده</h3></div>'+
        '<div class="mutedbox"><span class="small">کل ورودی (همه مدل‌ها)</span><h2>'+totalIncoming.toLocaleString('fa-IR')+'</h2></div>'+
        '<div class="mutedbox"><span class="small">موجودی فیزیکی</span><h2>'+totalPhysical.toLocaleString('fa-IR')+'</h2></div>'+
        '<div class="mutedbox"><span class="small">آزاد</span><h2>'+totalFree.toLocaleString('fa-IR')+'</h2></div>'+
        '<div class="mutedbox"><span class="small">رزرو / تخصیص</span><h2>'+totalReserved.toLocaleString('fa-IR')+'</h2></div>'+
      '</div>';

    const table=body.closest('table');
    if(table){
      const head=table.querySelector('thead tr');
      if(head)head.innerHTML='<th>کالا / مدل</th><th>ورودی ثبت‌شده</th><th>خروج / انتقال</th><th>موجودی فیزیکی</th><th>آزاد</th><th>رزرو / تخصیص</th><th>تراز</th>';
    }
    body.innerHTML=rows.map(r=>'<tr>'+
      '<td><b>'+esc(r.product)+'</b></td>'+
      '<td>'+r.incoming.toLocaleString('fa-IR')+'</td>'+
      '<td>'+r.outgoing.toLocaleString('fa-IR')+'</td>'+
      '<td><b>'+r.physical.toLocaleString('fa-IR')+'</b></td>'+
      '<td>'+r.free.toLocaleString('fa-IR')+'</td>'+
      '<td>'+r.reserved.toLocaleString('fa-IR')+'</td>'+
      '<td><span class="badge '+(r.balance_ok?'st-ready':'st-cancel')+'">'+(r.balance_ok?'صحیح':'مغایرت')+'</span></td>'+
      '</tr>').join('')||'<tr><td colspan="7">هنوز مدلی تعریف نشده است.</td></tr>';

    const card=body.closest('.card');
    if(card){
      const sub=card.querySelector('.section-title .small');
      if(sub)sub.textContent='گزارش انبارگردانی فقط انبار عمده؛ همه مدل‌های سریال‌دار (حتی صفر) در جدول هستند.';
      const exportBtn=[...card.querySelectorAll('button')].find(b=>/خروجی Excel انبارگردانی/.test(b.textContent||''));
      if(exportBtn)exportBtn.style.display='none';
    }
  }catch(e){
    body.innerHTML='<tr><td colspan="6">'+esc(e.message||'خطا در دریافت موجودی انبار')+'</td></tr>';
  }
}

function installSeparatedStocktake(){
  if(typeof loadStocktake==='function' && !loadStocktake.__gpSeparated){
    const wrapped=function(){return loadStocktakeSeparated();};
    wrapped.__gpSeparated=true;
    loadStocktake=wrapped;
  }
  window.loadStocktakeSeparated=loadStocktakeSeparated;
}

function normalizeUI(){
  fixWarehouseAndPriceMenuLabels();
  mergeCustomerSerialCards();
  installJDateFix();
  installWarehouseLedgerCurrentAnchor();
  installWholesaleOnlyLedgerUI();
  wrapWarehouseRender();
  installSeparateStocktake();
  emphasizeForceOrders();
  installSeparatedStocktake();
  try{ if(document.getElementById('reports') && !document.getElementById('reports').classList.contains('hidden')) loadStocktakeSeparated(); }catch(e){}
  try{ if(document.getElementById('warehouseDaily') && !document.getElementById('warehouseDaily').classList.contains('hidden')){renderSeparateWarehouseLiveSummary();renderDailyMovementSummary();} }catch(e){}
}

const css=document.createElement('style');
css.textContent=
  '.jdate-pop{z-index:1000000!important}.jdate-wrap{overflow:visible!important}.report-grid,.card{overflow:visible}'+
  '#warehouseDaily .warehouse-ledger-bottom{display:none!important}'+
  '.gp-serial-merge-divider{height:1px;background:#e4eaf1;margin:14px 0}'+
  '#inventory>.card{overflow:visible}.gp-move-products{display:flex;flex-wrap:wrap;gap:4px 7px;margin-top:4px}.gp-move-products span{display:inline-block;background:#f4f7fb;border:1px solid #e1e8f0;border-radius:7px;padding:3px 6px;font-size:11px}.warehouse-movement-table{min-width:900px}.warehouse-movement-table td{vertical-align:top}'+
  '/* gp-warehouse-summary-compact */#warehouseLedgerSummary{display:grid!important;grid-template-columns:repeat(4,minmax(140px,1fr))!important;gap:6px!important;margin:6px 0!important}#warehouseBtn2{display:none!important}.warehouse-ledger-table td.future-cell{color:#94a3b8;background:#f8fafc}#warehouseLedgerSummary>.card{margin:0!important;padding:8px 11px!important;min-height:0!important;border-radius:12px!important}#warehouseLedgerSummary>.card>.small,#warehouseLedgerSummary>.card .small{margin:0!important;line-height:1.3!important}#warehouseLedgerSummary>.card>b{margin:1px 0!important;line-height:1.25!important}.gp-wh-live-card{padding:8px 10px!important;border:1px solid #dce5ee!important}.gp-wh-live-card.active{border-color:#f58220!important;box-shadow:0 0 0 2px #f5822026!important}.gp-wh-live-head{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:5px}.gp-wh-live-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.gp-wh-live-stats>div{background:#f7f9fc;border:1px solid #e5ebf2;border-radius:8px;padding:5px 6px;text-align:center}.gp-wh-live-stats span{display:block;font-size:10.5px;color:#64748b;margin-bottom:2px;line-height:1.25}.gp-wh-live-stats strong{font-size:16px;line-height:1.15;color:#102a43}'+
  '#otbody tr.gp-force-order td{border-top:2px solid #ef233c!important;border-bottom:2px solid #ef233c!important;animation:gpForceGlow 1.35s linear infinite;background-clip:padding-box}#otbody tr.gp-force-order td:first-child{border-right:2px solid #ef233c!important;border-radius:0 10px 10px 0}#otbody tr.gp-force-order td:last-child{border-left:2px solid #ef233c!important;border-radius:10px 0 0 10px}#otbody tr.gp-force-order .order-no:after{content:"فورس";display:inline-block;margin-right:6px;padding:2px 6px;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:10px;font-weight:900;vertical-align:middle}@keyframes gpForceGlow{0%{box-shadow:inset 0 2px 0 #ef233c,inset 0 -2px 0 #ff758f,0 0 0 rgba(239,35,60,0)}25%{box-shadow:inset 0 2px 0 #ff758f,inset 0 -2px 0 #ef233c,0 0 8px rgba(239,35,60,.28)}50%{box-shadow:inset 0 2px 0 #ef233c,inset 0 -2px 0 #ffb3c1,0 0 13px rgba(239,35,60,.38)}75%{box-shadow:inset 0 2px 0 #ffb3c1,inset 0 -2px 0 #ef233c,0 0 8px rgba(239,35,60,.28)}100%{box-shadow:inset 0 2px 0 #ef233c,inset 0 -2px 0 #ff758f,0 0 0 rgba(239,35,60,0)}}'+
  '.gp-stocktake-wh{padding:12px!important}.gp-stocktake-wh-stats{display:flex;gap:8px;flex-wrap:wrap;margin-top:7px}.gp-stocktake-wh-stats span{background:#f7f9fc;border:1px solid #e5ebf2;border-radius:8px;padding:6px 9px}.gp-stocktake-wh-stats strong{margin-right:4px;color:#102a43}'+
  '.gp-stocktake-switch{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.gp-stocktake-switch button{border:1px solid #cfd9e5;background:#f7f9fc;color:#102a43;border-radius:9px;padding:9px 14px;font-family:Tahoma;font-weight:800;cursor:pointer}.gp-stocktake-switch button.active{background:#f58220;color:#fff;border-color:#f58220}.gp-stocktake-summary{display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:8px;width:100%}'+
  '@media(max-width:720px){#warehouseLedgerSummary{grid-template-columns:1fr!important}.gp-wh-live-stats{grid-template-columns:repeat(3,1fr)}.gp-stocktake-summary{grid-template-columns:1fr 1fr}}';
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
