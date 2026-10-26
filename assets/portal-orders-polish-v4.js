/* GP_PORTAL_ORDERS_POLISH_V4_20261026 */
(function () {
  'use strict';
  if (window.__gpPortalOrdersPolishV4) return;
  window.__gpPortalOrdersPolishV4 = true;

  var STYLE_ID = 'gp-portal-orders-polish-v4-css';
  var CLEAR = 'نمایش همه سفارشات';

  function $(id) { return document.getElementById(id); }

  function visible(el) {
    return !!(el && !el.classList.contains('hidden') && !el.hasAttribute('hidden'));
  }

  function currentTabId() {
    var tabs = document.querySelectorAll('section.tab, .tab[id]');
    for (var i = 0; i < tabs.length; i++) {
      if (visible(tabs[i]) && tabs[i].id) return tabs[i].id;
    }
    return '';
  }

  function ensureStyle() {
    var css = $(STYLE_ID);
    if (!css) {
      css = document.createElement('style');
      css.id = STYLE_ID;
      document.head.appendChild(css);
    }
    css.textContent =
      '.portal-subnav [data-portal-view="resets"],' +
      '.portal-subnav [data-portal-view="sms"]{' +
        'display:none!important' +
      '}' +
      '#gpClearOrderFilter,' +
      '#orderScopeNotice,' +
      '.order-scope-notice{' +
        'display:none!important' +
      '}' +
      'body.gp-on-orders .shipping-alert-orders{' +
        'display:none!important' +
      '}';
  }

  function stripPortalRows() {
    Array.prototype.forEach.call(
      document.querySelectorAll('.portal-subnav [data-portal-view="resets"], .portal-subnav [data-portal-view="sms"]'),
      function (el) {
        el.remove();
      }
    );
  }

  function dropExtraBoxes() {
    var bar = $('gpClearOrderFilter');
    if (bar) bar.remove();
    var notice = $('orderScopeNotice');
    if (notice) notice.remove();
  }

  function clearFilter(ev) {
    if (ev) ev.preventDefault();
    window.GP_ORDER_SCOPE = '';
    try {
      if ($('osearch')) $('osearch').value = '';
      if ($('ofilter')) $('ofilter').value = '';
      if ($('opayfilter')) $('opayfilter').value = '';
    } catch (e) {}
    if (typeof window.goOrderPage === 'function') window.goOrderPage(1);
    else if (typeof window.renderOrders === 'function') window.renderOrders();
    syncClearBtn();
  }

  function syncClearBtn() {
    var box = $('shippingAlert');
    if (!box) return;
    var extra = box.querySelector('.gp-clear-exit');
    if (window.GP_ORDER_SCOPE === 'pending_exit') {
      if (!extra) {
        extra = document.createElement('button');
        extra.type = 'button';
        extra.className = 'shipping-alert-all gp-clear-exit';
        extra.textContent = CLEAR;
        extra.addEventListener('click', clearFilter);
        var main = box.querySelector('.shipping-alert-main');
        if (main) main.appendChild(extra);
        else box.appendChild(extra);
      }
    } else if (extra) {
      extra.remove();
    }
  }

  function apply() {
    document.body.classList.toggle('gp-on-orders', currentTabId() === 'orders');
    try { ensureStyle(); } catch (e) {}
    try { stripPortalRows(); } catch (e2) {}
    try { dropExtraBoxes(); } catch (e3) {}
    try { syncClearBtn(); } catch (e4) {}
  }

  function wrap() {
    if (typeof window.show === 'function' && !window.show.__gpPolishV4) {
      var baseShow = window.show;
      window.show = function () {
        var out = baseShow.apply(this, arguments);
        try { apply(); } catch (e) {}
        return out;
      };
      window.show.__gpPolishV4 = true;
    }
    ['portalAdminView', 'organizePortalAdmin', 'renderShippingAlert', 'renderOrders', 'showPendingExitOrders', 'clearPendingExitOrders', 'renderDash'].forEach(function (name) {
      if (typeof window[name] !== 'function' || window[name].__gpPolishV4) return;
      var prev = window[name];
      window[name] = function () {
        var out = prev.apply(this, arguments);
        try { apply(); } catch (e) {}
        return out;
      };
      window[name].__gpPolishV4 = true;
    });
    if (typeof window.orderFiltered === 'function' && !window.orderFiltered.__gpPolishV4) {
      var baseFilter = window.orderFiltered;
      window.orderFiltered = function () {
        var rows = baseFilter.apply(this, arguments);
        try { dropExtraBoxes(); syncClearBtn(); } catch (e) {}
        return rows;
      };
      window.orderFiltered.__gpPolishV4 = true;
    }
  }

  function boot() {
    try { wrap(); } catch (e) {}
    try { apply(); } catch (e2) {}
  }

  boot();
  [100, 350, 900, 1800, 3200].forEach(function (ms) { setTimeout(boot, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 40); });
  }
})();
