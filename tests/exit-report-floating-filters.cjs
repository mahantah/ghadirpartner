const fs=require('fs'),vm=require('vm'),path=require('path');
let fixture=fs.readFileSync(path.join(__dirname,'warehouse-nav-stability.cjs'),'utf8').split('const assert = require("assert/strict");')[0];
fixture=fixture.replace('const dom = new JSDOM', `core.orders[0].shipping_type='پیک';core.orders.push({...JSON.parse(JSON.stringify(core.orders[0])),id:2,number:'FIXTURE-002',shipping_type:'ماهکس'});const dom = new JSDOM`);
const checks=String.raw`
const assert=require('assert/strict'),pause=ms=>new Promise(r=>setTimeout(r,ms));
setTimeout(async()=>{try{
 const w=dom.window;w.show('reports');await pause(400);
 const root=w.document.getElementById('gpSearchFabRoot');assert.notEqual(w.getComputedStyle(root).display,'none');
 w.document.getElementById('gpSearchFab').click();assert(root.classList.contains('is-open'));
 const pane=w.document.getElementById('gpFabPane_reports');
 for(const id of ['repFrom','repTo','repShip','gpFabRepQ'])assert(pane.contains(w.document.getElementById(id)),id);
 assert(!pane.querySelector('#gpFabStockQ'));
 const body=w.document.getElementById('repBody');assert(body.textContent.includes('FIXTURE-001')&&body.textContent.includes('FIXTURE-002'));
 const ship=w.document.getElementById('repShip');ship.value='پیک';ship.dispatchEvent(new w.Event('change',{bubbles:true}));await pause(100);
 assert(body.textContent.includes('FIXTURE-001')&&!body.textContent.includes('FIXTURE-002'));
 let html='',printed=0;w.open=()=>({document:{write(t){html+=t},close(){}},focus(){},print(){printed++}});
 w.document.getElementById('exitReportPdf').click();assert.equal(printed,1);assert(html.includes('FIXTURE-001')&&!html.includes('FIXTURE-002'));
 const q=w.document.getElementById('gpFabRepQ');q.value='NO-MATCH';q.dispatchEvent(new w.Event('input',{bubbles:true}));await pause(70);html='';w.document.getElementById('exitReportPdf').click();assert(!html.includes('FIXTURE-001'));
 pane.querySelector('[data-gp-fab-clear]').click();await pause(100);assert.equal(ship.value,'');assert.equal(q.value,'');assert(body.textContent.includes('FIXTURE-002'));
 const from=w.document.getElementById('repFrom');from.value='1499/01/01';from.dispatchEvent(new w.Event('change',{bubbles:true}));await pause(70);assert(!body.textContent.includes('FIXTURE-001'));
 assert.equal(errors.length,0,errors.join('\n'));console.log('PASS: floating date/shipping/search filters, reset, filtered-only PDF');
}catch(e){console.error(e);process.exitCode=1}finally{dom.window.close()}},5500);
`;
vm.runInNewContext(fixture+checks,{require,process,console,setTimeout,clearTimeout,Buffer,URL},{filename:__filename});
