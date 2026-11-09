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
w.eval(
  source.match(/<script id="gp-order-panel-rows-v1">([\s\S]*?)<\/script>/)[1],
);
const statusStyle = w.document.createElement("style");
statusStyle.textContent =
  "#otbody>tr:nth-child(2)>td{background:#e6f2ff!important;color:#0057a7!important}#otbody>tr:nth-child(1)>td{background:#e4f7e9!important;color:#126b36!important}";
w.document.head.appendChild(statusStyle);
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
  for (const cell of row.cells) {
    const shadow = w.getComputedStyle(cell).boxShadow;
    assert.ok(shadow.includes("#f58220"), shadow);
    assert.ok(shadow.includes("inset 0 1px"), shadow);
    assert.ok(shadow.includes("inset 0 -1px"), shadow);
  }
  assert.ok(
    w.getComputedStyle(row.cells[0]).boxShadow.includes("inset -1px 0"),
  );
  assert.ok(
    w
      .getComputedStyle(row.cells[row.cells.length - 1])
      .boxShadow.includes("inset 1px 0"),
  );
  assert.ok(
    row
      .querySelector(".dots-btn")
      .getAttribute("onclick")
      .includes("toggleOrderMenu"),
  );
  assert.ok(row.querySelector(".badge"));
}
for (const row of rows.slice(2)) {
  assert.equal(row.hasAttribute("data-gp-panel-order"), false);
  assert.equal(w.getComputedStyle(row.cells[0]).boxShadow, "");
}
assert.equal(
  w.getComputedStyle(rows[0].cells[0]).backgroundColor,
  "rgb(228, 247, 233)",
);
assert.equal(
  w.getComputedStyle(rows[1].cells[0]).backgroundColor,
  "rgb(230, 242, 255)",
);
assert.equal(w.getComputedStyle(rows[1].cells[0]).color, "rgb(0, 87, 167)");
const outlineStyle = w.document.querySelector(
  "#gp-panel-order-colors-v1",
).textContent;
assert.ok(!/background|border-right|\.order-no/.test(outlineStyle));
assert.ok(!source.includes('id="gp-order-panel-serials-v1"'));
assert.ok(!source.includes("gpPanelSerialPresentation"));
assert.ok(rows[1].classList.contains("fros-row"));
assert.equal(JSON.stringify(w.fixtureOrders), before);
w.fixtureOrders[0].panels = [];
w.renderOrders();
assert.equal(
  w.document.querySelector("#otbody tr").hasAttribute("data-gp-panel-order"),
  false,
);
w.fixtureOrders[0].panels = ["سپهر"];
w.renderOrders();
const browserCheck = `<output id="outline-browser-result">pending</output><script>
try {
 const rows=document.querySelectorAll('#otbody tr');
 const green=getComputedStyle(rows[0].cells[0]);
 const blue=getComputedStyle(rows[1].cells[0]);
 if(green.backgroundColor!=='rgb(228, 247, 233)'||blue.backgroundColor!=='rgb(230, 242, 255)')throw Error('status_background_changed');
 for(const row of [rows[0],rows[1]])for(const cell of row.cells)if(!getComputedStyle(cell).boxShadow.includes('rgb(245, 130, 32)'))throw Error('missing_outline');
 if(!getComputedStyle(rows[0].cells[0]).boxShadow.includes('-1px 0px'))throw Error('missing_right_edge');
 if(!getComputedStyle(rows[0].cells[6]).boxShadow.includes('1px 0px'))throw Error('missing_left_edge');
 document.querySelector('#outline-browser-result').textContent='GP_PANEL_OUTLINE_PASS';
} catch(error) {document.querySelector('#outline-browser-result').textContent='GP_PANEL_OUTLINE_FAIL:'+error.message;}
</script>`;
fs.writeFileSync(
  __dirname + "/outline-browser.html",
  "<!doctype html>" +
    w.document.documentElement.outerHTML.replace(
      "</body>",
      browserCheck + "</body>",
    ),
);

w.close();
console.log(
  "ok: all row edges outlined; status backgrounds/text preserved; obsolete serial coloring removed; actions/data unchanged",
);
