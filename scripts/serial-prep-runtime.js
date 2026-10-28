// Continuous serial entry: preserve the existing status form and serialize mutations.
let gpPrepView = 0;
let gpPrepJobs = [];
let gpPrepWorking = false;
const gpPrepPending = new Set();
const gpPrepTimers = new Map();

function gpPrepLive(view) {
  return view === gpPrepView && !$('modal').classList.contains('hidden') &&
    $('modalbody').dataset.prepView === String(view);
}
function gpPrepMessage(idx, message, error = false) {
  const box = $('serialMessage_' + idx);
  if (box) { box.textContent = message; box.classList.toggle('msg', error); }
}
function gpPrepFailure(job, message) {
  const box = $('serialErrors_' + job.idx);
  if (!box) return;
  const row = document.createElement('div');
  row.textContent = (job.options.code ? job.options.code + ': ' : '') + message;
  box.appendChild(row);
}
function gpPrepCancelPending() {
  gpPrepView++;
  gpPrepJobs.forEach(job => gpPrepPending.delete(job.key));
  gpPrepJobs = [];
  gpPrepTimers.forEach(timer => clearTimeout(timer));
  gpPrepTimers.clear();
  if (typeof serialAutoTimers !== 'undefined') {
    Object.values(serialAutoTimers).forEach(timer => clearTimeout(timer));
    serialAutoTimers = {};
  }
}
const gpPrepOriginalStatus = window.saveStatus;
window.saveStatus = function () {
  if (gpPrepWorking || gpPrepJobs.length) {
    const message = $('modalbody').querySelector('[id^="serialMessage_"]');
    if (message) message.textContent = 'پس از پایان ثبت سریال‌های در صف، وضعیت را ثبت کنید.';
    return;
  }
  return gpPrepOriginalStatus.apply(this, arguments);
};
const gpPrepOriginalClose = window.closeModal;
window.closeModal = function () { gpPrepCancelPending(); return gpPrepOriginalClose.apply(this, arguments); };

function gpInitPrep(id) {
  gpPrepCancelPending();
  const body = $('modalbody');
  if (!body || $('modal').classList.contains('hidden')) return;
  body.dataset.prepView = String(gpPrepView);
  body.dataset.prepOrder = String(id);
  const order = ORD.find(order => Number(order.id) === Number(id));
  if (!order) return;
  (order.items || []).forEach((item, idx) => {
    const input = $('alloc_' + idx);
    if (!input) return;
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-label', 'اسکن سریال یا شماره کارتن ' + item.product);
    input.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      clearTimeout(gpPrepTimers.get(idx));
      window.allocateWarehouseCode(id, idx);
    });
    input.addEventListener('input', () => {
      clearTimeout(gpPrepTimers.get(idx));
      const value = input.value.trim().toUpperCase();
      const product = PROD.find(product => product.name === item.product);
      if (!product?.pattern || !value) return;
      try { if (!new RegExp(product.pattern).test(value)) return; } catch (_) { return; }
      const view = gpPrepView;
      gpPrepTimers.set(idx, setTimeout(() => {
        if (gpPrepLive(view) && input.value.trim().toUpperCase() === value) window.allocateWarehouseCode(id, idx);
      }, 320));
    });
    const browser = $('allocBrowser_' + idx);
    browser?.addEventListener('toggle', () => {
      const box = $('allocStock_' + idx);
      if (browser.open && box?.dataset.loaded !== '1') {
        box.dataset.loaded = '1';
        window.loadAllocationOptions(id, idx);
      }
    });
  });
  const first = body.querySelector('[id^="serialPanel_"]');
  if (first) { first.classList.remove('hidden'); first.querySelector('[id^="alloc_"]')?.focus(); }
}

async function gpSyncPrep(id, view) {
  await refresh();
  if (!gpPrepLive(view)) return;
  await ensureOrderSerialMeta(id);
  if (!gpPrepLive(view)) return;
  const order = ORD.find(order => Number(order.id) === Number(id));
  if (!order) return;
  const fragment = document.createElement('div');
  fragment.innerHTML = prepItems(order);
  (order.items || []).forEach((item, idx) => {
    for (const prefix of ['serialCount_', 'serialRegisteredCount_']) {
      const old = $(prefix + idx), next = fragment.querySelector('#' + prefix + idx);
      if (old && next) old.textContent = next.textContent;
    }
    for (const prefix of ['serialRegistered_', 'serialRemoveAll_']) {
      const old = $(prefix + idx), next = fragment.querySelector('#' + prefix + idx);
      if (old && next) old.innerHTML = next.innerHTML;
    }
    const box = $('allocStock_' + idx);
    if (box) box.dataset.loaded = '0';
    if ($('allocBrowser_' + idx)?.open) {
      box.dataset.loaded = '1';
      window.loadAllocationOptions(id, idx);
    }
  });
}

function gpQueuePrep(id, idx, path, payload, options = {}) {
  const view = gpPrepView;
  if (!gpPrepLive(view) || $('modalbody').dataset.prepOrder !== String(id)) return;
  const key = view + '|' + idx + '|' + path + '|' + (options.code || 'file');
  if (gpPrepPending.has(key)) {
    if (options.input?.value.trim().toUpperCase() === options.code) options.input.value = '';
    gpPrepMessage(idx, 'این سریال در صف ثبت است.'); return;
  }
  gpPrepPending.add(key);
  gpPrepJobs.push({ id, idx, path, payload, options, key, view });
  const input = options.input;
  if (input && input.value.trim().toUpperCase() === options.code) input.value = '';
  gpPrepMessage(idx, 'در صف ثبت؛ می‌توانید سریال بعدی را وارد کنید.');
  gpRunPrepJobs();
  return true;
}
async function gpRunPrepJobs() {
  if (gpPrepWorking) return;
  gpPrepWorking = true;
  try {
    while (gpPrepJobs.length) {
      const job = gpPrepJobs.shift();
      try {
        if (!gpPrepLive(job.view)) continue;
        gpPrepMessage(job.idx, 'در حال ثبت ' + (job.options.code || 'سریال‌ها') + '…');
        const response = await req(job.path, job.options.form
          ? { method: 'POST', body: job.payload }
          : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(job.payload) });
        // A confirmed write is never automatically repeated if the following read fails.
        try { await gpSyncPrep(job.id, job.view); }
        catch (_) { if (gpPrepLive(job.view)) gpPrepMessage(job.idx, 'ثبت انجام شد؛ دریافت شمارنده با تأخیر مواجه است.', true); continue; }
        if (!gpPrepLive(job.view)) continue;
        const errors = response?.errors || [];
        if (errors.length) gpPrepFailure(job, errors.join('، '));
        gpPrepMessage(job.idx, errors.length ? 'ثبت فایل انجام شد: ' + errors.join('، ') : 'ثبت شد' + (job.options.code ? ': ' + job.options.code : ''), errors.length > 0);
      } catch (error) {
        if (gpPrepLive(job.view)) {
          gpPrepMessage(job.idx, error.message || 'ثبت انجام نشد.', true);
          gpPrepFailure(job, error.message || 'ثبت انجام نشد.');
          const input = job.options.input;
          if (input?.isConnected && !input.value && !gpPrepJobs.length) input.value = job.options.code || '';
        }
      } finally { gpPrepPending.delete(job.key); }
    }
  } finally { gpPrepWorking = false; }
}
window.scanSerial = function (id, idx) {
  const order = ORD.find(order => Number(order.id) === Number(id)), item = order?.items?.[idx];
  const input = $('scan_' + idx), code = input?.value.trim().toUpperCase();
  const imei = $('imei_' + idx)?.value.trim() || '';
  if (!item || !code) return;
  if (imei && !/^\d{15}$/.test(imei)) { gpPrepMessage(idx, 'IMEI باید دقیقاً ۱۵ رقم باشد.', true); return; }
  clearTimeout(serialAutoTimers[idx]);
  if (gpQueuePrep(id, idx, '/api/scan', { id, product: item.product, serial: code, imei }, { input, code, kind: 'scan' })) $('imei_' + idx).value = '';
};
window.importOrderSerials = function (id, idx) {
  const order = ORD.find(order => Number(order.id) === Number(id)), file = $('sf_' + idx)?.files?.[0];
  if (!order || !file) return;
  const form = new FormData(); form.append('id', id); form.append('product', order.items[idx].product); form.append('file', file);
  gpQueuePrep(id, idx, '/api/order/serials/import', form, { form: true });
};
window.removeOrderSerial = function (id, product, serial) {
  if (!confirm('سریال ' + serial + ' از این سفارش حذف و به انبار آزاد برگردد؟')) return;
  const order = ORD.find(order => Number(order.id) === Number(id));
  gpQueuePrep(id, order?.items?.findIndex(item => item.product === product), '/api/order/serial/unassign', { id, product, serial }, { code: serial });
};
window.removeAllOrderSerials = function (id, product) {
  if (!confirm('تمام سریال‌های ارسال‌نشده مدل «' + product + '» از سفارش آزاد شوند؟')) return;
  const order = ORD.find(order => Number(order.id) === Number(id));
  gpQueuePrep(id, order?.items?.findIndex(item => item.product === product), '/api/order/serials/unassign-product', { id, product });
};
const gpPrepStyle = document.createElement('style');
gpPrepStyle.textContent = '.gp-prep-item{padding:12px!important;margin:8px 0!important}.gp-prep-head{display:flex;justify-content:space-between;align-items:center;gap:8px}.gp-prep-head b{font-size:13px}.gp-prep-entry{display:flex;gap:6px}.gp-prep-entry input{flex:1;min-width:0}.gp-prep-item details{border-top:1px solid #e5ebf2;margin-top:8px;padding-top:8px}.gp-prep-item summary{cursor:pointer;font-size:12px;color:#475569}.gp-prep-item .serial-list{max-height:180px;overflow:auto}.gp-prep-item .alloc-serials{max-height:210px;overflow:auto}.gp-prep-message{min-height:24px;font-size:12px;padding-top:5px}.gp-prep-item .toolbar input[type=file]{max-width:220px}@media(max-width:600px){.gp-prep-head{align-items:flex-start}.gp-prep-head>button{font-size:11px;padding:7px}.gp-prep-entry>button{padding:8px 10px}.gp-prep-item .toolbar{gap:6px}}';
document.head.appendChild(gpPrepStyle);
