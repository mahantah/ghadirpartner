'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const directory = process.argv[2];
const assets = path.join(directory, 'assets');
const tableSource = fs.readFileSync(path.join(assets, 'warehouse-v53438.js'), 'utf8');
const refineSource = fs.readFileSync(path.join(assets, 'warehouse-ui-refine-v53438.js'), 'utf8');
const slots = { warehouseBody: {}, shelfSummary: {} };
const warehouse = {
  connected: true,
  cartons: [
    { id: 1, code: 'S680-035', product: 'S680', capacity: 20, warehouse_id: 1, serials: [] },
    { id: 2, code: 'MIXED', product: 'S680', capacity: 5, warehouse_id: 2, serials: [] },
    { id: 3, code: 'UNKNOWN', product: 'S680', capacity: 10, warehouse_id: 1, serials: [] },
  ],
  carton_stats: [
    { id: '1', total: 20, free: '20', levels: [] },
    { id: 2, total: 5, free: 1, reserved: 2, out: 2, levels: [2] },
  ],
  shelves: { 2: { n: 1, by: { S680: 1 } } },
};
const context = vm.createContext({
  window: {}, WH: warehouse, $: (id) => slots[id], esc: String,
});
vm.runInContext(
  tableSource.slice(tableSource.indexOf('function whName('), tableSource.indexOf('function whMovementLabel(')) +
  tableSource.slice(tableSource.indexOf('function whCompactCount('), tableSource.indexOf('window.saveWarehouseCarton=')),
  context,
);
vm.runInContext(
  refineSource.slice(refineSource.indexOf('function gpHydrateCartonSerialsFromInventory('),
    refineSource.indexOf('/** Keep selection scoped')),
  context,
);
const render = context.window.renderWarehouse;
render();
const original = slots.warehouseBody.innerHTML;
assert.match(original, /S680-035[\s\S]*۲۰\/20<\/td><td><b>۲۰<\/b><\/td><td>۰<\/td><td>۰<\/td>/);
assert.match(original, /MIXED[\s\S]*۵\/5<\/td><td><b>۱<\/b><\/td><td>۲<\/td><td>۲<\/td>/);
assert.match(original, /UNKNOWN[\s\S]*—\/10<\/td><td><b>—<\/b><\/td>/);
assert.match(slots.shelfSummary.innerHTML, /۱ دستگاه خُرد/);

warehouse.inventory = [{ carton_id: 2, serial: 'ONE-OPEN-CARTON' }];
context.gpHydrateCartonSerialsFromInventory();
assert.deepEqual(warehouse.cartons.map((carton) => carton.serials), [[], [], []]);
render();
assert.equal(slots.warehouseBody.innerHTML, original);

delete warehouse.carton_stats;
warehouse.inventory = [{ carton_id: 1, serial: 'LEGACY-1', order_id: 0, warehouse_id: 1 }];
context.gpHydrateCartonSerialsFromInventory();
render();
assert.match(slots.warehouseBody.innerHTML, /S680-035[\s\S]*۱\/20<\/td><td><b>۱<\/b>/);
console.log('Warehouse summary, partial detail, missing stats and legacy inventory passed');
