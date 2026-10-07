(function(){
'use strict';
if(window.__GP_BUGFIX_5349__)return;
window.__GP_BUGFIX_5349__=true;

function openNewOrder(ev){
  if(ev){ev.preventDefault();ev.stopPropagation();}
  if(typeof window.show==='function')window.show('neworder');
  else if(typeof show==='function')show('neworder');
  setTimeout(()=>{
    try{
      if(typeof renderCustOptions==='function')renderCustOptions();
      document.getElementById('csearch')?.focus();
      document.getElementById('neworder')?.scrollIntoView({block:'start'});
    }catch(_){}
  },20);
}
window.openNewOrderFromDashboard=openNewOrder;

function bindDashboardButton(){
  const b=document.getElementById('dashNewOrder');
  if(!b||b.dataset.gpBound5349)return;
  b.dataset.gpBound5349='1';
  b.onclick=openNewOrder;
  b.addEventListener('click',openNewOrder,true);
}

function bindWarehouseMenu(){
  const group=document.getElementById('warehouseNavGroup');
  const toggle=group?.querySelector('.nav-group-toggle');
  if(!group||!toggle||toggle.dataset.gpBound5349)return;
  toggle.dataset.gpBound5349='1';
  toggle.onclick=function(ev){
    ev.preventDefault();
    ev.stopPropagation();
    group.classList.toggle('open');
    toggle.setAttribute('aria-expanded',String(group.classList.contains('open')));
  };
  group.querySelectorAll('.nav-submenu [data-tab]').forEach(b=>{
    b.addEventListener('click',()=>group.classList.remove('open'));
  });
}

function bindCartonSearch(){
  const input=document.getElementById('gpWhSearch');
  const body=document.getElementById('warehouseBody');
  if(!input||!body||input.dataset.gpScan5349)return;
  input.dataset.gpScan5349='1';
  input.placeholder='اسکن بارکد کارتن، شماره باکس، مدل یا جستجو…';
  input.addEventListener('input',()=>{
    const q=input.value.trim().toUpperCase();
    body.querySelectorAll('tr').forEach(r=>r.classList.remove('gp-scan-hit'));
    if(!q)return;
    const rows=[...body.querySelectorAll('tr')];
    const hit=rows.find(r=>{
      const code=(r.cells?.[0]?.textContent||'').trim().toUpperCase();
      return code===q;
    });
    if(hit){
      hit.hidden=false;
      hit.classList.add('gp-scan-hit');
      hit.scrollIntoView({block:'center',behavior:'smooth'});
    }
  });
}

function openOrderFromQr(){
  const u=new URL(location.href);
  const id=Number(u.searchParams.get('open_order')||0);
  if(!id||!window.ME||!Array.isArray(window.ORD))return;
  if(window.__GP_OPENED_ORDER_5349__===id)return;
  const o=window.ORD.find(x=>Number(x.id)===id);
  if(!o)return;
  window.__GP_OPENED_ORDER_5349__=id;
  if(typeof window.show==='function')window.show('orders');
  if(typeof window.openOrderDetails==='function')setTimeout(()=>window.openOrderDetails(id),80);
}

document.addEventListener('click',ev=>{
  if(ev.target?.closest?.('#dashNewOrder'))openNewOrder(ev);
},true);

const obs=new MutationObserver(()=>{
  bindDashboardButton();
  bindWarehouseMenu();
  bindCartonSearch();
  openOrderFromQr();
});
obs.observe(document.documentElement,{subtree:true,childList:true,attributes:false});

window.addEventListener('load',()=>{
  bindDashboardButton();
  bindWarehouseMenu();
  bindCartonSearch();
  setTimeout(openOrderFromQr,500);
});
setTimeout(()=>{bindDashboardButton();bindWarehouseMenu();bindCartonSearch();openOrderFromQr();},250);
})();