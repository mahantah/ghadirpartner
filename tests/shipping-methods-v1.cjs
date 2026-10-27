/** Exercise the canonical shipping form without reading or writing customer state. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(process.argv[2] + '/app.html', 'utf8');
for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) new Function(match[1]);
const elements = new Map();
for (const id of ['ship', 'trackingWrap', 'courierWrap', 'pst', 'courierName', 'courierPhone', 'trackingCode']) {
  elements.set(id, {value: '', hidden: false, classList: {toggle(_name, hidden) {elements.get(id).hidden = hidden;}}});
}
let payload;
const context = vm.createContext({
  $: id => elements.get(id),
  req: async (_url, options) => {payload = JSON.parse(options.body);},
  closeModal() {}, toast() {}, refresh: async () => {},
  alert(message) {throw new Error(message);}
});
const toggle = html.match(/function toggleTrackingField\(\)\{[^\n]+/)[0];
const save = html.match(/async function saveStatus\(id\)\{[^\n]+/)[0];
vm.runInContext(toggle + '\n' + save, context);
(async () => {
  for (const [carrier, tracking, courier] of [['ماهکس', false, true], ['ترمینال', true, true], ['پیک', true, false], ['تیپاکس', false, true], ['حضوری', true, true]]) {
    elements.get('ship').value = carrier;
    vm.runInContext('toggleTrackingField()', context);
    assert.equal(elements.get('trackingWrap').hidden, tracking);
    assert.equal(elements.get('courierWrap').hidden, courier);
  }
  elements.get('pst').value = 'ارسال شد';
  elements.get('ship').value = 'پیک';
  elements.get('courierName').value = '  پیک نمونه  ';
  elements.get('courierPhone').value = '  09120000000  ';
  await vm.runInContext('saveStatus(42)', context);
  assert.equal(payload.courier_name, 'پیک نمونه');
  assert.equal(payload.courier_phone, '09120000000');
  elements.get('ship').value = 'ماهکس';
  elements.get('trackingCode').value = '000123';
  await vm.runInContext('saveStatus(42)', context);
  assert.equal(payload.tracking_code, '000123');
  assert.match(html, /esc\(o.courier_name\|\|''\)/);
  assert.match(html, /gpOdField\('نام پیک',o.courier_name\)/);
  console.log('shipping JavaScript syntax, field visibility and payload: PASS');
})().catch(error => {console.error(error);process.exitCode = 1;});
