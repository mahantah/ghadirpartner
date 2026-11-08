"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const root = __dirname + "/candidate/";
const app = fs.readFileSync(root + "app.html", "utf8");
const details = fs.readFileSync(
  root + "assets/order-details-v2-approved-20261024.js",
  "utf8",
);
const dom = new JSDOM(
  "<!doctype html><html><head></head><body></body></html>",
  { runScripts: "outside-only" },
);
const w = dom.window;
w.eval(
  app.match(/<script id="gp-order-panel-serials-v1">([\s\S]*?)<\/script>/)[1],
);
w.eval(`
 function esc(x){return String(x).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));}
 function productByName(){return {serial_required:true,example:'001234'}}
 function orderItemSerials(o,it){return it.serials||[]}
 function invBySerial(){return {imei:'0123456789'}}
 function serialSource(){return 'مخزن'}
 function gpOdList(v){return Array.isArray(v)?v:[]}
 function gpOdEsc(x){return esc(x)}
 function gpOdMoney(x){return String(x)}
 function gpOdCard(t,c){return c}
`);
w.eval(
  app.match(
    /function prepItems\(o\)\{[\s\S]*?(?=\nasync function allocateWarehouseCode)/,
  )[0],
);
w.eval(details.match(/function gpOdItemHtml\(o\)\{[\s\S]*?(?=\nfunction )/)[0]);
for (const flags of [
  { panels: ["سپهر"] },
  { psp: "پاسارگاد" },
  { panels: [], psp: "فن اوا" },
]) {
  const order = {
    id: 1,
    items: [{ product: "I90", qty: 1, serials: ["0001234567"] }],
    ...flags,
  };
  const before = JSON.stringify(order);
  for (const render of [w.prepItems, w.gpOdItemHtml]) {
    const box = w.document.createElement("div");
    box.innerHTML = render(order);
    assert.equal(box.querySelectorAll("[data-gp-panel-serial=true]").length, 1);
    assert.equal(
      box.querySelector("[data-gp-panel-serial=true]").title,
      "ثبت در پنل",
    );
    assert.ok(box.textContent.includes("0001234567"));
  }
  assert.equal(JSON.stringify(order), before);
}
for (const flags of [{}, { panels: [] }, { panels: ["", null, 2], psp: " " }]) {
  const o = {
    id: 2,
    items: [{ product: "I90", qty: 1, serials: ["000999"] }],
    ...flags,
  };
  for (const render of [w.prepItems, w.gpOdItemHtml])
    assert.ok(!render(o).includes("data-gp-panel-serial"));
}
assert.equal(w.gpPanelSerialPresentation.attributes(null), "");
assert.ok(
  w.document
    .querySelector("#gp-panel-serial-colors-v1")
    .textContent.includes("#fff1dc"),
);
// The legacy detail renderer must mark its serial wrapper too.
assert.ok(
  app.includes(
    "class=\"detail-serial\"${(window.gpPanelSerialPresentation?.attributes(o)||'')}",
  ),
);
w.close();
console.log(
  "ok: panel and legacy PSP orders highlighted; ordinary serials unchanged; raw values preserved",
);
