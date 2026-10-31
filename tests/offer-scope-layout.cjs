/** Check actual shared markup/CSS in Chrome at narrow and desktop viewport sizes. */
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
class OfferScopeLayoutCheck {
  /** Inspect browser-rendered form controls and retain useful fixture-only failure details. */
  run(){
    const url=pathToFileURL(path.resolve('tests/offer-scope-layout.html')).href;
    for(const width of [360,1200]){
      const html=execFileSync('google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--allow-file-access-from-files','--virtual-time-budget=5000',`--window-size=${width},1000`,'--dump-dom',url],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
      if(!html.includes('SCOPE_LAYOUT_PASS</output>'))throw Error(html.match(/SCOPE_LAYOUT_FAIL[^<]*/)?.[0]||'Form rendering did not finish');
    }
    console.log('PASS: real Chrome form visibility, selected products and responsive narrow/desktop layout');
  }
}
new OfferScopeLayoutCheck().run();
