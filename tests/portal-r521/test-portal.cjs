"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");
const source = fs
  .readFileSync(path.join(__dirname, "candidate/partners/portal.html"), "utf8")
  .replace(/<script\b[^>]*\bsrc=[^>]*><\/script>/g, "");

function setup(role) {
  const catalog = [
    {
      name: "مدل نمونه I90",
      manufacturer: "سازنده نمونه",
      available: true,
      stock: 100,
      prices: { serial_1_50: 1000, serial_51_200: 900, panel_cash: 1300 },
    },
  ];
  const orders = [
    {
      id: 7,
      number: "FIX-007",
      created_at: "2026-11-10 08:00:00",
      status: "تحویل شد",
      approval_status: "تأیید شده",
      payment_status: "تسویه کامل",
      items: [{ product: "مدل نمونه I90", qty: 1, line_total: 1000 }],
      estimated_total: 1000,
      approved_total: 1000,
    },
  ];
  const customer = {
    id: 10,
    name: "همکار نمونه",
    company: "شرکت نمونه",
    province: "تهران",
    city: "تهران",
    address: "نشانی آزمایشی",
    visible_price_groups: ["serial", "panel"],
  };
  const account = {
    username: "fixture",
    roles: [role],
    customer_id: role === "customer" ? 10 : 0,
    customer,
  };
  window.fixture = { writes: [], catalog, orders };
  window.alert = (message) => {
    throw new Error(String(message));
  };
  window.confirm = () => true;
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.requestAnimationFrame ??= (callback) => setTimeout(callback, 0);
  if (!window.HTMLDialogElement.prototype.showModal) {
    window.HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    window.HTMLDialogElement.prototype.close = function () {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    };
  }
  window.fetch = async (url, options = {}) => {
    const endpoint = String(url).slice(String(url).indexOf("/api/"));
    let data;
    if (options.method === "POST") {
      const body = JSON.parse(options.body || "{}");
      window.fixture.writes.push({ endpoint, body });
      if (endpoint === "/api/orders/add") {
        const order = {
          ...orders[0],
          id: 8,
          number: "FIX-008",
          status: "در انتظار تأیید سفارش",
          approval_status: "در انتظار تأیید",
          items: body.items,
        };
        orders.push(order);
        data = order;
      } else if (endpoint === "/api/notifications/read") data = { ok: true };
      else throw new Error("unexpected write " + endpoint);
    } else {
      const responses = {
        "/api/bootstrap": {
          me: account,
          catalog,
          orders,
          customers: [customer],
          offers: [
            {
              id: 4,
              title: "قدیر میکس نمونه",
              description: "طرح آزمایشی",
              promo_code: "FIX10",
              discount_type: "percent",
              discount_value: 10,
            },
          ],
        },
        "/api/reports/customer-summary": {
          week: {},
          month: { amount: 24000, orders: 2, qty: 3 },
          three_months: {},
        },
        "/api/addresses": [
          {
            id: "saved-a",
            title: "دفتر نمونه",
            province: "تهران",
            city: "تهران",
            address: "نشانی دفتر",
          },
        ],
        "/api/customer-credit": {
          enabled: true,
          available: 100000,
          credit_commitment: "تعهد آزمایشی",
          credit_commitment_sha256: "test-sha",
        },
        "/api/notifications": {
          items: [
            {
              id: "n-1",
              title: "اعلان آزمایشی",
              body: "توضیحات",
              order_id: 7,
              read: false,
            },
          ],
        },
        "/api/accounts": [],
        "/api/sms/outbox": [],
        "/api/me": account,
      };
      data = responses[endpoint];
      if (data === undefined) throw new Error("unexpected read " + endpoint);
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => JSON.parse(JSON.stringify(data)),
    };
  };
}

async function exercise(role, realBrowser) {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const by = (id) => document.getElementById(id);
  const wait = async (predicate, message) => {
    for (let n = 0; n < 150; n++) {
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    throw new Error(message);
  };
  const change = (node, event = "input") =>
    node.dispatchEvent(new Event(event, { bubbles: true }));
  await wait(() => !by("app").classList.contains("hidden"), "bootstrap_failed");
  if (role !== "customer") {
    assert(!document.body.dataset.r521, "staff_customer_ui");
    assert(!by("r521-stage-0"), "staff_checkout_replaced");
    return;
  }
  await wait(
    () => document.body.dataset.r521 === "5.4.3.3-r5.21",
    "customer_mount_failed",
  );
  assert(by("r521-greeting").textContent.includes("همکار نمونه"), "greeting");
  const tabs = [
    ...document.querySelectorAll("#nav button[data-page]:not(.adminOnly)"),
  ].map((node) => node.dataset.page);
  assert(
    tabs.join(",") === "dashboard,catalog,newOrder,orders,profilePage",
    "navigation_order",
  );
  if (realBrowser) {
    const faces = await document.fonts.load(
      '400 16px "Portal Vazirmatn"',
      "قدیر",
    );
    assert(faces.length === 1, "native_font");
    const nav = getComputedStyle(by("nav"));
    assert(
      nav.position === "fixed" && nav.display === "grid",
      "responsive_navigation",
    );
    assert(
      innerWidth < 600
        ? nav.gridTemplateColumns.split(" ").length === 5
        : nav.gridTemplateColumns.split(" ").length === 1,
      "responsive_column_count",
    );
    assert(
      document.documentElement.scrollWidth <= innerWidth + 1,
      "page_horizontal_overflow",
    );
  }
  document.querySelector('[aria-label="حالت روز و شب"]').click();
  assert(document.documentElement.dataset.r521Theme === "dark", "dark_mode");
  document.querySelector('[aria-label="حالت روز و شب"]').click();
  document.querySelector('[aria-label="اعلان‌ها"]').click();
  await wait(
    () => by("r521-inbox-list").textContent.includes("اعلان آزمایشی"),
    "notification_load",
  );
  document.querySelector('#nav [data-page="catalog"]').click();
  assert(
    by("r521-catalog-list").textContent.includes("مدل نمونه I90"),
    "catalog_card",
  );
  by("r521-catalog-search").value = "nomatch";
  change(by("r521-catalog-search"));
  assert(
    by("r521-catalog-list").textContent.includes("پیدا نشد"),
    "catalog_filter",
  );
  by("r521-catalog-search").value = "";
  change(by("r521-catalog-search"));
  by("r521-catalog-list").querySelector("button").click();
  const row = [...document.querySelectorAll("#orderItems .form-row")].find(
    (el) => el.querySelector(".prod").value,
  );
  assert(row, "catalog_to_checkout");
  const qty = row.querySelector(".qty");
  qty.value = "60";
  change(qty);
  assert(
    row.querySelector(".price-key").value === "serial_51_200",
    "serial_tier",
  );
  assert(
    row.isConnected &&
      row.querySelector(".r521-line").textContent.includes("سازنده نمونه"),
    "stable_order_line",
  );
  by("r521-next").click();
  await wait(() => !by("r521-checkout-error").hidden, "invoice_validation");
  const invoice = document.querySelector(
    '[name="invoiceType"][value="غیررسمی"]',
  );
  invoice.checked = true;
  change(invoice, "change");
  assert(
    localStorage.getItem("gp-r521-cart:10").includes("serial_51_200"),
    "account_draft",
  );
  by("r521-next").click();
  await wait(
    () =>
      !by("r521-stage-1").hidden &&
      by("r521-address-select").options.length > 1,
    "delivery_step",
  );
  by("r521-address-select").value = "saved-a";
  change(by("r521-address-select"), "change");
  assert(
    by("r521-address-text").textContent.includes("نشانی دفتر"),
    "address_selection",
  );
  by("r521-check-on").checked = true;
  change(by("r521-check-on"), "change");
  assert(
    by("r521-payee").textContent.includes("سلمان بور بور"),
    "informal_payee",
  );
  by("r521-cash").value = "۲۴۰۰۰";
  change(by("r521-cash"));
  by("r521-check").value = "۳۰۰۰۰";
  change(by("r521-check"));
  by("r521-check-number").value = "۱۲۳۴۵۶۷۸۹۰۱۲۳۴۵۶";
  by("r521-bank").value = "ملت";
  by("r521-calendar-action").querySelector("button").click();
  const day = document.querySelector(".r521-date-grid button");
  assert(day, "jalali_calendar");
  day.click();
  assert(/^\d{4}\/\d{2}\/\d{2}$/.test(by("r521-due").value), "jalali_due_date");
  by("r521-next").click();
  await wait(() => !by("r521-stage-2").hidden, "review_step");
  assert(window.fixture.writes.length === 0, "premature_order_write");
  assert(
    by("r521-stage-2").textContent.includes("نشانی دفتر"),
    "review_address",
  );
  by("r521-next").click();
  by("r521-next").click();
  await wait(
    () => by("r521-confirmation")?.textContent.includes("FIX-008"),
    "order_confirmation",
  );
  assert(window.fixture.writes.length === 1, "duplicate_submission");
  const { endpoint, body } = window.fixture.writes[0];
  assert(
    endpoint === "/api/orders/add" &&
      body.address_id === "saved-a" &&
      body.requested_payment_method === "mixed",
    "checkout_api_contract",
  );
  assert(
    body.items[0].qty === 60 && body.items[0].price_key === "serial_51_200",
    "checkout_line_contract",
  );
  assert(
    body.settlement_details.check_number === "1234567890123456" &&
      body.settlement_details.cash_amount === 24000 &&
      body.settlement_details.check_amount === 30000,
    "mixed_settlement_contract",
  );
  assert(!localStorage.getItem("gp-r521-cart:10"), "submitted_draft_cleared");
  document.querySelector('#nav [data-page="profilePage"]').click();
  [...by("profilePage").querySelectorAll("button")]
    .find((x) => x.textContent === "اسناد و پیش‌فاکتورها")
    .click();
  assert(
    by("r521-documents-page-list")
      .querySelector("a")
      .href.includes("pdf/order-details"),
    "invoice_navigation",
  );
}

(async () => {
  const bootstrap = (role) =>
    `<script>(${setup.toString()})(${JSON.stringify(role)});</script>`;
  for (const role of ["customer", "admin"]) {
    const issues = [];
    const console = new VirtualConsole();
    console.on("jsdomError", (error) => issues.push(error.message));
    const dom = new JSDOM(
      source.replace("<head>", "<head>" + bootstrap(role)),
      {
        url: "https://fixture.invalid/partners/",
        pretendToBeVisual: true,
        runScripts: "dangerously",
        virtualConsole: console,
      },
    );
    try {
      await dom.window.eval(
        `(${exercise.toString()})(${JSON.stringify(role)},false)`,
      );
      if (issues.length) throw new Error(issues.join(" | "));
    } finally {
      dom.window.close();
    }
  }
  const browser = `<output id="fixture-result">pending</output><script>(${exercise.toString()})('customer',true).then(()=>document.querySelector('#fixture-result').textContent='GP_PORTAL_R521_PASS').catch(error=>document.querySelector('#fixture-result').textContent='GP_PORTAL_R521_FAIL:'+error.message);</script>`;
  fs.writeFileSync(
    path.join(__dirname, "browser.html"),
    source
      .replace("<head>", "<head>" + bootstrap("customer"))
      .replace("</body>", browser + "</body>"),
  );
  console.log(
    "ok: customer and staff entry, catalog, theme, notifications, Tehran draft, three checkout stages, address, Jalali date, mixed payment, single submit and documents",
  );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
