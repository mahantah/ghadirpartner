'use strict';
const assert=require('node:assert/strict');
const v=require('../assets/order-details-v2.js');
global.has=r=>r==='finance';
global.jalaliDateTime=s=>s;
global.orderItemSerials=(_,it)=>it.serials||[];
global.invBySerial=()=>null;
global.serialSource=()=> 'محل نامشخص';
global.shipHistory=()=>null;
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1sAAAAASUVORK5CYII=';
assert.equal(v.gpOdImage(png).extension,'png');
assert.equal(v.gpOdImage('data:image/png;base64,'+png).extension,'png');
for(const raw of [null,{},'javascript:alert(1)','https://evil.example/bank.jpg',
  'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIi8+',
  'data:text/html;base64,PHNjcmlwdD4=', 'data:image/jpeg;base64,'+png,
  'PHN2Zz48L3N2Zz4=', png+'" onerror="alert(1)', 'a'.repeat(1400001),'a==='])
  assert.equal(v.gpOdImage(raw),null);
assert.deepEqual(v.gpOdDetails({settlement_details:{tracking_number:'123'}}),{tracking_number:'123'});
for(const d of [null,'{"tracking_number":"123"}',[],42])assert.deepEqual(v.gpOdDetails({settlement_details:d}),{});
assert.deepEqual(v.gpOdAmount({approved_total:100,estimated_total:200}),{value:100,label:'مبلغ تأییدشده'});
assert.equal(v.gpOdAmount({estimated_total:200}).label,'مبلغ برآوردی');
assert.equal(v.gpOdAmount({}).value,null);
const o={id:1,number:'TEST-000001',customer_id:7,customer_name:'نمونه',
  requested_payment_method:'check',payment_status:'پرداخت نشده',check_status:'',
  settlement_details:{image_base64:png,bank_name:'<img src=x onerror=alert(1)>',check_number:'1234567890123456',due_date:'1405/08/01',tracking_number:'12345'}};
const before=JSON.stringify(o);
const html=v.gpOdPaymentHtml(o);
assert.ok(html.includes('1234567890123456')&&html.includes('1405/08/01')&&html.includes('12345'));
assert.ok(html.includes('&lt;img')&&!html.includes('<img src=x'));
assert.ok(html.includes('data:image/png;base64,')&&html.includes('download="payment-1.png"'));
assert.ok(html.includes('پرداخت نشده')&&html.includes('به معنی تأیید پرداخت'));
assert.equal(JSON.stringify(o),before);
assert.ok(v.gpOdPaymentHtml({}).includes('تصویری در اطلاعات پرداخت'));
assert.ok(v.gpOdPaymentHtml({settlement_details:{image_base64:'broken'}}).includes('قالب آن پشتیبانی نمی‌شود'));
global.has=()=>false;
const denied=v.gpOdPaymentHtml(o);assert.ok(!denied.includes(png)&&!denied.includes('1234567890123456'));
global.has=()=>true;
const shipping=v.gpOdShippingHtml({...o,delivery_address:{address:'نشانی قدیمی'},tracking_code:'TRACK-1',panels:['PSP'],history:[]},{address:'نشانی جدید'});
assert.ok(shipping.includes('نشانی قدیمی')&&!shipping.includes('نشانی جدید'));
const items=v.gpOdItemHtml({items:[{product:'I90',qty:1200,serials:['SAMPLE-0001']}]});
assert.ok(items.includes('1200')&&items.includes('<details')&&!items.includes('<details open'));
assert.ok(items.includes('SAMPLE-0001'));
console.log('PASS: image validation, injection handling, access gating, payment states, snapshots and collapsed serials');
