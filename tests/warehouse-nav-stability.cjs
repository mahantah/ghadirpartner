const { JSDOM, ResourceLoader, VirtualConsole } = require("jsdom");
const fs = require("fs"),
  path = require("path");
const root = process.env.GP_OWNER_SOURCE;
if (!root)
  throw Error("GP_OWNER_SOURCE is required; use the private owner source only");
class Loader extends ResourceLoader {
  fetch(url) {
    let p = new URL(url).pathname;
    let f = path.join(root, p);
    if (fs.existsSync(f) && fs.statSync(f).isFile())
      return Promise.resolve(fs.readFileSync(f));
    return null;
  }
}
const errors = [],
  requests = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => {
  if (!e.message.includes("CSS stylesheet")) errors.push(e.message);
});
const admin = {
  id: 1,
  username: "fixture",
  roles: ["admin", "sales", "prep", "finance"],
};
const product = { name: "TEST I90", serial_required: true, prices: {} };
const core = {
  me: admin,
  products: [product],
  customers: [{ id: 1, name: "Fixture customer", code: "FIXTURE" }],
  orders: [
    {
      id: 1,
      number: "FIXTURE-001",
      customer_id: 1,
      customer_name: "Fixture customer",
      status: "ارسال شد",
      created_at: "2026-10-28 09:00:00",
      updated_at: "2026-10-28 09:00:00",
      items: [{ product: product.name, qty: 1, serials: ["SHIPPED-SN"] }],
      exit_items: [{ product: product.name, qty: 1, serials: ["SHIPPED-SN"] }],
      history: [
        {
          at: "2026-10-28 09:00:00",
          by: "fixture",
          action: "وضعیت به «ارسال شد» تغییر کرد",
        },
      ],
    },
  ],
};
const wh = {
  warehouses: [
    { id: 1, name: "انبار عمده" },
    { id: 2, name: "خرده" },
  ],
  products: [product],
  baseline: [],
  movements: [],
  current: { 1: { "TEST I90": 1 } },
  free: { 1: { "TEST I90": 1 } },
  reserved: {},
  cartons: [
    {
      id: 1,
      code: "TEST-001",
      product: product.name,
      serials: ["TESTSN"],
      capacity: 1,
    },
  ],
  inventory: [
    {
      id: 1,
      serial: "TESTSN",
      product: product.name,
      carton_id: 1,
      warehouse_id: 1,
    },
  ],
  connected: true,
};
const dom = new JSDOM(fs.readFileSync(root + "/app.html", "utf8"), {
  url: "https://fixture.test/",
  runScripts: "dangerously",
  resources: new Loader(),
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(w) {
    // Isolate DOM-driven requests from legitimate 30/60-second live refreshes.
    const originalInterval = w.setInterval.bind(w);
    w.setInterval = (fn, ms, ...args) =>
      ms >= 10000 ? 0 : originalInterval(fn, ms, ...args);
    w.fetch = async (url) => {
      requests.push(String(url));
      let p = String(url).split("?")[0];
      let data =
        p === "/api/bootstrap"
          ? core
          : p === "/api/me"
            ? admin
            : p === "/api/warehouses" || p === "/api/warehouse"
              ? wh
              : p === "/api/inventory/overview"
                ? {
                    groups: [{ key: "free", name: "Fixture stock", count: 1 }],
                    total: 1,
                    free: 1,
                    assigned: 0,
                  }
                : p === "/api/reports/sales"
                  ? { series: [], totals: {} }
                  : p === "/api/catalog"
                    ? [product]
                    : [];
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => data,
        text: async () => JSON.stringify(data),
      };
    };
    w.alert = (m) => errors.push("ALERT " + m);
    w.matchMedia = () => ({
      matches: process.env.GP_TEST_MOBILE === "1",
      addEventListener() {},
      removeEventListener() {},
    });
    w.ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
    w.scrollTo = () => {};
  },
});
const assert = require("assert/strict");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
setTimeout(async () => {
  try {
    const w = dom.window;
    assert(!w.document.getElementById("app").classList.contains("hidden"));
    for (let i = 0; i < 3; i++) {
      const b = w.document.querySelector(
        "#warehouseNavGroup .nav-group-toggle",
      );
      b.click();
      assert(
        w.document
          .getElementById("warehouseNavGroup")
          .classList.contains("open"),
      );
      await pause(250);
      assert(
        w.document
          .getElementById("warehouseNavGroup")
          .classList.contains("open"),
      );
      b.click();
      assert(
        !w.document
          .getElementById("warehouseNavGroup")
          .classList.contains("open"),
      );
    }
    for (const tab of [
      "warehouseDaily",
      "reports",
      "warehouse",
      "inventory",
      "stocktake",
    ]) {
      w.document
        .querySelector('#warehouseNavGroup [data-tab="' + tab + '"]')
        .click();
      await pause(350);
      const sec = w.document.getElementById(tab);
      assert(
        !sec.classList.contains("hidden") && !sec.hidden,
        tab + " must be visible",
      );
      assert.equal(
        w.document.querySelectorAll(".tab:not(.hidden)").length,
        1,
        "only one active page",
      );
      if (tab === "warehouseDaily")
        assert(
          w.document
            .getElementById("warehouseLedgerSummary")
            .textContent.includes("۱ دستگاه"),
        );
      if (tab === "reports")
        assert(
          w.document
            .getElementById("repBody")
            .textContent.includes("FIXTURE-001"),
          "shipped report row missing",
        );
      if (tab === "warehouse")
        assert(
          w.document
            .getElementById("warehouseBody")
            .textContent.includes("TEST-001"),
          "carton row missing",
        );
      if (tab === "inventory")
        assert(
          w.document
            .getElementById("inventoryGroups")
            .textContent.includes("Fixture stock"),
          "inventory group missing",
        );
    }
    w.show("warehouseDaily");
    await pause(500);
    let navChanges = 0;
    const obs = new w.MutationObserver((ms) => {
      navChanges += ms.length;
    });
    obs.observe(w.document.querySelector(".topnav"), {
      childList: true,
      subtree: true,
    });
    const before = requests.length;
    const labels = Array.from(
      w.document.querySelectorAll("#warehouseNavGroup .gp-menu-text"),
    )
      .map((x) => x.textContent)
      .join("|");
    await pause(1500);
    assert.equal(
      navChanges,
      0,
      "idle navigation must not keep rewriting itself",
    );
    assert.equal(
      requests.length,
      before,
      "idle DOM changes must not trigger warehouse API polling",
    );
    assert.equal(
      labels,
      Array.from(
        w.document.querySelectorAll("#warehouseNavGroup .gp-menu-text"),
      )
        .map((x) => x.textContent)
        .join("|"),
    );
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log(
      "PASS: menu toggles, single visible tab, warehouse/report/serial data, idle stability, no extra API requests",
    );
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    dom.window.close();
  }
}, 5500);
