'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
async function main(){
const root=__dirname+'/candidate/',app=fs.readFileSync(root+'app.html','utf8');
const labels=fs.readFileSync(root+'assets/warehouse-carton-multilabel-v53438.js','utf8');
const dom=new JSDOM(app,{runScripts:'outside-only',url:'https://fixture.invalid/'}),w=dom.window;
w.$=id=>w.document.getElementById(id);w.esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
w.WH={cartons:[{id:1,code:'BOX-ONE',product:'P',serials:[],capacity:20},{id:2,code:'BOX-TWO',product:'Q',serials:[],capacity:20},{id:3,code:'BOX-THREE',product:'P',serials:[],capacity:20}],inventory:[],carton_stats:[],shelves:Object.fromEntries([1,2,3,4,5].map(n=>[n,{n:0,by:{}}])),connected:true};
const start=app.indexOf('const GP_CARTON_EXPORT_SELECTION='),end=app.indexOf('async function saveWarehouseCarton()',start);assert(start>0&&end>start);
w.eval(app.slice(start,end));w.renderWarehouse();w.eval(labels);
const row=id=>w.document.querySelector('.gp-wh-carton-label-check[data-carton-id="'+id+'"]');
assert(w.$('gpCartonExportExcel').disabled);row(1).click();
assert(!w.$('gpCartonExportExcel').disabled,'existing visible row tick must enable Excel');
assert(w.$('gpCartonExportExcel').textContent.includes('۱'));
assert(!w.$('gpWarehousePrintSelectedCartons').disabled,'the same tick still enables label printing');
assert.equal(w.document.querySelectorAll('.gp-carton-export-select').length,0,'one canonical checkbox per carton');
const posted=[];w.HTMLFormElement.prototype.submit=function(){posted.push({method:this.method,path:new URL(this.action).pathname,ids:this.querySelector('[name="carton_ids"]').value});};
w.gpDownloadSelectedCartonSerials();assert.deepEqual(posted[0],{method:'post',path:'/export/carton-serials.xlsx',ids:'1'});
w.$('whCartonSearch').value='BOX-TWO';w.renderWarehouse();row(2).click();w.gpDownloadSelectedCartonSerials();assert.equal(posted[1].ids,'1,2','same selection persists across models and filters');
w.gpClearCartonExportSelection();assert(w.$('gpCartonExportExcel').disabled&&w.$('gpWarehousePrintSelectedCartons').disabled);assert(!row(2).checked);
w.$('whCartonSearch').value='';w.renderWarehouse();w.$('gpWhCartonSelectAll').click();assert.equal(w.gpWarehouseCartonLabelSelection.size,3);assert(w.$('gpCartonExportSelectVisible').checked);assert(w.$('gpCartonExportExcel').textContent.includes('۳'));
w.gpClearCartonExportSelection();row(3).closest('tr').style.display='none';w.gpSelectVisibleCartonsForExport(true);w.gpDownloadSelectedCartonSerials();assert.equal(posted[2].ids.split(',').sort().join(','),'1,2','Excel select-visible respects hidden rows');assert(w.$('gpWhCartonSelectAll').checked);
w.gpClearCartonExportSelection();assert(!row(1).checked&&!row(2).checked&&!row(3).checked);
const observer=new w.MutationObserver(()=>{});observer.observe(w.$('gpCartonExportToolbar'),{childList:true,subtree:true});w.gpSyncWarehouseCartonSelection();w.gpSyncWarehouseCartonSelection();assert.equal(observer.takeRecords().length,0,'idle synchronization must not create observer loops');observer.disconnect();
await new Promise(resolve=>setImmediate(resolve));
dom.window.close();console.log('PASS: existing row and header ticks activate Excel and print together, one checkbox, filters, hidden rows, clear and idle stability');

}
main().catch(error=>{console.error(error);process.exitCode=1;});
