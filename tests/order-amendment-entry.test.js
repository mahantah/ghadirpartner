const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../assets/order-followup.js"), "utf8");

test("the staff Edit button routes app purchases to amendments and keeps manual orders in the native editor", async () => {
  const calls = [];
  const window = {
    openOrderEdit: id => calls.push(["legacy", id]),
    openOrderDetails: (id, section) => calls.push(["details", id, section]),
  };
  const orders = [
    {id: 1, items: []},
    {id: 2, customer_id: 10, source: "customer", purchase_items: [{price_key: "sales_agent"}]},
    {id: 3, items: [{purchase_lines: [{}, {}]}]},
  ];
  vm.runInNewContext(source, {
    window, ORD: orders, has: role => role === "sales", document: {getElementById: () => null},
  });
  for (const {id} of orders) await window.openOrderEdit(id);
  assert.deepEqual(calls, [["legacy", 1], ["details", 2, "overview"], ["details", 3, "overview"]]);
});

test("the agent settlement overview offers only the available next action", async () => {
  class Element {
    constructor(tag) {
      this.tag = tag;
      this.children = [];
      this.dataset = {};
      this.classList = {add() {}};
      this.textContent = "";
    }

    append(...children) { this.children.push(...children); }
    prepend(...children) { this.children.unshift(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute() {}
    addEventListener(type, handler) { this[type] = handler; }
    contains(node) { return this === node || this.children.some(child => child.contains(node)); }
    find(predicate) { return predicate(this) ? this : this.children.map(child => child.find(predicate)).find(Boolean); }
    querySelector(selector) { return this.find(child => child.tag === selector) ?? null; }
  }

  for (const [finance, pending] of [[true, true], [false, true], [false, false]]) {
    const root = new Element("main");
    const overview = new Element('[data-od2-panel="overview"]');
    const payment = new Element('[data-od2-panel="payment"]');
    root.append(overview, payment);
    const window = {};
    const summary = {
      agent_settlement_review: {},
      agent_final_review: true,
      agent_cash_pending: pending,
      initial_payment: finance ? {cash_required: 300, cash_confirmed: 0, cash_remaining: 300} : null,
      correction: {status: "resubmitted", settlement_amounts: {cash_amount: 300}},
    };
    vm.runInNewContext(source, {
      window,
      has: role => role === "sales" || (role === "finance" && finance),
      document: {getElementById: () => null, createElement: tag => new Element(tag)},
      fetch: async () => ({ok: true, text: async () => JSON.stringify(summary)}),
    });
    await window.gpOrderFollowup.mount(root, 1, "overview");
    const hasButton = name => Boolean(overview.find(node => node.tag === "button" && node.textContent === name));
    assert.equal(hasButton("بررسی واریز"), finance && pending);
    assert.equal(hasButton("تأیید نهایی سفارش"), !pending);
    if (pending) {
      const message = finance ? "۳۰۰ تومان از واریز سفارش هنوز تأیید نشده است." : "امور مالی باید واریز سفارش را بررسی و تأیید کند.";
      assert(overview.find(node => node.textContent === message));
    }
  }
});
