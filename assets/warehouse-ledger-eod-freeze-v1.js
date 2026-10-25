/* GP_LEDGER_EOD_FREEZE_V1_20261025 */
(function () {
  'use strict';
  if (window.__gpLedgerEodFreezeV1) return;
  window.__gpLedgerEodFreezeV1 = true;

  var STORE = 'gp-ledger-eod-v1';

  function pad(n) { return String(n).padStart(2, '0'); }

  function todayJalali() {
    var y, m, d;
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date());
      var map = {};
      parts.forEach(function (p) { map[p.type] = p.value; });
      y = +map.year; m = +map.month; d = +map.day;
    } catch (e) {
      var now = new Date();
      y = now.getFullYear(); m = now.getMonth() + 1; d = now.getDate();
    }
    var j = (typeof g2j === 'function') ? g2j(y, m, d) : [y, m, d];
    return j[0] + '/' + pad(j[1]) + '/' + pad(j[2]);
  }

  function movementJalali(mv) {
    if (!mv) return '';
    if (mv.jdate) return String(mv.jdate);
    try {
      if (typeof jalaliDate === 'function') return String(jalaliDate(mv.created_at || '') || '');
    } catch (e) {}
    return '';
  }

  function currentQty(state, wid, product) {
    var cur = (state && state.current && (state.current[wid] || state.current[String(wid)])) || {};
    return Number(cur[product] || 0);
  }

  function movementDelta(mv, wid) {
    var q = 0;
    if (Number(mv.to_warehouse_id) === Number(wid)) q += Number(mv.qty) || 0;
    if (Number(mv.from_warehouse_id) === Number(wid)) q -= Number(mv.qty) || 0;
    return q;
  }

  function loadFreeze() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { return {}; }
  }

  function saveFreeze(map) {
    try { localStorage.setItem(STORE, JSON.stringify(map)); } catch (e) {}
  }

  function freezeKey(wid, product, day) {
    return String(wid) + '|' + String(product) + '|' + String(day);
  }

  function rememberLive(wid, product, day, qty) {
    var map = loadFreeze();
    map[freezeKey(wid, product, day)] = { qty: Number(qty) || 0, at: Date.now() };
    var cutoff = Date.now() - 120 * 86400000;
    Object.keys(map).forEach(function (k) {
      if (!map[k] || Number(map[k].at || 0) < cutoff) delete map[k];
    });
    saveFreeze(map);
  }

  function frozenQty(wid, product, day) {
    var row = loadFreeze()[freezeKey(wid, product, day)];
    return row && typeof row.qty === 'number' ? row.qty : null;
  }

  function stockOnJalaliDay(state, wid, product, jday, today) {
    var live = currentQty(state, wid, product);
    if (String(jday) === String(today)) {
      rememberLive(wid, product, today, live);
      return live;
    }
    var snap = frozenQty(wid, product, jday);
    if (snap !== null) return snap;
    var q = live;
    (state.movements || []).forEach(function (mv) {
      if (String(mv.product || '') !== String(product || '')) return;
      var md = movementJalali(mv);
      if (md && md > jday && md <= today) q -= movementDelta(mv, wid);
    });
    return q;
  }

  window.gpLedgerStockOnJalaliDay = stockOnJalaliDay;
  window.gpLedgerTodayJalali = todayJalali;

  function rewriteGrid() {
    var state = window.WAREHOUSE_LEDGER_DATA || window.WAREHOUSE_STATE;
    window.WAREHOUSE_STATE = state || window.WAREHOUSE_STATE;
    var wrap = document.getElementById('warehouseLedgerWrap');
    if (!state || !wrap) return;
    var table = wrap.querySelector('table');
    if (!table) return;
    var monthEl = document.getElementById('warehouseLedgerMonth');
    var raw = String(monthEl && monthEl.value || '');
    var match = raw.match(/^(\d{4})\/(\d{1,2})$/);
    if (!match) return;
    var jy = +match[1], jm = +match[2];
    var days = (typeof whMonthDays === 'function') ? whMonthDays(jy, jm) : 31;
    var today = todayJalali();
    var wid = Number(window.WAREHOUSE_LEDGER_ID || window.WAREHOUSE_SELECTED || 1);
    table.querySelectorAll('tbody tr').forEach(function (tr) {
      var nameCell = tr.querySelector('.model-cell, .model-col') || tr.cells[0];
      var product = String(nameCell && nameCell.textContent || '').trim();
      if (!product) return;
      var cells = tr.querySelectorAll('td');
      for (var day = 1; day <= days; day++) {
        var td = cells[day];
        if (!td) continue;
        var jdate = jy + '/' + pad(jm) + '/' + pad(day);
        if (jdate > today) {
          td.textContent = '';
          td.classList.add('future-cell');
          continue;
        }
        var val = stockOnJalaliDay(state, wid, product, jdate, today);
        td.textContent = Number(val).toLocaleString('fa-IR');
        td.classList.toggle('today-cell', jdate === today);
        td.classList.toggle('zero', val === 0);
      }
    });
  }

  function wrapRender() {
    var cur = window.renderWarehouseLedger;
    if (typeof cur !== 'function' || cur.__gpEodFreeze) return;
    var wrapped = function () {
      var result = cur.apply(this, arguments);
      try { rewriteGrid(); } catch (e) {}
      return result;
    };
    wrapped.__gpEodFreeze = true;
    wrapped.__gpDailyGrouped = cur.__gpDailyGrouped;
    window.renderWarehouseLedger = wrapped;
  }

  wrapRender();
  setTimeout(wrapRender, 400);
  setTimeout(function () { wrapRender(); try { rewriteGrid(); } catch (e) {} }, 1200);
})();
