(function(){
'use strict';
const wh=document.getElementById('warehouse');if(!wh)return;
const cards=Array.from(wh.children).filter(n=>n.classList.contains('card'));
const entry=cards[0],printing=cards[1],list=cards[cards.length-1];
entry.classList.add('gp-wh-entry','gp-wh-panel','hidden');printing.classList.add('gp-wh-panel','hidden');list.classList.add('gp-wh-list');
const head=document.createElement('div');head.className='gp-page-head';head.innerHTML='<div><h2>مخزن انبار</h2><p class="small">کارتن‌ها، موجودی آزاد و محل نگهداری را یکجا ببینید.</p></div><span class="small">V5.3.4.8</span>';
const tools=document.createElement('div');tools.className='gp-wh-tools';tools.innerHTML='<input id="gpWhSearch" aria-label="جستجوی مخزن" placeholder="شماره باکس، مدل یا سریال…"><button id="gpWhNew" type="button">ورود کارتن جدید</button><button id="gpWhPrint" class="btnlight" type="button">چاپ لیبل‌ها</button><button id="gpWhShelf" class="btnlight" type="button">قفسه‌ها</button>';
const stockButton=document.createElement('button');stockButton.type='button';stockButton.className='btnlight';stockButton.textContent='انبارگردانی';stockButton.onclick=()=>{show('reports');document.getElementById('stocktakeBody')?.closest('.card').scrollIntoView({block:'start'});};tools.append(stockButton);
const summary=document.createElement('div');summary.className='gp-wh-summary';
wh.prepend(head,tools,summary);
const tabs=document.createElement('div');tabs.className='gp-filter-tabs';let filter='همه کارتن‌ها';
['همه کارتن‌ها','کارتن کامل','کارتن باز','خُرد در قفسه','تخصیص کامل'].forEach(name=>{let b=document.createElement('button');b.type='button';b.className='btnlight';b.textContent=name;b.onclick=()=>{filter=name;tabs.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));refresh()};tabs.append(b)});tabs.firstElementChild.classList.add('active');list.prepend(tabs);
function panel(n,b){const open=n.classList.contains('hidden');entry.classList.add('hidden');printing.classList.add('hidden');n.classList.toggle('hidden',!open);b.setAttribute('aria-expanded',String(open));if(open)n.scrollIntoView({block:'start',behavior:'smooth'});}
tools.querySelector('#gpWhNew').onclick=()=>panel(entry,tools.querySelector('#gpWhNew'));
tools.querySelector('#gpWhPrint').onclick=()=>panel(printing,tools.querySelector('#gpWhPrint'));
tools.querySelector('#gpWhShelf').onclick=()=>document.getElementById('shelfSummary').classList.toggle('hidden');
document.getElementById('shelfSummary').classList.add('hidden');
tools.querySelector('input').addEventListener('input',refresh);
function refresh(){
 if(typeof ME==='undefined'||!ME)return;
 const writable=has('prep');entry.classList.toggle('hidden',!writable||entry.classList.contains('hidden'));document.getElementById('gpWhNew').classList.toggle('hidden',!writable);
 const inv=WH.inventory||[],cartons=WH.cartons||[];
 const counts=[['دستگاه آزاد',inv.filter(x=>!x.order_id).length],['رزرو / تخصیص',inv.filter(x=>x.order_id).length],['کارتن کامل',cartons.filter(c=>{const a=inv.filter(x=>x.carton_id===c.id||x.carton_code===c.code);return a.length===Number(c.capacity)&&a.every(x=>!x.order_id&&!x.shelf_level)}).length],['خُرد در قفسه',inv.filter(x=>!x.order_id&&x.shelf_level).length]];
 summary.innerHTML=counts.map(([label,n])=>'<div class="card"><span class="small">'+label+'</span><strong>'+n.toLocaleString('fa-IR')+'</strong></div>').join('');
 const q=document.getElementById('gpWhSearch').value.trim().toLowerCase();
 Array.from(document.getElementById('warehouseBody').rows).forEach(row=>{const c=cartons.find(c=>row.cells[0]?.textContent.trim()===c.code);const serials=c?(c.serials||[]).join(' '):'';row.hidden=!!(q&&!((row.textContent+' '+serials).toLowerCase().includes(q)))||(filter!=='همه کارتن‌ها'&&row.cells[7]?.querySelector('.badge')?.textContent!==filter);if(!writable)row.querySelectorAll('button').forEach(b=>{if(/openCartonAssign|deleteWarehouseCarton/.test(b.getAttribute('onclick')||''))b.hidden=true;});});
}
const basePrice=window.renderPortalPriceEditor;if(basePrice)window.renderPortalPriceEditor=function(){basePrice.apply(this,arguments);PORTAL_CATALOG.forEach((p,i)=>{const row=document.getElementById('pcs_'+i)?.closest('tr');if(!row)return;const manufacturer=PROD.find(x=>x.name===p.name)?.manufacturer||p.manufacturer||'—';const note=document.createElement('div');note.className='small';note.textContent=manufacturer;row.cells[0].append(note);});};
const base=window.renderWarehouse;window.renderWarehouse=function(){base.apply(this,arguments);refresh();};
// Separate navigation entries retain the existing admin guard and live portal operations.
const portal=document.querySelector('.topnav [data-tab="portalAdmin"]');
if(portal){portal.textContent='کاربران قدیرپارتنر';[['catalog','لیست قیمت'],['offers','طرح‌ها و آفرها'],['sms','پیامک‌ها']].forEach(([view,label])=>{const b=document.createElement('button');b.type='button';b.dataset.tab='portalAdmin';b.className='adminOnly hidden';b.textContent=label;b.onclick=()=>{if(!canViewTab('portalAdmin'))return;window.PORTAL_ADMIN_VIEW=view;show('portalAdmin');portalAdminView(view);document.querySelectorAll('.topnav [data-tab]').forEach(x=>x.classList.toggle('active',x===b));};portal.before(b);});}
window.printWarehouseCartonLabels=function(){const ids=warehouseLabelCartons().map(c=>c.id);if(!ids.length)return alert('کارتنی برای چاپ پیدا نشد');window.open('/print/warehouse-labels?ids='+encodeURIComponent(ids.join(',')),'_blank');};
refresh();
})();
