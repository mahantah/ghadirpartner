// Exercise the actual patched view function, with no real account or API calls.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(process.argv[2], 'utf8');
const start = source.indexOf('function portalAdminView(key){');
const end = source.indexOf('\norganizePortalAdmin();', start);
assert(start >= 0 && end > start, 'Expected portal view function');
for (const [name, me, admin, hidden, expected] of [
  ['visitor', null, false, true, 0],
  ['admin before opening portal', {}, true, true, 0],
  ['non-admin', {}, false, false, 0],
  ['admin viewing portal', {}, true, false, 1],
]) {
  for (const key of ['accounts', 'resets', 'offers', 'sms']) {
    let calls = 0;
    const load = () => { calls++; };
    const context = {ME: me, has: () => admin, window: {},
      portalSection: {querySelectorAll: () => [], classList: {contains: () => hidden}},
      loadRegistrationRequests: load, loadPasswordResetRequests: load,
      loadPortalOffers: load, loadPortalAdmin: load, loadSmsTemplates: load,
      loadAdminOrderSmsSettings: load};
    vm.runInNewContext(source.slice(start, end) + '\nportalAdminView(' + JSON.stringify(key) + ')', context);
    assert.equal(calls, expected * (key === 'sms' ? 3 : 1), `${name}: ${key}`);
  }
}
console.log('PASS: 16 portal startup/access scenarios');
