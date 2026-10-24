const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const script = fs.readFileSync('assets/production-order-details-bridge-v1.js', 'utf8');

function fixture(fail = false) {
  const calls = [];
  const classes = new Set(['od2-overlay']);
  const drawer = {
    classList: { remove: name => calls.push('remove:' + name) },
    removeAttribute: name => calls.push('attribute:' + name),
  };
  const overlay = {
    classList: { remove: name => classes.delete(name) },
    querySelector: selector => selector === '.od2-drawer' ? drawer : null,
  };
  const legacyOpen = async id => { calls.push('legacy:' + id); };
  const legacyClose = () => {};
  const visualOpen = (id, section) => {
    calls.push('visual:' + id + ':' + section);
    if (fail) throw new Error('synthetic renderer failure');
  };
  const window = {
    __gpOdLegacy: { open: legacyOpen, close: legacyClose },
    openOrderDetails: visualOpen,
    closeOrderDetails: () => {},
    gpOdQuickHtml: () => '',
    orderItemSerials: () => [],
    ensureOrderSerialMeta: async id => { calls.push('serials:' + id); },
  };
  const document = {
    body: { style: { overflow: 'auto' } },
    getElementById: id => id === 'orderDetailOverlay' ? overlay : null,
  };
  vm.runInNewContext(script, { window, document });
  return { window, document, calls, classes, legacyOpen, visualOpen };
}

(async () => {
  const normal = fixture();
  assert.strictEqual(normal.window.__gpOdUiReady, true);
  await normal.window.openOrderDetails(12, 'payment');
  assert.deepStrictEqual(normal.calls, ['serials:12', 'visual:12:payment']);

  const failed = fixture(true);
  await failed.window.openOrderDetails(13, 'shipping');
  assert.deepStrictEqual(failed.calls.slice(0, 3),
    ['serials:13', 'visual:13:shipping', 'remove:od2-drawer']);
  assert(failed.calls.includes('legacy:13'));
  assert(!failed.classes.has('od2-overlay'));
  assert.strictEqual(failed.window.openOrderDetails, failed.legacyOpen);
  assert.strictEqual(failed.document.body.style.overflow, 'auto');
  console.log('PASS: serial hydration precedes V2 and visual errors fall back safely');
})().catch(error => { console.error(error); process.exitCode = 1; });
