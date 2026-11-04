'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

/** Extract the audited function without executing unrelated private application code. */
function extract(source, name, end) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Missing ${name}`);
  const finish = source.indexOf(end, start + 1);
  assert.ok(finish > start, `Missing boundary for ${name}`);
  return source.slice(start, finish);
}

/** Provide only the DOM and state accessed by the production renderer. */
function context(warehouse) {
  const elements = new Map();
  const get = (name) => {
    if (!elements.has(name)) elements.set(name, {value:'', innerHTML:''});
    return elements.get(name);
  };
  const scope = { WH:warehouse, ORD:[], $:get, esc:String, modal:()=>{} };
  vm.createContext(scope);
  return {scope, elements};
}

const [beforePath, afterPath] = process.argv.slice(2);
assert.ok(beforePath && afterPath, 'Supply original and patched private app paths');
const before = fs.readFileSync(beforePath, 'utf8');
const after = fs.readFileSync(afterPath, 'utf8');
const cartons = [{id:10,code:'BOX-A',product:'I90',capacity:3,serials:['S1','S2','S3'],supplier:'Fixture'}];
const inventory = [
  {id:1,carton_id:10,serial:'S1',product:'I90',order_id:0,shelf_level:2},
  {id:2,carton_id:10,serial:'S2',product:'I90',order_id:7,shelf_level:0},
  {id:3,carton_id:0,carton_code:'BOX-A',serial:'S3',product:'I90',order_id:0,shelf_level:3},
];
const shelves = {1:{n:0,by:{}},2:{n:1,by:{I90:1}},3:{n:1,by:{I90:1}},4:{n:0,by:{}},5:{n:0,by:{}}};
const old = context({cartons, inventory, connected:true});
const next = context({cartons, inventory:[], connected:true, shelves, carton_stats:[{id:10,total:3,free:2,levels:[2,3]}]});
vm.runInContext(extract(before,'renderWarehouse','async function saveWarehouseCarton'),old.scope);
vm.runInContext(extract(after,'renderWarehouse','async function saveWarehouseCarton'),next.scope);
old.scope.renderWarehouse(); next.scope.renderWarehouse();
for (const name of ['warehouseBody','shelfSummary']) assert.equal(next.elements.get(name).innerHTML,old.elements.get(name).innerHTML,`${name} retains counts, actions and supplier`);
assert.ok(after.includes("req('/api/warehouse/compact')"));
assert.ok(!extract(after,'renderWarehouse','async function saveWarehouseCarton').includes('WH.inventory'));

/** Run deferred requests to prove a closed modal cannot be reopened by a late reply. */
async function lazyDetailChecks() {
  let resolve;
  const elements={modal:{classList:{contains:()=>closed}},modalbody:{dataset:{}}};
  let closed=false, rendered=0, calls=0;
  const scope={WH:{},$:name=>elements[name],modal:()=>{},esc:String,encodeURIComponent,req:async()=>{calls++;return new Promise(done=>{resolve=done;});},gpOpenWarehouseSerialsLoaded:()=>{rendered++;}};
  vm.createContext(scope);
  const begin=after.indexOf('let GP_WH_DETAIL_SEQ=0;');
  const end=after.indexOf('async function deleteWarehouseSerial(',begin);
  vm.runInContext(after.slice(begin,end),scope);
  let pending=scope.openWarehouseSerials(10);
  closed=true;
  resolve({rows:[{id:1}],total:1,limit:200});
  await pending;
  assert.equal(rendered,0,'Late reply must respect closed modal');
  closed=false;
  pending=scope.openWarehouseSerials(10);
  resolve({rows:[{id:1}],total:1,limit:200});
  await pending;
  assert.equal(rendered,1);
  assert.equal(calls,2);
  assert.equal(scope.WH.inventory.length,1,'Only the opened carton is materialized');
}
lazyDetailChecks().then(()=>console.log('PASS: identical carton/shelf rendering, lazy details, late-response cancellation')).catch(error=>{console.error(error);process.exitCode=1;});
