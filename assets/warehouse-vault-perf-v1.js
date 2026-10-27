/* GP_WAREHOUSE_VAULT_PERF_V1_20261026 */
(function () {
  'use strict';
  if (window.__gpWarehouseVaultPerfV1) return;
  window.__gpWarehouseVaultPerfV1 = true;

  var CACHE_MS = 55000;
  var lastFetch = 0;
  var inflight = null;

  function $(id) { return document.getElementById(id); }

  function clearWhCache() {
    lastFetch = 0;
    inflight = null;
  }
  window.gpClearWarehouseVaultCache = clearWhCache;

  function paintLoading() {
    var body = $('warehouseBody');
    if (!body) return;
    if (body.querySelector('tr[data-gp-wh-loading]')) return;
    body.innerHTML = '<tr data-gp-wh-loading="1"><td colspan="9">در حال بارگذاری مخزن سریال…</td></tr>';
  }

  function wrapLoad() {
    if (typeof window.loadWarehouse !== 'function' || window.loadWarehouse.__gpVaultPerf1) return;
    var base = window.loadWarehouse;
    window.loadWarehouse = async function (force) {
      var now = Date.now();
      if (force !== true && typeof WH !== 'undefined' && WH && lastFetch && (now - lastFetch) < CACHE_MS) {
        try { if (typeof renderWarehouse === 'function') renderWarehouse(); } catch (e) {}
        try { if (typeof warehouseCount === 'function') warehouseCount(); } catch (e) {}
        try { if (typeof warehouseLabelCount === 'function') warehouseLabelCount(); } catch (e) {}
        return WH;
      }
      if (inflight) return inflight;
      // Retry after failure; a stale object must never count as a successful fetch.
      var previousState = typeof WH === 'undefined' ? null : WH;
      paintLoading();
      inflight = (async function () {
        try {
          var r = await base.apply(this, arguments);
          if (typeof WH !== 'undefined' && WH && WH !== previousState) lastFetch = Date.now();
          return r;
        } finally {
          inflight = null;
        }
      })();
      return inflight;
    };
    window.loadWarehouse.__gpVaultPerf1 = true;
  }

  function coalesceRender() {
    if (typeof window.renderWarehouse !== 'function' || window.renderWarehouse.__gpVaultPerfCoalesce) return;
    var base = window.renderWarehouse;
    var queued = false;
    window.renderWarehouse = function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        base.apply(this, arguments);
      });
    };
    window.renderWarehouse.__gpVaultPerfCoalesce = true;
  }

  function wrapShow() {
    if (typeof window.show !== 'function' || window.show.__gpVaultPerf1) return;
    var base = window.show;
    window.show = function (t) {
      var out = base.apply(this, arguments);
      if (t === 'warehouse' && (typeof WH === 'undefined' || !WH || !lastFetch)) paintLoading();
      return out;
    };
    window.show.__gpVaultPerf1 = true;
  }

  function wrapRefresh() {
    if (typeof window.refresh !== 'function' || window.refresh.__gpVaultPerf1) return;
    var base = window.refresh;
    window.refresh = async function () {
      clearWhCache();
      return base.apply(this, arguments);
    };
    window.refresh.__gpVaultPerf1 = true;
  }

  wrapLoad();
  coalesceRender();
  wrapShow();
  wrapRefresh();
})();
