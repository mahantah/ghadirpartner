const fs = require('fs'), vm = require('vm'), path = require('path');
let fixture = fs.readFileSync(path.join(__dirname, 'warehouse-nav-stability.cjs'), 'utf8').split('const assert = require("assert/strict");')[0];
fixture = fixture.replace('const dom = new JSDOM', () => `
product.pattern='^S[0-9]{3}$';product.example='S001';
core.orders[0].status='در حال آماده سازی';core.orders[0].payment_status='تسویه کامل';core.orders[0].items[0].qty=12;core.orders[0].items[0].serials=[];core.orders[0].exit_items=[];
core.orders.push({...JSON.parse(JSON.stringify(core.orders[0])),id:2,number:'FIXTURE-PARTIAL',status:'ارسال شد',partial_exit:true,items:[{product:product.name,qty:3,serials:['S900']}],exit_items:[{product:product.name,qty:1,serials:['S900']}]});
const writes=[];let failBootstrap=false;
function response(data,ok=true){return{ok,status:ok?200:409,headers:{get:()=> 'application/json'},json:async()=>JSON.parse(JSON.stringify(data)),text:async()=>typeof data==='string'?data:JSON.stringify(data)}}
const dom = new JSDOM`);
fixture = fixture.replace('w.fetch = async (url) => {', `w.fetch = async (url, opt={}) => {
const route=String(url).split('?')[0];
if(route==='/api/bootstrap'&&failBootstrap){failBootstrap=false;return response('read failed',false)}
if(route==='/api/order/serial-meta')return response({rows:[]});
if(opt.method==='POST'&&route.startsWith('/api/')){
 const payload=opt.body instanceof w.FormData?{id:opt.body.get('id'),product:opt.body.get('product')}:JSON.parse(opt.body||'{}');
 writes.push({route,payload});await new Promise(resolve=>setTimeout(resolve,90));
 const order=core.orders.find(order=>Number(order.id)===Number(payload.id));const item=order.items.find(item=>item.product===payload.product);
 if(route==='/api/status'){order.status=payload.status;return response(order)}
 if(payload.serial==='S666'||payload.code==='S666')return response('سریال نامعتبر آزمایشی',false);
 const codes=payload.code==='CARTON-001'?['S100','S101']:[payload.serial||payload.code||'S555'];
 if(route.includes('unassign')){item.serials=item.serials.filter(serial=>payload.serial?serial!==payload.serial:serial==='S900');return response({ok:true})}
 if(codes.some(code=>item.serials.includes(code)))return response('سریال تکراری است',false);
 item.serials.push(...codes);return response({assigned:codes.length,label:payload.code,added:codes.length,errors:[]});
}`);
fixture = fixture.replace('json: async () => data,', 'json: async () => JSON.parse(JSON.stringify(data)),');
fixture = fixture.replace('w.alert = (m)', 'w.confirm=()=>true;w.alert = (m)');
const checks = String.raw`
const assert=require('assert/strict'),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
setTimeout(async()=>{try{
 const w=dom.window;await w.openPrep(1);await pause(80);
 const body=w.document.getElementById('modalbody'),input=w.document.getElementById('alloc_0'),status=w.document.getElementById('pst');
 assert(body.querySelector('.gp-prep-item'));assert(!w.document.getElementById('serialPanel_0').classList.contains('hidden'));
 assert.equal(body.querySelectorAll('details[open]').length,0,'advanced options start collapsed');
 status.value='آماده ارسال';w.document.getElementById('ship').value='پیک';w.document.getElementById('courierName').value='Fixture courier';w.document.getElementById('courierPhone').value='09120000000';
 input.focus();const submit=code=>{input.value=code;input.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}))};
 submit('S001');submit('S002');submit('S002');w.saveStatus(1);
 await pause(650);
 assert.equal(w.document.getElementById('modalbody'),body);assert.equal(w.document.getElementById('alloc_0'),input);
 assert(!w.document.getElementById('modal').classList.contains('hidden'));assert.equal(w.document.activeElement,input);
 assert.equal(status.value,'آماده ارسال');assert.equal(w.document.getElementById('courierName').value,'Fixture courier');
 assert.equal(w.document.getElementById('serialCount_0').textContent,'2/12');assert.equal(writes.filter(x=>x.payload.code==='S002').length,1);
 assert.equal(writes.filter(x=>x.route==='/api/status').length,0,'status must wait for queued serial writes');
 const manual=w.document.getElementById('scan_0');manual.value='S003';w.scanSerial(1,0);await pause(350);
 assert.equal(w.document.getElementById('scan_0'),manual);assert.equal(w.document.getElementById('serialCount_0').textContent,'3/12');
 submit('S666');submit('S004');await pause(600);assert(w.document.getElementById('serialErrors_0').textContent.includes('S666'));
 assert.equal(w.document.getElementById('serialCount_0').textContent,'4/12');
 submit('CARTON-001');await pause(350);assert.equal(w.document.getElementById('serialCount_0').textContent,'6/12');
 const initial=writes.length;w.document.getElementById('imei_0').value='123';manual.value='S009';w.scanSerial(1,0);assert.equal(writes.length,initial);w.document.getElementById('imei_0').value='';manual.value='';
 w.removeOrderSerial(1,product.name,'S004');await pause(300);assert.equal(w.document.getElementById('serialCount_0').textContent,'5/12');
 const fileInput=w.document.getElementById('sf_0');Object.defineProperty(fileInput,'files',{configurable:true,value:[new w.File(['fixture'],'serials.csv')]});w.importOrderSerials(1,0);await pause(300);assert.equal(w.document.getElementById('serialCount_0').textContent,'6/12');assert.equal(w.document.getElementById('sf_0'),fileInput);
 w.removeAllOrderSerials(1,product.name);await pause(300);assert.equal(w.document.getElementById('serialCount_0').textContent,'0/12');
 input.value='S007';input.dispatchEvent(new w.Event('input',{bubbles:true}));await pause(600);assert.equal(w.document.getElementById('serialCount_0').textContent,'1/12');
 failBootstrap=true;submit('S008');await pause(350);assert.equal(writes.filter(x=>x.payload.code==='S008').length,1,'a failed refresh must never repeat a confirmed write');
 const before=writes.length;submit('S005');submit('S006');await pause(20);w.closeModal();await pause(350);
 assert(w.document.getElementById('modal').classList.contains('hidden'),'a completed scan must not reopen a closed modal');
 assert(!writes.slice(before).some(x=>x.payload.code==='S006'),'unsubmitted scans cancel on explicit close');
 await w.openPrep(1);w.document.getElementById('ship').value='پیک';w.document.getElementById('courierName').value='Saved courier';w.document.getElementById('courierPhone').value='09120000000';await w.saveStatus(1);await pause(100);const statusWrite=writes.find(x=>x.route==='/api/status');assert.equal(statusWrite.payload.courier_name,'Saved courier');
 await w.openPrep(2);await pause(60);const locked=w.document.querySelector('#serialRegistered_0 .serial-shipped');
 assert(locked&&!locked.querySelector('button'));assert(w.document.querySelector('.partial-exit-banner'));
 assert.equal(w.document.getElementById('serialCount_0').textContent,'1/3');
 assert.equal(errors.length,0,errors.join('\n'));console.log('PASS: compact serial UI, stable inputs/status/courier drafts, queued scans, duplicate suppression, inline failures, carton allocation, close safety, shipped locks');
}catch(e){console.error(e);process.exitCode=1}finally{dom.window.close()}},5500);
`;
vm.runInNewContext(fixture + checks, {require,process,console,setTimeout,clearTimeout,Buffer,URL}, {filename:__filename});
