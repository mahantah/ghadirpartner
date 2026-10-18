'use strict';
const fs=require('fs');
const src=fs.readFileSync(require('path').join(__dirname,'..','assets','warehouse-ui-refine-v53438.js'),'utf8');
if(!src.includes('GP_LEDGER_CURRENT_ANCHOR_V2_20261017')) throw new Error('V2 ledger anchor missing');
if(!src.includes('gpRewriteLedgerGridToCurrent')) throw new Error('grid rewrite missing');
if(!src.includes('gpHydrateCartonSerialsFromInventory')) throw new Error('serial hydrate missing');
if(!src.includes('GP_WAREHOUSE_SERIALS_FROM_INVENTORY_V3_20261018')) throw new Error('inventory-backed serial modal missing');
if(!src.includes('GP_WHOLESALE_LEDGER_REPORTS_V4_20261018')) throw new Error('wholesale-only ledger reports missing');
if(src.includes('جمع هر دو انبار')) throw new Error('combined warehouse totals must not be shown');
if(!src.includes('future-cell')) throw new Error('future ledger days must stay blank');
if(!src.includes('gpCartonInventorySerials')) throw new Error('carton inventory serial helper missing');
if(!src.includes('GP_I90_LEDGER_FAMILY_V5_20261018')) throw new Error('I90 ledger family merge missing');

function gpWarehouseCurrentQty(state,wid,product){
  const current=state?.current?.[wid]||state?.current?.[String(wid)]||{};
  return Number(current?.[product]||0);
}
function gpWarehouseMovementDelta(m,wid){
  let d=0;
  if(Number(m?.to_warehouse_id)===Number(wid)) d+=Number(m?.qty)||0;
  if(Number(m?.from_warehouse_id)===Number(wid)) d-=Number(m?.qty)||0;
  return d;
}
function gpWarehouseStockOnJalaliDay(state,wid,product,jday,today){
  let q=gpWarehouseCurrentQty(state,wid,product);
  for(const m of (state.movements||[])){
    if(String(m?.product||'')!==String(product||'')) continue;
    const md=String(m.jdate||'');
    if(md && today && md>jday && md<=today) q-=gpWarehouseMovementDelta(m,wid);
  }
  return q;
}

const state={
  current:{1:{'I90':20,'TRENDIT- T3 2G':0}},
  movements:[
    {product:'TRENDIT- T3 2G',from_warehouse_id:1,to_warehouse_id:0,qty:1059,jdate:'1405/07/10'},
    {product:'I90',from_warehouse_id:1,to_warehouse_id:0,qty:5,jdate:'1405/07/26'}
  ]
};
const today='1405/07/28';
if(gpWarehouseStockOnJalaliDay(state,1,'TRENDIT- T3 2G','1405/07/28',today)!==0)
  throw new Error('ghost outflow must not stay negative on today');
if(gpWarehouseStockOnJalaliDay(state,1,'TRENDIT- T3 2G','1405/07/09',today)!==1059)
  throw new Error('day before ghost sale should reconstruct historical qty');
if(gpWarehouseStockOnJalaliDay(state,1,'I90','1405/07/28',today)!==20)
  throw new Error('today must equal physical current');
if(gpWarehouseStockOnJalaliDay(state,1,'I90','1405/07/25',today)!==25)
  throw new Error('day before I90 sale should be current+later outflow');
if(gpWarehouseStockOnJalaliDay(state,1,'I90','1405/07/29',today)!==20)
  throw new Error('future day should still reconstruct from current anchor');

function gpWarehouseLedgerFamilyKey(name){
  const n=String(name||'').trim();
  if(/\bI90\b/i.test(n)) return 'FAMILY:I90';
  return 'SKU:'+n;
}
function gpWarehouseCurrentQtyKeys(state,wid,keys){
  return keys.reduce((n,k)=>n+(Number((state.current?.[wid]||{})[k])||0),0);
}
const split={current:{1:{'دستگاه کارتخوان I90':1378,I90:227}},products:[{name:'دستگاه کارتخوان I90'},{name:'Z-990'}],movements:[],baseline:[]};
const famRows=(()=>{
  const catalog=split.products.map(p=>p.name);
  const fam=new Map();
  catalog.forEach(name=>{
    const fk=gpWarehouseLedgerFamilyKey(name);
    if(!fam.has(fk)) fam.set(fk,{label:name,keys:new Set(),catalog:true});
    fam.get(fk).keys.add(name);
  });
  Object.keys(split.current[1]).forEach(k=>{
    const fk=gpWarehouseLedgerFamilyKey(k);
    if(!fam.has(fk)) fam.set(fk,{label:k,keys:new Set(),catalog:false});
    fam.get(fk).keys.add(k);
  });
  return [...fam.values()].filter(r=>[...r.keys].some(k=>(split.current[1][k]||0)>0));
})();
const i90=famRows.find(r=>r.label.includes('I90'));
if(!i90||gpWarehouseCurrentQtyKeys(split,1,[...i90.keys])!==1605) throw new Error('split I90 product names must sum in one ledger row');
if(famRows.some(r=>r.label==='Z-990')) throw new Error('zero-stock catalog models must not appear in ledger rows');

function hydrate(cartons,inventory){
  const byId=new Map();
  const byCode=new Map();
  inventory.forEach(iv=>{
    const cid=Number(iv.carton_id||0),code=String(iv.carton_code||'').trim().toUpperCase(),sn=String(iv.serial||'').trim();
    if(!sn)return;
    if(cid>0){if(!byId.has(cid))byId.set(cid,[]);byId.get(cid).push(sn);}
    if(code){if(!byCode.has(code))byCode.set(code,[]);byCode.get(code).push(sn);}
  });
  cartons.forEach(c=>{
    const have=Array.isArray(c.serials)?c.serials.slice():[];
    const fromId=byId.get(Number(c.id))||[];
    const fromCode=byCode.get(String(c.code||'').trim().toUpperCase())||[];
    const fromInv=fromId.length?fromId:fromCode;
    if(fromInv.length>have.length){
      const seen=new Set(have.map(s=>s.toUpperCase()));
      fromInv.forEach(sn=>{if(!seen.has(sn.toUpperCase())){have.push(sn);seen.add(sn.toUpperCase());}});
      c.serials=have;
    }
  });
  return cartons;
}
const byIdCartons=hydrate([{id:97,code:'I90-097',serials:[]}],[{carton_id:97,serial:'SN1'},{carton_id:97,serial:'SN2'},{carton_id:8,serial:'OTHER'}]);
if(byIdCartons[0].serials.join(',')!=='SN1,SN2') throw new Error('carton serials must hydrate from inventory');
const byCodeCartons=hydrate([{id:97,code:'I90-097',serials:[]}],[{carton_code:'I90-097',serial:'SN3'},{carton_code:'I90-097',serial:'SN4'}]);
if(byCodeCartons[0].serials.join(',')!=='SN3,SN4') throw new Error('carton serials must hydrate from carton_code');
if(!src.includes('renderWarehouse.__gpHydrateSerials') && !src.includes('!renderWarehouse.__gpHydrateSerials'))
  throw new Error('renderWarehouse hydrate wrap missing');
console.log('warehouse ledger anchor and serial hydrate OK');

/* Real inventory records, not stale carton.serials, are the single source for carton display. */
{
  const vm=require('vm');
  const start=src.indexOf('function gpCartonInventorySerials(c){');
  const end=src.indexOf('function gpHydrateCartonSerialsFromInventory(){',start);
  if(start<0||end<0) throw new Error('carton serial helper absent');
  const sandbox={WH:{inventory:[
    {carton_id:7,carton_code:'I90-097',serial:'I90-REAL-A'},
    {carton_id:7,carton_code:'I90-097',serial:'i90-real-a'},
    {carton_id:8,carton_code:'I90-098',serial:'I90-OTHER'}
  ]}};
  vm.runInNewContext(src.slice(start,end)+'\nthis.getCarton=gpCartonInventorySerials;',sandbox);
  const rows=sandbox.getCarton({id:7,code:'I90-097',serials:['I90-STALE']});
  if(rows.length!==1||rows[0]!=='I90-REAL-A') throw new Error('stale carton.serials inflated serial list');
}
if(!src.includes('balance_ok:physical===fr+rs')) throw new Error('stock balance must verify physical vs free+reserved');
