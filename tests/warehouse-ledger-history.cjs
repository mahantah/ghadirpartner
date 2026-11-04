'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = {
  window: {},
  // Old browser-local snapshots must never override the repaired server history.
  localStorage: { getItem() { throw new Error('browser-local history read'); }, setItem() { throw new Error('browser-local history write'); } },
  setTimeout() { return 0; },
};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../assets/warehouse-ledger-eod-freeze-v1.js'), 'utf8'), context);
const stock = context.window.gpLedgerStockOnJalaliDay;
const original = {current: {1: {I90: 100}}, movements: []};
const external = {current: {1: {I90: 105}}, movements: [{product: 'I90', qty: 5, from_warehouse_id: 0, to_warehouse_id: 1, jdate: '1405/08/13'}]};
for (const day of ['1405/08/01', '1405/08/07', '1405/08/12']) {
  assert.equal(stock(original, 1, 'I90', day, '1405/08/13'), 100);
  assert.equal(stock(external, 1, 'I90', day, '1405/08/13'), 100);
}
assert.equal(stock(external, 1, 'I90', '1405/08/13', '1405/08/13'), 105);
const exited = {current: {1: {I90: 100}}, movements: external.movements.concat({product: 'I90', qty: 5, from_warehouse_id: 1, to_warehouse_id: 0, jdate: '1405/08/14'})};
assert.equal(stock(exited, 1, 'I90', '1405/08/12', '1405/08/14'), 100);
assert.equal(stock(exited, 1, 'I90', '1405/08/13', '1405/08/14'), 105);
assert.equal(stock(exited, 1, 'I90', '1405/08/14', '1405/08/14'), 100);
console.log('PASS: external receipts and later exits preserve previous days; repaired history ignores local browser snapshots');
