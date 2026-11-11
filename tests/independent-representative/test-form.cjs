"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const source = fs.readFileSync(
  path.join(__dirname, "candidate/app.html"),
  "utf8",
);
const assets = new Set([
  "menu-live-v3.js",
  "coop-model-v1.js",
  "customer-form-polish-v1.js",
  "customer-ops-stabilize-v1.js",
]);

(async () => {
  const dom = new JSDOM(source, {
    url: "https://fixture.invalid/",
    runScripts: "outside-only",
  });
  try {
    const w = dom.window;
    const doc = w.document;
    const by = (id) => doc.getElementById(id);
    const timers = [];
    const observers = [];
    w.setTimeout = (callback, delay) => timers.push({ callback, delay });
    w.setInterval = () => 0;
    w.MutationObserver = class {
      constructor(callback) {
        observers.push(callback);
      }
      observe() {}
      disconnect() {}
    };
    w.has = () => true;
    w.refresh = async () => {};
    w.CUST = [{ id: 42, name: "بازاریاب نمونه", is_marketer: true }];
    const saved = [];
    w.fetch = async (url, options = {}) => {
      let result = w.CUST;
      if (url === "/api/customers/add" && options.method === "POST") {
        const payload = JSON.parse(options.body);
        saved.push(payload);
        result = { ...payload, id: 100 + saved.length, code: "FIXTURE" };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => result,
      };
    };
    for (const script of doc.querySelectorAll("script[src]")) {
      const ref = new URL(script.src);
      const name = ref.pathname.split("/").pop();
      if (!assets.has(name)) continue;
      assert.equal(ref.searchParams.get("repfix"), "20261111");
      assets.delete(name);
      w.eval(
        fs.readFileSync(
          path.join(__dirname, "candidate", ref.pathname.slice(1)),
          "utf8",
        ),
      );
    }
    assert.equal(assets.size, 0);
    const runLateWork = () => {
      for (const callback of observers) callback([]);
      for (const entry of timers.splice(0).sort((a, b) => a.delay - b.delay))
        entry.callback();
      assert.equal(
        w.addCustomer.__gpStab1,
        true,
        "delayed fallback took over registration",
      );
      assert.equal(by("addCustomerBtn").onclick, w.addCustomer);
    };
    runLateWork();
    const role = by("gpRepRole");
    const select = (channel, value) => {
      const input = doc.querySelector(
        `#gpChannelBox input[name="gpChannel"][value="${channel}"]`,
      );
      role.value = "";
      input.checked = false;
      input.click();
      if (value !== undefined) {
        role.value = value;
        role.dispatchEvent(new w.Event("change", { bubbles: true }));
      }
    };
    const submit = async () => {
      by("cn").value = "مشتری نمونه";
      await by("addCustomerBtn").onclick();
    };
    select("rep");
    assert.equal(role.value, "rep");
    assert.match(role.selectedOptions[0].textContent, /نماینده مستقل/);
    role.value = "";
    await submit();
    assert.equal(saved.length, 1);
    assert.equal(saved[0].rep_role, "rep");
    assert.equal(saved[0].is_marketer, false);
    assert.equal(saved[0].parent_marketer_id, 0);
    assert.equal(saved[0].sales_channel, "rep");
    assert.deepEqual(saved[0].visible_price_groups, ["panel", "serial"]);
    assert.match(by("caddmsg").textContent, /ثبت شد/);
    runLateWork();
    select("rep", "marketer");
    await submit();
    assert.equal(saved[1].rep_role, "marketer");
    assert.equal(saved[1].is_marketer, true);
    select("rep", "sub");
    by("gpRepParent").value = "";
    await submit();
    assert.equal(saved.length, 2, "a subordinate requires a selected marketer");
    by("gpRepParent").append(new w.Option("بازاریاب نمونه", "42"));
    by("gpRepParent").value = "42";
    await submit();
    assert.equal(saved[2].rep_role, "sub");
    assert.equal(saved[2].parent_marketer_id, 42);
    select("agent");
    await submit();
    assert.equal(saved[3].rep_role, "agent");
    assert.equal(saved[3].parent_marketer_id, 0);
    await submit();
    assert.equal(saved.length, 4, "unselected channel must not register");
    console.log(
      "ok: independent representative, delayed handlers, marketer, subordinate and sales agent",
    );
  } finally {
    dom.window.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
