#!/usr/bin/env python3
from pathlib import Path
import sys

root=Path(sys.argv[1] if len(sys.argv)>1 else ".")
app=root/"app.html"
MARK="WAREHOUSE_SUPPLIER_DOM_V4_20261013"

if not app.exists():
    raise SystemExit("app.html not found")

a=app.read_text(encoding="utf-8")
if MARK in a:
    print("supplier DOM v4 already applied")
    raise SystemExit(0)

payload = r'''
<script>
/* WAREHOUSE_SUPPLIER_DOM_V4_20261013 */
(function(){
  let gpSupplierState=null, gpSupplierLoading=null, gpSupplierTimer=0;

  function gpText(v){ return String(v==null?'':v).trim(); }

  async function gpLoadSupplierState(){
    if(gpSupplierState) return gpSupplierState;
    if(gpSupplierLoading) return gpSupplierLoading;
    gpSupplierLoading=(async()=>{
      try{
        const w=typeof req==='function' ? await req('/api/warehouse') : null;
        if(!w) return null;
        const byCartonId=new Map(), byCartonCode=new Map(), bySerial=new Map();
        (w.cartons||[]).forEach(c=>{
          const supplier=gpText(c.supplier);
          if(!supplier) return;
          if(+c.id) byCartonId.set(+c.id,supplier);
          if(gpText(c.code)) byCartonCode.set(gpText(c.code).toUpperCase(),supplier);
        });
        (w.inventory||[]).forEach(iv=>{
          const sn=gpText(iv.serial).toUpperCase();
          if(!sn) return;
          let supplier=gpText(iv.supplier);
          if(!supplier && +iv.carton_id) supplier=byCartonId.get(+iv.carton_id)||'';
          if(!supplier && gpText(iv.carton_code)) supplier=byCartonCode.get(gpText(iv.carton_code).toUpperCase())||'';
          if(supplier) bySerial.set(sn,supplier);
        });
        gpSupplierState={warehouse:w,byCartonId,byCartonCode,bySerial};
        return gpSupplierState;
      }catch(e){ return null; }
      finally{ gpSupplierLoading=null; }
    })();
    return gpSupplierLoading;
  }

  function gpSupplierCell(supplier){
    const td=document.createElement('td');
    td.className='gp-supplier-cell';
    td.innerHTML=supplier?'<b>'+esc(supplier)+'</b>':'<span class="small">-</span>';
    return td;
  }

  function gpDecorateWarehouse(state){
    const body=document.getElementById('warehouseBody');
    if(!body || !state) return;
    const table=body.closest('table');
    const hr=table?.querySelector('thead tr');
    if(hr && !hr.querySelector('.gp-supplier-head')){
      const ths=[...hr.children];
      const modelIndex=ths.findIndex(th=>/مدل/.test(th.textContent||''));
      if(modelIndex>=0){
        const th=document.createElement('th');
        th.className='gp-supplier-head';
        th.textContent='تامین‌کننده';
        ths[modelIndex].after(th);
      }
    }
    [...body.querySelectorAll('tr')].forEach(tr=>{
      const cells=[...tr.children];
      if(!cells.length || tr.querySelector('.gp-supplier-cell')) return;
      const code=gpText(cells[0]?.textContent).toUpperCase();
      if(!code) return;
      const carton=(state.warehouse.cartons||[]).find(c=>gpText(c.code).toUpperCase()===code);
      const supplier=carton?gpText(carton.supplier):'';
      const modelIndex=1;
      if(cells[modelIndex]){
        [...cells[modelIndex].querySelectorAll('.small')].forEach(x=>{
          if(/تامین.?کننده/.test(x.textContent||'')) x.remove();
        });
        cells[modelIndex].after(gpSupplierCell(supplier));
      }
    });
  }

  function gpSerialFromRow(row){
    const code=row.querySelector('.inv-code');
    const t=gpText(code?code.textContent:row.textContent);
    let m=t.match(/SN\s*:\s*([A-Z0-9_-]+)/i);
    if(m) return m[1].toUpperCase();
    m=t.match(/\b([A-Z][A-Z0-9]{7,})\b/i);
    return m?m[1].toUpperCase():'';
  }

  function gpDecorateCustomerSerials(state){
    const root=document.getElementById('inventoryGroups');
    if(!root || !state) return;
    [...root.querySelectorAll('.inv-serial-row')].forEach(row=>{
      const serial=gpSerialFromRow(row);
      const supplier=serial?(state.bySerial.get(serial)||''):'';
      const product=row.querySelector('.inv-product')||row.firstElementChild;
      if(!product) return;
      let badge=product.querySelector('.gp-inv-supplier');
      if(!badge){
        [...product.querySelectorAll('.small')].forEach(x=>{
          if(/تامین.?کننده/.test(x.textContent||'')) x.remove();
        });
        badge=document.createElement('div');
        badge.className='gp-inv-supplier';
        badge.style.marginTop='5px';
        product.appendChild(badge);
      }
      badge.innerHTML='<span class="badge">تامین‌کننده: <b>'+esc(supplier||'-')+'</b></span>';
    });
  }

  async function gpRefreshSupplierDisplay(){
    const state=await gpLoadSupplierState();
    if(!state) return;
    gpDecorateWarehouse(state);
    gpDecorateCustomerSerials(state);
  }

  function gpScheduleSupplierDisplay(){
    clearTimeout(gpSupplierTimer);
    gpSupplierTimer=setTimeout(gpRefreshSupplierDisplay,80);
  }

  const obs=new MutationObserver(gpScheduleSupplierDisplay);
  obs.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',gpScheduleSupplierDisplay,true);
  document.addEventListener('input',e=>{
    if(e.target && (e.target.id==='invSearch'||e.target.id==='whCartonSearch')) gpScheduleSupplierDisplay();
  },true);
  setTimeout(gpScheduleSupplierDisplay,700);
})();
</script>
'''

pos=a.lower().rfind('</body>')
if pos<0:
    raise SystemExit("</body> not found")
a=a[:pos]+payload+a[pos:]
app.write_text(a,encoding="utf-8")
print("supplier DOM v4 patch applied")
