'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('assets/warehouse-vault-perf-v1.js', 'utf8');
(async () => {
  let calls = 0;
  let fail = false;
  const sandbox = { document: {getElementById: () => null}, Date,
    requestAnimationFrame: fn => fn(), renderWarehouse: () => {} };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext('let WH = {cartons:[]};', sandbox);
  sandbox.loadWarehouse = async () => {
    calls++;
    if (fail) return; // Existing loader consumes errors instead of rejecting.
    vm.runInContext('WH = {cartons:[]};', sandbox);
  };
  vm.runInContext(source, sandbox);
  await Promise.all([sandbox.loadWarehouse(), sandbox.loadWarehouse()]);
  assert.equal(calls, 1, 'Concurrent opens share one request');
  await sandbox.loadWarehouse();
  assert.equal(calls, 1, 'Lexical WH cache works');
  sandbox.gpClearWarehouseVaultCache(); fail = true;
  await sandbox.loadWarehouse(); await sandbox.loadWarehouse();
  assert.equal(calls, 3, 'Failed fetch must not create a fresh cache');
  console.log('Request cache invariants passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
