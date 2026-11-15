const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const root = process.argv[2];
const app = fs.readFileSync(root + "/app.html", "utf8");
const stylesheet = fs.readFileSync(root + "/assets/production-login-v1.css", "utf8");
const session = fs.readFileSync(root + "/assets/session-keep-v1.js", "utf8");
assert.doesNotMatch(stylesheet, /IRANSansWeb\.woff2/);
assert.match(stylesheet, /Vazirmatn\.woff2/);
assert.doesNotMatch(app, /-webkit-text-size-adjust:100%/);

(async () => {
  const calls = [];
  const context = vm.createContext({
    document: { getElementById: () => null, readyState: "complete" },
    setTimeout() {},
    fetch() { throw new Error("Unexpected session probe"); },
    calls,
  });
  vm.runInContext(`
    var window = globalThis;
    let ME = null;
    let lastNotif = 0;
    function showSessionExpired() { ME = null; }
    async function req(url) {
      calls.push(url);
      throw Object.assign(new Error("Expired"), { status: 401 });
    }
  `, context);
  vm.runInContext(app.match(/^async function pollNotif\(\).*$/m)[0], context);
  vm.runInContext(session, context);
  await vm.runInContext("pollNotif()", context);
  assert.deepEqual(calls, []);
  await vm.runInContext("ME = { id: 1 }; pollNotif()", context);
  assert.equal(vm.runInContext("ME", context), null);
  await vm.runInContext("pollNotif()", context);
  assert.deepEqual(calls, ["/api/notifications?since=0"]);
  console.log("Login font fallback and expired session notification guard passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
