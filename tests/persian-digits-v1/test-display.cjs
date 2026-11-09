"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
const source = fs.readFileSync(__dirname + "/candidate/app.html", "utf8");
const script = source.match(
  /<script id="gp-persian-digits-v1">([\s\S]*?)<\/script>/,
)[1];
const dom = new JSDOM(
  `<!doctype html><body style="font-family:Tahoma">
<p id="amount">مبلغ 123,450 تومان</p><p id="date">1405/08/17</p>
<b class="code" id="carton">I90-479</b><b class="code" id="invoice">12345</b>
<div id="parent">10 <span class="serial-chip">00123456789</span></div>
<div class="serial-list"><span id="serial-child">99887766</span></div>
<input id="qty" type="number" value="20"><input id="national" value="0012345678">
<input id="whScan" value="00123456789"><input name="imei" value="1234567890">
<input id="secret" type="password" value="123"><input id="hidden" type="hidden" value="123">
<table><thead><tr><th>سریال</th><th>تعداد سریال</th><th>شماره فاکتور</th></tr></thead>
<tbody><tr><td id="serial-cell"><b>000123</b></td><td id="count">12</td><td id="invoice-cell">123</td></tr></tbody></table>
<select id="bank"><option>بانک 123</option></select><svg><text id="svg">1234</text></svg>
</body>`,
  { runScripts: "outside-only", url: "https://example.test" },
);
const { window } = dom;
const doc = window.document;
const originalText = doc.body.textContent;
const values = [...doc.querySelectorAll("input")].map((el) => el.value);
const mapped = (el) => el.style.fontFamily.includes("GP Persian Digits");
window.eval(script);
for (const id of [
  "amount",
  "date",
  "carton",
  "invoice",
  "parent",
  "qty",
  "national",
  "count",
  "invoice-cell",
  "bank",
  "svg",
])
  assert.ok(mapped(doc.getElementById(id)), id);
for (const selector of [
  ".serial-chip",
  "#serial-child",
  "#whScan",
  "[name=imei]",
  "#serial-cell b",
  "#secret",
  "#hidden",
])
  assert.equal(mapped(doc.querySelector(selector)), false, selector);
assert.equal(doc.body.textContent, originalText);
assert.deepEqual(
  [...doc.querySelectorAll("input")].map((el) => el.value),
  values,
);
(async () => {
  const added = doc.createElement("div");
  added.id = "dynamic";
  added.textContent = "200";
  doc.body.append(added);
  await Promise.resolve();
  await Promise.resolve();
  assert.ok(mapped(added));
  added.firstChild.data = "300";
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(added.textContent, "300");
  assert.ok(mapped(added));
  let mutations = 0;
  const observer = new window.MutationObserver((records) => {
    mutations += records.length;
  });
  observer.observe(doc.body, { attributes: true, subtree: true });
  window.gpRefreshPersianDigits();
  window.gpRefreshPersianDigits();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(mutations, 0, "refresh is idempotent and cannot cause flicker");
  observer.disconnect();
  console.log(
    "ok: Persian digit presentation; raw serials; unchanged values; dynamic content; zero repeat writes",
  );
  const fontStyle = source.match(
    /<style id="gp-persian-digits-v1-css">[\s\S]*?<\/style>/,
  )[0];
  const browserCheck = `<output id="tanha-browser-result">pending</output><script>
  document.fonts.load('400 24px "GP Persian Digits"','0123456789').then(async faces=>{
   await document.fonts.ready;
   if(faces.length!==1||faces[0].status!=='loaded')throw Error('font_not_loaded');
   if(!getComputedStyle(document.querySelector('#amount')).fontFamily.includes('GP Persian Digits'))throw Error('digit_font_missing');
   if(getComputedStyle(document.querySelector('.serial-chip')).fontFamily.includes('GP Persian Digits'))throw Error('serial_font_changed');
   if(document.querySelector('#qty').value!=='20'||document.querySelector('#whScan').value!=='00123456789')throw Error('form_value_changed');
   const context=document.createElement('canvas').getContext('2d');
   for(const weight of [400,700]){
    context.font=weight+' 24px "GP Persian Digits"';
    if(Math.abs(context.measureText('0123456789').width-context.measureText('۰۱۲۳۴۵۶۷۸۹').width)>0.01)throw Error('digit_glyph_mismatch');
   }
   document.querySelector('#tanha-browser-result').textContent='GP_TANHA_DIGITS_PASS';
  }).catch(error=>{document.querySelector('#tanha-browser-result').textContent='GP_TANHA_DIGITS_FAIL:'+error.message;});
  </script>`;
  const html =
    "<!doctype html>" +
    doc.documentElement.outerHTML
      .replace("<head>", '<head><meta charset="UTF-8">' + fontStyle)
      .replace("</body>", browserCheck + "</body>");
  fs.writeFileSync(__dirname + "/tanha-browser.html", html);

  window.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
  window.close();
});
