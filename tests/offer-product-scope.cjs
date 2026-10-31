/** Run the actual active handlers from bounded patch fragments with synthetic DOM/transport. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const manifest = JSON.parse(fs.readFileSync('config/live-offer-code-release.yaml','utf8'));
const scopeManifest = JSON.parse(fs.readFileSync('config/offer-product-scope-release.yaml','utf8'));
for(const operation of manifest.operations){for(const change of scopeManifest.operations){if(change.file===operation.file&&operation.new.includes(change.old))operation.new=operation.new.replace(change.old,change.new);}}
const operations = manifest.operations;
class Field {
  constructor(){this.value='';this.className='';this.textContent='';}
  focus(){this.focused=true;}
  scrollIntoView(){}
  addEventListener(){}
}
class Select extends Field {
  constructor(){super();this.options=[];}
  replaceChildren(){this.options=[];}
  append(option){this.options.push(option);}
  get selectedOptions(){return this.options.filter(option=>option.selected);}
}
class Fixture {
  constructor(){
    this.fields=new Map();this.requests=[];this.errors=[];this.html='';
    const self=this;
    this.context={HTMLInputElement:Field,HTMLSelectElement:Select,HTMLButtonElement:Field,console,esc:String,
      jalaliDate:v=>({'2026-10-31':'1405/08/09','2026-11-21':'1405/08/30'}[v]||''),
      jalaliToGregorianIso:v=>({'1405/08/09':'2026-10-31','1405/08/30':'2026-11-21'}[v]||''),
      confirm:()=>true,location:{reload:()=>{self.reloaded=true;}},
      document:{getElementById:id=>self.field(id),createElement:()=>({value:"",selected:false,textContent:""}),querySelector:()=>({value:'all'}),querySelectorAll:()=>[]},
      parseMoneyInput:value=>Number(String(value).replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[,٬\s]/g,'')),
      $:id=>self.field(id), selectedIds:()=>[7], ensureOffers:async()=>[],
      modal:html=>{self.html=html;},closeModal:()=>{},toast:()=>{},alert:m=>self.errors.push(m),
      req:async(path,request)=>{if(path==='/api/catalog')return [{name:'I90'},{name:'M3P'},{name:'V77'}];self.requests.push({path,body:JSON.parse(request.body)});return {};},
      loadPortalOffers:()=>{},loadOffers:async()=>{},fillOfferSelect:()=>{},paintTable:()=>{},gpClearPlanPage:()=>{},
      PORTAL_OFFERS:[{id:9,title:'FIXTURE',discount_type:'amount',discount_value:1000,promo_code:'KEEP9',one_time_per_customer:true}],
    };
    this.context.window=this.context;
    vm.createContext(this.context);
    vm.runInContext(fs.readFileSync('assets/offer-plan-code.js','utf8'),this.context);
    for(const op of operations){
      if(op.new.includes('window.gpSavePlanApply =')||op.new.trim().startsWith('window.gpSavePlanPage ='))vm.runInContext(op.new,this.context);
    }
  }
  field(id){if(!this.fields.has(id))this.fields.set(id,id.endsWith("Products")?new Select():new Field());return this.fields.get(id);}
  /** Validate each UI entry point through its real save method. */
  async run(prefix,method){
    await this.context.gpOfferPlanEditor.mount(prefix);
    this.field(prefix+'Existing').value='';this.field(prefix+'Title').value='FIXTURE';this.field(prefix+'Ids').value='7';
    this.field(prefix+'DiscountType').value='percent';this.field(prefix+'Discount').value='۱۵';this.field(prefix+'PromoCode').value=' gh adir10 ';
    await this.context[method]();
    assert.equal(this.requests.length,1);let body=this.requests[0].body;
    assert.equal(body.discount_type,'percent');assert.equal(body.discount_value,15);assert.equal(body.promo_code,'GHADIR10');
    this.requests=[];this.field(prefix+'PromoCode').value='';await this.context[method]();assert.equal(this.requests.length,0);assert.ok(this.field(prefix+'PromoCode').focused);
    this.field(prefix+'Existing').value='9';this.context.gpOfferPlanEditor.fill(prefix,this.context.PORTAL_OFFERS[0]);
    await this.context[method]();assert.equal(this.requests.length,1);body=this.requests[0].body;
    assert.equal(body.promo_code,'KEEP9');assert.equal(body.discount_type,'amount');assert.equal(body.one_time_per_customer,true);
    this.requests=[];this.field(prefix+'DiscountType').value='percent';this.field(prefix+'Discount').value='101';await this.context[method]();assert.equal(this.requests.length,0);
    this.field(prefix+'DiscountType').value='none';this.field(prefix+'PromoCode').value='';await this.context[method]();assert.equal(this.requests[0].body.discount_value,0);
  }
}
(async()=>{
  const page=new Fixture();await page.run('gpPlan','gpSavePlanPage');
  const modal=new Fixture();await modal.context.gpOpenPlanApply(7);assert.ok(modal.html.includes('gpPlanApplyPromoCode'));assert.ok(modal.html.includes('gpPlanApplyDiscountType'));assert.ok(!modal.html.includes('id="gpPlanTitle"'));await modal.run('gpPlanApply','gpSavePlanApply');
  assert.ok(operations.some(op=>op.file.endsWith('sales-plans-menu-v1.js')&&op.new.includes("markup('gpPlan')")));
  for(const [fixture,prefix,method] of [[page,'gpPlan','gpSavePlanPage'],[modal,'gpPlanApply','gpSavePlanApply']]){
    fixture.requests=[];fixture.field(prefix+'Existing').value='9';
    fixture.context.gpOfferPlanEditor.fill(prefix,{products:['I90','M3P'],discount_type:'percent',discount_value:15,promo_code:'MULTI15'});
    await fixture.context[method]();const body=fixture.requests[0].body;
    assert.deepEqual(body.products,['I90','M3P']);assert.equal(body.product,'');
    fixture.requests=[];fixture.context.gpOfferPlanEditor.fill(prefix,{product:'V77',discount_type:'amount',discount_value:100,promo_code:'LEGACY'});
    await fixture.context[method]();assert.deepEqual(fixture.requests[0].body.products,['V77']);
  }
  for(const [fixture,prefix] of [[page,'gpPlan'],[modal,'gpPlanApply']]){
    const editor=fixture.context.gpOfferPlanEditor;
    editor.fill(prefix,{id:9,start_date:'2026-10-31',end_date:'2026-11-21',max_uses:5});
    assert.equal(fixture.field(prefix+'StartDate').value,'1405/08/09');
    fixture.field(prefix+'MaxUses').value='۵';
    let payload=editor.read(prefix);assert.equal(payload.start_date,'2026-10-31');assert.equal(payload.end_date,'2026-11-21');assert.equal(payload.max_uses,5);
    fixture.field(prefix+'MaxUses').value='1.5';assert.throws(()=>editor.read(prefix),/عدد صحیح/);
    fixture.field(prefix+'MaxUses').value='';assert.equal(editor.read(prefix).max_uses,0);
    fixture.field(prefix+'StartDate').value='۱۴۰۵/۰۸/۳۰';fixture.field(prefix+'EndDate').value='۱۴۰۵/۰۸/۰۹';assert.throws(()=>editor.read(prefix),/قبل از شروع/);
    fixture.field(prefix+'StartDate').value='1405/13/01';assert.throws(()=>editor.read(prefix),/معتبر نیست/);
    fixture.requests=[];fixture.context.confirm=()=>false;await editor.remove(9);assert.equal(fixture.requests.length,0);
    fixture.context.confirm=()=>true;await editor.remove(9);assert.equal(fixture.requests[0].path,'/api/offers/delete');assert.equal(fixture.requests[0].body.id,9);assert.equal(fixture.reloaded,true);
  }
  console.log('PASS: both active handlers submit multi-product arrays, preserve legacy scope and retain independent fields');
})().catch(error=>{console.error(error);process.exitCode=1;});
