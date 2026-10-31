/** Run the actual active handlers from bounded patch fragments with synthetic DOM/transport. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const manifest = JSON.parse(fs.readFileSync('config/live-offer-code-release.yaml','utf8'));
const operations = manifest.operations;
class Field {
  constructor(){this.value='';this.className='';this.textContent='';}
  focus(){this.focused=true;}
  scrollIntoView(){}
  addEventListener(){}
}
class Select extends Field {}
class Fixture {
  constructor(){
    this.fields=new Map();this.requests=[];this.errors=[];this.html='';
    const self=this;
    this.context={HTMLInputElement:Field,HTMLSelectElement:Select,console,esc:String,
      document:{getElementById:id=>self.field(id),querySelector:()=>({value:'all'}),querySelectorAll:()=>[]},
      parseMoneyInput:value=>Number(String(value).replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[,٬\s]/g,'')),
      $:id=>self.field(id), selectedIds:()=>[7], ensureOffers:async()=>[],
      modal:html=>{self.html=html;},closeModal:()=>{},toast:()=>{},alert:m=>self.errors.push(m),
      req:async(path,request)=>{self.requests.push({path,body:JSON.parse(request.body)});return {};},
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
  field(id){if(!this.fields.has(id))this.fields.set(id,new Field());return this.fields.get(id);}
  /** Validate each UI entry point through its real save method. */
  async run(prefix,method){
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
  console.log('PASS: actual page/modal renderers, numeric discounts, codes, validation, edit preservation and distinct ids');
})().catch(error=>{console.error(error);process.exitCode=1;});
