const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><html><head></head><body><div id="app"><header><nav class="topnav"><div id="warehouseNavGroup"><div class="nav-submenu"><button data-tab="warehouse">انبار سریال</button><button data-tab="inventory">سریال‌ها</button></div></div></nav></header></div><section id="warehouse"><div id="gpWarehouseProducts"><input id="productName"><div id="productBody">فهرست</div></div><button id="gpAddProductBtn"></button></section><section id="products" class="tab hidden"></section></body></html>',{runScripts:'outside-only',url:'https://fixture.invalid/'});
const w=dom.window;w.has=()=>true;let selected='';w.show=t=>selected=t;w.setTimeout=()=>0;
for(const [name,key] of [['nav-restructure-v1.js','navQA'],['menu-live-v3.js','menuQA']]){
 let src=fs.readFileSync(__dirname+'/candidate/assets/'+name,'utf8');
 const exports=key==='navQA'?'installWarehouseProducts,fillWarehouseNav,hideOffersAndPortalUsers':'installWarehouseProducts';
 src=src.replace('\n  apply();','\n window.'+key+'={'+exports+'};return;\n  apply();');w.eval(src);
}
w.navQA.installWarehouseProducts();w.menuQA.installWarehouseProducts();w.navQA.fillWarehouseNav();w.navQA.hideOffersAndPortalUsers();
assert(w.document.querySelector('#products #productName'));assert(w.document.querySelector('#products #productBody'));assert(!w.document.getElementById('gpWarehouseProducts'));
const btn=w.document.getElementById('gpNavProducts');assert(btn&&!btn.hidden&&!btn.classList.contains('hidden'));btn.click();assert.equal(selected,'products');
w.eval(fs.readFileSync(__dirname+'/menu-live-v4.js','utf8'));assert(w.document.querySelector('#warehouseNavGroup #gpNavProducts'));
w.navQA.fillWarehouseNav();assert.equal(w.document.querySelectorAll('#gpNavProducts').length,1);
w.has=()=>false;w.navQA.fillWarehouseNav();assert(btn.classList.contains('hidden'));
const legacyPath=__dirname+'/candidate/assets/ui-v53435-menu2.js';
if(fs.existsSync(legacyPath)){
 const legacy=fs.readFileSync(legacyPath,'utf8').replace('\n  fillWarehouse();','\n  window.menu2QA={fillWarehouse};\n  fillWarehouse();');
 w.eval(legacy);
 w.has=()=>true;w.navQA.fillWarehouseNav();
 w.menu2QA.fillWarehouse();
 assert(!btn.hidden&&!btn.classList.contains('gp-nav-retired'),'legacy sweep must preserve the restored products item');
 assert.notEqual(w.getComputedStyle(btn).display,'none','legacy CSS must not hide the restored products item');
 btn.click();assert.equal(selected,'products');
 w.has=()=>false;w.navQA.fillWarehouseNav();assert(btn.classList.contains('hidden'),'admin access remains required');
}
console.log('PASS: products content restored, explicit menu survives v4, click routes correctly, admin visibility preserved');dom.window.close();
