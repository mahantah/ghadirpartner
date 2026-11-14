const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const root = process.argv[2];
const readAsset = (name) => fs.readFileSync(root + "/assets/" + name, "utf8");
const id = "gpPortalReportsMenu";
const sales = {};
const reports = {};
const unrelated = {};
const discarded = [];
const destinations = {
  gpNavDump: {
    appendChild(element) {
      nav.children.splice(nav.children.indexOf(element), 1);
      discarded.push(element);
    },
  },
};
const nav = {
  children: [reports, unrelated],
  querySelector(selector) {
    if (selector === ':scope > [data-tab="salesReports"]') return this.children.includes(sales) ? sales : null;
    if (selector === ":scope > #" + id) return this.children.includes(reports) ? reports : null;
    return null;
  },
  querySelectorAll() { return []; },
  appendChild(element) {
    this.children.splice(this.children.indexOf(element), 1);
    this.children.push(element);
  },
};
const document = {
  readyState: "complete",
  head: { appendChild() {} },
  createElement() { return {}; },
  getElementById: (key) => destinations[key],
  querySelector: (selector) => selector === ".topnav" ? nav : null,
};
const window = { applyPermissionVisibility() {} };
const delayed = [];
vm.runInNewContext(readAsset("menu-live-v4.js"), {
  document, window, setTimeout: (callback) => delayed.push(callback),
});
for (const refresh of [window.applyPermissionVisibility, ...delayed]) refresh();
assert.deepEqual(nav.children, [reports]);
assert.deepEqual(discarded, [unrelated]);
for (const name of ["ui-v53435-menu2.js", "nav-restructure-v1.js"]) {
  assert.match(readAsset(name), /nav\.querySelector\(':scope > #gpPortalReportsMenu'\) \|\| nav\.querySelector\(':scope > \[data-tab="salesReports"\]'\)/);
}
assert.match(readAsset("portal-phase-two-navigation.js"), /reportMenu\.append\(sales\)/);
assert.match(readAsset("portal-phase-two-navigation.js"), /"gpPortalActivityPage", [^\n]+, reportMenu\]/);
assert.match(readAsset("portal-phase-two-navigation.js"), /"gpPortalMessagesPage", [^\n]+, customerMenu\]/);
console.log("Portal reports menu remains in the sidebar after permission refreshes.");
