/* GP_NUMBER_COUNTER_V1_20261025 */
(function () {
  'use strict';
  if (window.__gpNumberCounterV1) return;
  window.__gpNumberCounterV1 = true;

  var SELECTOR = [
    '#dall', '#dprep', '#dready', '#dsent', '#dcancel',
    '#dashSalesTotal',
    '#salesTotalAmount', '#salesTotalOrders', '#salesTotalQty',
    '#repCount', '#whCount', '#whLabelCount',
    '.metric-value',
    '.sales-kpi b',
    '.wh-kpi b',
    '.gp-wh-live-stats strong',
    '#warehouseLedgerSummary b',
    '#warehouseLedgerSummary strong',
    '#stocktakeTotals h2',
    '#stocktakeTotals .mutedbox h2',
    '.shipping-alert-main b',
    '.status-row > span',
    '#offerCustomerResultCount',
    '#offerCustomerSelectedCount'
  ].join(',');
  var last = {};
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function faDigit(ch) {
    var i = '۰۱۲۳۴۵۶۷۸۹'.indexOf(ch);
    if (i >= 0) return String(i);
    i = '٠١٢٣٤٥٦٧٨٩'.indexOf(ch);
    return i >= 0 ? String(i) : ch;
  }

  function toEn(text) {
    return String(text || '').replace(/[۰-۹٠-٩]/g, faDigit).replace(/٬/g, ',');
  }

  function parseDisplay(text) {
    var raw = String(text || '');
    var en = toEn(raw);
    if (/\d{4}\/\d{1,2}(\/\d{1,2})?/.test(en)) return null;
    if (/\d{2}:\d{2}/.test(en)) return null;
    var m = en.match(/-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/);
    if (!m) return null;
    var digits = m[0].replace(/,/g, '');
    if (/^0\d{9,}$/.test(digits)) return null;
    var value = Number(digits);
    if (!isFinite(value) || Math.abs(value) > 1e12) return null;
    var start = m.index;
    var prefix = en.slice(0, start);
    var suffix = en.slice(start + m[0].length);
    var origPrefix = raw.slice(0, start);
    var origSuffix = raw.slice(start + m[0].length);
    return {
      value: value,
      prefix: origPrefix,
      suffix: origSuffix,
      fa: /[۰-۹]/.test(raw) || /تومان|دستگاه|سفارش|سریال/.test(raw)
    };
  }

  function formatNum(value, parsed) {
    var n = parsed.value % 1 === 0 ? Math.round(value) : Number(value.toFixed(1));
    return parsed.fa ? n.toLocaleString('fa-IR') : n.toLocaleString('en-US');
  }

  function keyOf(el) {
    if (el.id) return 'id:' + el.id;
    var row = el.closest('.status-row');
    if (row) return 'status:' + String((row.querySelector('b') || {}).textContent || '');
    var card = el.closest('.metric, .sales-kpi, .wh-kpi, .gp-wh-live-card, .mutedbox, .shipping-alert-main');
    if (card) {
      var label = card.querySelector('.metric-label, small, .small, span');
      if (label && label !== el) return 'lbl:' + String(label.textContent || '').trim();
    }
    return 'el:' + (el.className || '') + ':' + String(el.textContent || '').slice(0, 24);
  }

  function ease(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function write(el, parsed, value) {
    el.__gpCounting = true;
    el.textContent = parsed.prefix + formatNum(value, parsed) + parsed.suffix;
    el.__gpCounting = false;
  }

  function animate(el, from, parsed) {
    var to = parsed.value;
    last[keyOf(el)] = to;
    el.__gpCountVal = to;
    if (reduce || from === to) {
      write(el, parsed, to);
      return;
    }
    if (el.__gpCountRaf) cancelAnimationFrame(el.__gpCountRaf);
    var start = performance.now();
    var dur = Math.max(520, Math.min(1100, 420 + Math.abs(to - from) * 4));
    function frame(now) {
      var t = Math.min(1, (now - start) / dur);
      write(el, parsed, from + (to - from) * ease(t));
      if (t < 1) el.__gpCountRaf = requestAnimationFrame(frame);
      else write(el, parsed, to);
    }
    el.__gpCountRaf = requestAnimationFrame(frame);
  }

  function kick(el) {
    if (!el || el.__gpCounting || el.closest('.jdate-pop, .gp-cal, input, textarea, select')) return;
    var parsed = parseDisplay(el.textContent);
    if (!parsed) return;
    var from = el.__gpCountVal;
    if (from == null) from = last[keyOf(el)];
    if (from == null) from = 0;
    if (from === parsed.value && String(el.textContent).indexOf(formatNum(parsed.value, parsed)) >= 0) return;
    animate(el, from, parsed);
  }

  function scan(root) {
    (root || document).querySelectorAll(SELECTOR).forEach(kick);
  }

  function watch(root) {
    if (!root || root.__gpCountObserved) return;
    root.__gpCountObserved = true;
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        var el = m.target.nodeType === 3 ? m.target.parentElement : m.target;
        if (!el || el.__gpCounting) return;
        if (el.matches && el.matches(SELECTOR)) kick(el);
        else if (el.querySelectorAll) scan(el);
      });
    }).observe(root, { childList: true, characterData: true, subtree: true });
  }

  function wrap(name) {
    var fn = window[name];
    if (typeof fn !== 'function' || fn.__gpCountWrap) return;
    var wrapped = function () {
      var r = fn.apply(this, arguments);
      if (r && typeof r.then === 'function') return r.then(function (v) { requestAnimationFrame(function () { scan(document); }); return v; });
      requestAnimationFrame(function () { scan(document); });
      return r;
    };
    wrapped.__gpCountWrap = true;
    window[name] = wrapped;
  }

  if (!document.getElementById('gp-number-counter-css')) {
    var css = document.createElement('style');
    css.id = 'gp-number-counter-css';
    css.textContent = '.metric-value,.sales-kpi b,.wh-kpi b,.gp-wh-live-stats strong,#dashSalesTotal{font-variant-numeric:tabular-nums}';
    document.head.appendChild(css);
  }

  ['renderDash', 'renderDashboardRecentOrders', 'loadDashboardSalesPreview', 'loadSalesReports', 'renderWarehouseLedger', 'renderSeparateWarehouseLiveSummary', 'renderShippingAlert'].forEach(wrap);
  watch(document.body);
  scan(document);
  setTimeout(function () { scan(document); }, 400);
  setTimeout(function () { scan(document); }, 1200);

  window.gpParseDisplayNumber = parseDisplay;
  window.gpKickNumberCounter = scan;
})();
