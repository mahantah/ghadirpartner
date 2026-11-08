"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const source = fs.readFileSync(__dirname + "/candidate/app.html", "utf8");
const dom = new JSDOM(
  '<!doctype html><head></head><body><select id="opageSize"><option>50</option></select><table><tbody id="otbody"></tbody></table><span id="opageInfo"></span><div id="opager"></div></body>',
  { runScripts: "outside-only" },
);
const w = dom.window;
for (const id of ["gp-order-panel-serials-v1", "gp-order-panel-rows-v1"])
  w.eval(
    source.match(
      new RegExp('<script id="' + id + '">([\\s\\S]*?)<\\/script>'),
    )[1],
  );
w.eval(`var ORDER_PAGE=1;
function $(id){return document.getElementById(id)}
function orderFiltered(){return window.fixtureOrders}
function customerById(){return {company:'',mobile:'',code:''}}
function esc(x){return String(x||'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));}
function jalaliDateTime(x){return x}
function itemSummary(o){return esc(o.items[0].product)}
function payClass(){return 'pay-test'}
function statusClass(){return 'status-test'}
`);
w.eval(
  source.match(
    /function renderOrders\(\)\{[\s\S]*?(?=function goOrderPage)/,
  )[0],
);
w.fixtureOrders = [
  {
    id: 1,
    panels: ["سپهر"],
    number: "001",
    items: [{ product: "I90", qty: 1 }],
    status: "ثبت شده",
    payment_status: "پرداخت نشده",
  },
  {
    id: 2,
    psp: "فن اوا",
    number: "002",
    items: [{ product: "H9", qty: 2 }],
    fros: true,
    status: "آماده ارسال",
    payment_status: "تسویه",
  },
  {
    id: 3,
    panels: [],
    number: "003",
    items: [{ product: "M3P", qty: 3 }],
    status: "ارسال شد",
  },
  {
    id: 4,
    panels: ["", null, 2],
    number: "004",
    items: [{ product: "I80", qty: 4 }],
    status: "ثبت شده",
  },
];
const before = JSON.stringify(w.fixtureOrders);
w.renderOrders();
const rows = [...w.document.querySelectorAll("#otbody tr")];
assert.equal(rows.length, 4);
for (const row of rows.slice(0, 2)) {
  assert.equal(row.dataset.gpPanelOrder, "true");
  assert.equal(row.cells.length, 7);
  for (const cell of row.cells)
    assert.equal(
      w.getComputedStyle(cell).backgroundColor,
      "rgb(255, 241, 220)",
    );
  assert.ok(
    row
      .querySelector(".dots-btn")
      .getAttribute("onclick")
      .includes("toggleOrderMenu"),
  );
  assert.ok(row.querySelector(".badge"));
}
for (const row of rows.slice(2))
  assert.equal(row.hasAttribute("data-gp-panel-order"), false);
assert.ok(rows[1].classList.contains("fros-row"));
assert.equal(JSON.stringify(w.fixtureOrders), before);
w.fixtureOrders[0].panels = [];
w.renderOrders();
assert.equal(
  w.document.querySelector("#otbody tr").hasAttribute("data-gp-panel-order"),
  false,
);
w.close();
console.log(
  "ok: all seven cells highlighted; normal rows unaffected; action/status/priority/data preserved; rerenders reflect panel changes",
);
