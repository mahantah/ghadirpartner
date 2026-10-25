/* GP_MENU_LIVE_V4_20261025 */
(function () {
  'use strict';
  if (window.__gpMenuLiveV4) return;
  window.__gpMenuLiveV4 = true;

  var CATALOG = 'قیمت و موجودی';
  var STYLE_ID = 'gp-menu-live-v4-css';

  function $(id) { return document.getElementById(id); }

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent =
      '#gpNavDump{display:none!important}' +
      '#app > header .topnav > .gp-nav-retired,' +
      '#app > header .topnav > [data-tab="customers"]:not(#gpNavKartabl),' +
      '#app > header .topnav > [data-tab="products"],' +
      '#app > header .topnav > [data-tab="portalAdmin"]:not(#gpNavCatalog){display:none!important}';
    document.head.appendChild(css);
  }

  function dumpBin() {
    var bin = $('gpNavDump');
    if (!bin) {
      bin = document.createElement('div');
      bin.id = 'gpNavDump';
      bin.hidden = true;
      bin.setAttribute('aria-hidden', 'true');
      bin.style.display = 'none';
      document.body.appendChild(bin);
    }
    return bin;
  }

  function setCatalogText(el) {
    if (!el) return;
    var span = el.querySelector('.gp-menu-text');
    if (span) {
      if (span.textContent !== CATALOG) span.textContent = CATALOG;
      return;
    }
    if ((el.textContent || '').replace(/\s+/g, ' ').trim() !== CATALOG) {
      el.textContent = CATALOG;
    }
  }

  function keepCatalog() {
    var nav = document.querySelector('.topnav');
    if (!nav) return null;
    var kept = $('gpNavCatalog');
    var all = nav.querySelectorAll('[data-tab="portalAdmin"]');
    var catalogs = [];
    [].forEach.call(all, function (b) {
      var view = b.getAttribute('data-gp-view') || '';
      var text = (b.textContent || '').replace(/\s+/g, ' ');
      if (view === 'catalog' || /قیمت|موجودی|لیست قیمت/.test(text)) catalogs.push(b);
    });
    if (!kept && catalogs[0]) {
      kept = catalogs[0];
      kept.id = 'gpNavCatalog';
    }
    if (kept) {
      kept.setAttribute('data-gp-view', 'catalog');
      kept.setAttribute('data-tab', 'portalAdmin');
      setCatalogText(kept);
    }
    catalogs.forEach(function (b) {
      if (b !== kept) dumpBin().appendChild(b);
    });
    return kept;
  }

  function sweepTopNav() {
    var nav = document.querySelector('.topnav');
    if (!nav) return;
    var catalog = keepCatalog();
    var keep = [
      nav.querySelector('.sidebar-head'),
      nav.querySelector('[data-tab="dashboard"]'),
      $('gpOrders'),
      catalog,
      $('warehouseNavGroup'),
      $('gpCustomers'),
      nav.querySelector('[data-tab="salesReports"]'),
      $('gpSystem'),
      nav.querySelector('.sidebar-footer')
    ].filter(Boolean);
    keep.forEach(function (el) { nav.appendChild(el); });
    [].slice.call(nav.children).forEach(function (child) {
      if (keep.indexOf(child) >= 0) return;
      dumpBin().appendChild(child);
    });
  }

  function freezeCatalogWrites() {
    if (typeof window.setGpMenuLabel === 'function' && !window.setGpMenuLabel.__gpMenu4) {
      var base = window.setGpMenuLabel;
      window.setGpMenuLabel = function (btn, text) {
        var view = btn && btn.getAttribute && btn.getAttribute('data-gp-view');
        var tab = btn && btn.getAttribute && btn.getAttribute('data-tab');
        if (view === 'catalog' || (tab === 'portalAdmin' && view !== 'sms')) {
          text = CATALOG;
        }
        if (text === 'لیست قیمت') text = CATALOG;
        var span = btn && btn.querySelector && btn.querySelector('.gp-menu-text');
        if (span && span.textContent === text) return;
        return base(btn, text);
      };
      window.setGpMenuLabel.__gpMenu4 = true;
    }
    if (typeof window.fixWarehouseAndPriceMenuLabels === 'function' && !window.fixWarehouseAndPriceMenuLabels.__gpMenu4) {
      var refine = window.fixWarehouseAndPriceMenuLabels;
      window.fixWarehouseAndPriceMenuLabels = function () {
        refine();
        var kept = $('gpNavCatalog');
        if (kept) setCatalogText(kept);
      };
      window.fixWarehouseAndPriceMenuLabels.__gpMenu4 = true;
    }
  }

  function wrapPermission() {
    if (typeof window.applyPermissionVisibility !== 'function' || window.applyPermissionVisibility.__gpMenu4) return;
    var vis = window.applyPermissionVisibility;
    window.applyPermissionVisibility = function () {
      vis.apply(this, arguments);
      sweepTopNav();
      freezeCatalogWrites();
    };
    window.applyPermissionVisibility.__gpMenu4 = true;
  }

  function apply() {
    try { ensureStyle(); } catch (e) {}
    try { freezeCatalogWrites(); } catch (e) {}
    try { wrapPermission(); } catch (e) {}
    try { sweepTopNav(); } catch (e) {}
  }

  apply();
  [150, 500, 1200, 2500].forEach(function (ms) { setTimeout(apply, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 60); });
  }
})();
