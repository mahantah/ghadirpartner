'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const asset = fs.readFileSync(path.join(__dirname, '../assets/warehouse-ledger-eod-freeze-v1.js'), 'utf8');
const dates = {
  '2026-11-01': '1405/08/10',
  '2026-11-02': '1405/08/11',
  '2026-11-03': '1405/08/12',
};

/** Creates a browser-like isolated script fixture with no production data. */
function createFixture() {
  const memory = new Map();
  const window = {
    gpWarehouseLedgerRows: () => [{ product: 'دستگاه کارتخوان I90', keys: ['I90', 'I90 WiFi'] }],
  };
  const context = {
    window,
    Date,
    Intl,
    Number,
    String,
    Array,
    Set,
    Object,
    Map,
    document: { createElement: () => ({ setAttribute() {} }), head: { appendChild() {} } },
    localStorage: {
      getItem(key) { return memory.get(key) || null; },
      setItem(key, value) { memory.set(key, value); },
    },
    jalaliDate: value => dates[String(value).slice(0, 10)] || '',
    setTimeout() {},
  };
  vm.runInNewContext(asset, context, { filename: 'warehouse-ledger-eod-freeze-v1.js' });
  return { stockOnDay: window.gpLedgerStockOnJalaliDay, memory };
}

function createCell() {
  const classes = new Set();
  return {
    textContent: '',
    title: '',
    classes,
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
    },
  };
}

function movement(product, qty, type, date) {
  return {
    product,
    qty,
    type,
    from_warehouse_id: type === 'sale_out' ? 1 : 0,
    to_warehouse_id: type === 'receipt' ? 1 : 0,
    created_at: date,
  };
}

test('preserves an independently reconciled earlier day after a real sale exit', () => {
  const { stockOnDay } = createFixture();
  const start = {
    current: { 1: { I90: 100 } },
    baseline: [{ warehouse_id: 1, product: 'I90', qty: 100 }],
    movements: [],
  };
  assert.equal(stockOnDay(start, 1, 'I90', '1405/08/11', '1405/08/12'), 100);

  const after = {
    current: { 1: { I90: 20 } },
    baseline: start.baseline,
    movements: [movement('I90', 80, 'sale_out', '2026-11-03 17:22:58')],
  };
  assert.equal(stockOnDay(after, 1, 'I90', '1405/08/11', '1405/08/12'), 100);
  assert.equal(stockOnDay(after, 1, 'I90', '1405/08/12', '1405/08/12'), 20);
});

test('does not invent historical quantities from an unpaired 80-unit movement', () => {
  const { stockOnDay } = createFixture();
  const state = {
    current: { 1: { I90: 100 } },
    baseline: [{ warehouse_id: 1, product: 'I90', qty: 100 }],
    movements: [movement('I90', 80, 'sale_out', '2026-11-03 17:22:58')],
  };
  assert.equal(stockOnDay(state, 1, 'I90', '1405/08/11', '1405/08/12'), null);
  assert.equal(stockOnDay(state, 1, 'I90', '1405/08/12', '1405/08/12'), 100);
});

test('detects the reported 695-unit global drift without altering stock', () => {
  const { stockOnDay } = createFixture();
  const state = {
    current: { 1: { I90: 4188 } },
    baseline: [{ warehouse_id: 1, product: 'I90', qty: 417 }],
    movements: [movement('I90', 3076, 'receipt', '2026-11-03 11:00:00')],
  };
  assert.equal(stockOnDay(state, 1, 'I90', '1405/08/11', '1405/08/12'), null);
  assert.equal(stockOnDay(state, 1, 'I90', '1405/08/12', '1405/08/12'), 4188);
});

test('uses a previous browser observation only when independent history is unverified', () => {
  const { stockOnDay, memory } = createFixture();
  const state = {
    current: { 1: { I90: 100 } },
    baseline: [{ warehouse_id: 1, product: 'I90', qty: 100 }],
    movements: [movement('I90', 80, 'sale_out', '2026-11-03 17:22:58')],
  };
  memory.set('gp-ledger-eod-v1', JSON.stringify({
    '1|I90|1405/08/11': { qty: 91, at: Date.now() },
  }));
  assert.equal(stockOnDay(state, 1, 'I90', '1405/08/11', '1405/08/12'), 91);

  const reconciledState = { ...state, current: { 1: { I90: 20 } } };
  assert.equal(stockOnDay(reconciledState, 1, 'I90', '1405/08/11', '1405/08/12'), 100);
});

test('combines all I90 family model keys before testing reconciliation', () => {
  const { stockOnDay } = createFixture();
  const state = {
    current: { 1: { I90: 65, 'I90 WiFi': 35 } },
    baseline: [{ warehouse_id: 1, product: 'I90', qty: 65 }, { warehouse_id: 1, product: 'I90 WiFi', qty: 35 }],
    movements: [],
  };
  assert.equal(stockOnDay(state, 1, 'دستگاه کارتخوان I90', '1405/08/11', '1405/08/12'), 100);
});

test('does not claim a historical quantity when movement dates are unavailable', () => {
  const { stockOnDay } = createFixture();
  const state = {
    current: { 1: { I90: 9 } },
    baseline: [{ warehouse_id: 1, product: 'I90', qty: 10 }],
    movements: [movement('I90', 1, 'sale_out', 'unknown')],
  };
  assert.equal(stockOnDay(state, 1, 'I90', '1405/08/11', '1405/08/12'), null);
});

test('marks the historical grid unverified while leaving the live quantity visible', () => {
  const state = {
    current: { 1: { I90: 4188 } },
    baseline: [{ warehouse_id: 1, product: 'I90', qty: 417 }],
    movements: [movement('I90', 3076, 'receipt', '2026-11-03 11:00:00')],
  };
  const cells = Array.from({ length: 13 }, createCell);
  cells[0].textContent = 'I90';
  const tr = {
    cells,
    querySelector: () => ({ textContent: 'I90' }),
    querySelectorAll: () => cells,
  };
  const table = { querySelectorAll: () => [tr] };
  const notices = [];
  const wrap = { querySelector: () => table, insertBefore: node => notices.push(node) };
  const window = { WAREHOUSE_STATE: state, WAREHOUSE_LEDGER_ID: 1, renderWarehouseLedger() {} };
  const context = {
    window,
    Date,
    Intl,
    Number,
    String,
    Array,
    Set,
    Object,
    Map,
    document: {
      getElementById: id => ({ warehouseLedgerWrap: wrap, warehouseLedgerMonth: { value: '1405/08' } })[id],
      createElement: () => ({ textContent: '', setAttribute() {} }),
      head: { appendChild() {} },
    },
    localStorage: { getItem: () => null, setItem() {} },
    jalaliDate: value => dates[String(value).slice(0, 10)] || '',
    g2j: () => [1405, 8, 12],
    whMonthDays: () => 12,
    setTimeout() {},
  };
  vm.runInNewContext(asset, context, { filename: 'warehouse-ledger-eod-freeze-v1.js' });
  window.renderWarehouseLedger();
  assert.equal(cells[11].textContent, '—');
  assert.equal(cells[12].textContent, '۴٬۱۸۸');
  assert.ok(cells[11].classes.has('unverified-cell'));
  assert.equal(notices.length, 1);
  assert.match(notices[0].textContent, /موجودی امروز بدون تغییر/);
  assert.equal(state.current[1].I90, 4188);
});
