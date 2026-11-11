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
    return row && Number.isSafeInteger(row.qty) && row.qty >= 0 ? row.qty : null;
  }

  /**
   * Reconciles a physical warehouse count against its movement ledger.
   * Historical calculations are withheld when the ledger is incomplete, since
   * back-calculating from a later inventory silently changes earlier dates.
   */
  class WarehouseLedgerHistory {
    constructor(state, warehouseId, keys, today) {
      this.state = state;
      this.warehouseId = Number(warehouseId);
      this.keys = new Set(keys);
      this.today = String(today || '');
      this.movements = (state.movements || []).filter(mv => this.keys.has(String(mv.product || '')));
      this.reconciliation = null;
    }

    currentQuantity() {
      var current = this.state.current?.[this.warehouseId] || this.state.current?.[String(this.warehouseId)] || {};
      return [...this.keys].reduce(function (total, key) { return total + Number(current[key] || 0); }, 0);
    }

    movementDelta(mv) {
      var qty = Number(mv.qty);
      if (!Number.isSafeInteger(qty) || qty < 0) return null;
      var delta = 0;
      if (Number(mv.to_warehouse_id) === this.warehouseId) delta += qty;
      if (Number(mv.from_warehouse_id) === this.warehouseId) delta -= qty;
      return delta;
    }

    relevantMovements() {
      return this.movements;
    }

    isReconciled() {
      if (this.reconciliation !== null) return this.reconciliation;
      var baseline = (this.state.baseline || []).filter(row =>
        Number(row.warehouse_id) === this.warehouseId && this.keys.has(String(row.product || '')));
      var opening = baseline.reduce(function (total, row) { return total + Number(row.qty || 0); }, 0);
      if (!Number.isSafeInteger(opening) || opening < 0) return (this.reconciliation = false);
      var balance = opening;
      for (var mv of this.relevantMovements()) {
        var delta = this.movementDelta(mv);
        if (delta === null || !movementJalali(mv)) return (this.reconciliation = false);
        balance += delta;
      }
      return (this.reconciliation = balance === this.currentQuantity());
    }

    quantityAtEndOfDay(day) {
      var qty = this.currentQuantity();
      if (day === this.today) return qty;
      if (day > this.today || !this.isReconciled()) return null;
      for (var mv of this.relevantMovements()) {
        var moveDay = movementJalali(mv);
        if (moveDay > day && moveDay <= this.today) qty -= this.movementDelta(mv);
      }
      return Number.isSafeInteger(qty) && qty >= 0 ? qty : null;
    }
  }

  function resolveKeys(state, wid, label) {
    if (Array.isArray(label)) return label.map(String);
    if (typeof window.gpWarehouseLedgerRows === 'function') {
      var row = window.gpWarehouseLedgerRows(state, Number(wid)).find(item => item.product === label);
      if (row && Array.isArray(row.keys) && row.keys.length) return row.keys;
    }
    return [String(label || '')];
  }

  /**
   * Returns a reconciled end-of-day quantity, or a device-local observation.
   * Callers must clearly mark a local observation as unverified when the
   * movement ledger does not reconcile against physical inventory.
   */
  function stockOnJalaliDay(state, wid, product, jday, today, preparedHistory) {
    if (!state) return null;
    var label = Array.isArray(product) ? product.join('|') : String(product || '');
    var history = preparedHistory || new WarehouseLedgerHistory(state, wid, resolveKeys(state, wid, product), today);
    if (String(jday) === String(today)) {
      var live = history.currentQuantity();
      rememberLive(wid, label, today, live);
      return live;
    }
    if (history.isReconciled()) return history.quantityAtEndOfDay(String(jday));
    return frozenQty(wid, label, jday);
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
    var activation = '';
    try { if (typeof jalaliDate === 'function') activation = jalaliDate(state.activated_at || ''); } catch (e) {}
    var wid = Number(window.WAREHOUSE_LEDGER_ID || window.WAREHOUSE_SELECTED || 1);
    var hasUnverified = false;
    table.querySelectorAll('tbody tr').forEach(function (tr) {
      var nameCell = tr.querySelector('.model-cell, .model-col') || tr.cells[0];
      var product = String(nameCell && nameCell.textContent || '').trim();
      if (!product) return;
      var history = new WarehouseLedgerHistory(state, wid, resolveKeys(state, wid, product), today);
      var cells = tr.querySelectorAll('td');
      for (var day = 1; day <= days; day++) {
        var td = cells[day];
        if (!td) continue;
        var jdate = jy + '/' + pad(jm) + '/' + pad(day);
        if (jdate > today || (activation && jdate < activation)) {
          td.textContent = '—';
          td.classList.toggle('future-cell', jdate > today);
          continue;
        }
        var value = stockOnJalaliDay(state, wid, product, jdate, today, history);
        var unverified = jdate !== today && !history.isReconciled();
        if (unverified) hasUnverified = true;
        td.textContent = value === null ? '—' : (unverified ? '≈ ' : '') + Number(value).toLocaleString('fa-IR');
        td.classList.toggle('today-cell', jdate === today);
        td.classList.toggle('zero', value === 0);
        td.classList.toggle('unverified-cell', unverified);
        td.title = unverified ? 'گردش انبار با موجودی فیزیکی تطابق ندارد؛ عدد احتمالی فقط مشاهده قبلی همین مرورگر است.' : '';
      }
    });
    if (hasUnverified) {
      var notice = document.createElement('div');
      notice.className = 'gp-ledger-integrity-warning';
      notice.setAttribute('role', 'status');
      notice.textContent = 'بخشی از تاریخچه انبار با موجودی فیزیکی تطابق ندارد. «—» یعنی داده معتبر نداریم و «≈» مشاهده قدیمی همین مرورگر است، نه موجودی قطعی پایان روز. موجودی امروز بدون تغییر است.';
      wrap.insertBefore(notice, table);
    }
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

  var style = document.createElement('style');
  style.textContent = '.gp-ledger-integrity-warning{margin:8px 0;padding:9px 12px;border:1px solid #f58220;border-radius:8px;color:#102a43;background:#fff7ed;font-size:12px;line-height:1.7}.warehouse-ledger-table td.unverified-cell,.warehouse-ledger td.unverified-cell{background:#fff7ed;color:#9a3412}';
  document.head.appendChild(style);

  wrapRender();
  setTimeout(wrapRender, 400);
  setTimeout(function () { wrapRender(); try { rewriteGrid(); } catch (e) {} }, 1200);
})();
