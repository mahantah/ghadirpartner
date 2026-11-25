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
