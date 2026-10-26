/* GP_ORDER_TRACK_SCOPE_V2_20261026 */
(function () {
  'use strict';
  if (window.__gpOrderTrackScopeV2) return;
  window.__gpOrderTrackScopeV2 = true;

  var STYLE_ID = 'gp-order-track-scope-v2-css';
  var BAR_ID = 'gpClearOrderFilter';
  var ALLOWED = { dashboard: 1, orders: 1 };
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

  function onAllowedTab() {
    return !!ALLOWED[currentTabId()];
  }

  function ensureStyle() {
    var css = $(STYLE_ID);
    if (!css) {
      css = document.createElement('style');
      css.id = STYLE_ID;
      document.head.appendChild(css);
    }
    css.textContent =
      '#gpOrderTrack{display:none!important}' +
      '#dashboard .dashboard-recent-card,' +
      '#dashboard #dashRecentBody{' +
        'display:block!important' +
      '}' +
      '#dashboard .dashboard-recent-card[hidden]{display:block!important}' +
      '#shippingAlert{display:none!important}' +
      'body.gp-ship-ok #shippingAlert:not(.hidden){display:block!important}' +
      '#orderScopeNotice{display:none!important}' +
      '#' + BAR_ID + '{' +
        'display:flex;align-items:center;justify-content:space-between;gap:10px;' +
        'margin:0 0 14px;padding:12px 14px;border:1px solid #efcf8e;' +
        'background:#fff8e8;border-radius:12px;color:#74420a' +
      '}' +
      '#' + BAR_ID + ' span{font-size:13px;font-weight:700;line-height:1.7}' +
      '#' + BAR_ID + ' button{' +
        'min-height:40px;padding:8px 16px;border:0;border-radius:10px;' +
        'background:#102a43;color:#fff;font-weight:800;cursor:pointer;white-space:nowrap' +
      '}' +
      '#' + BAR_ID + ' button:hover{background:#153b65}' +
      '#shippingAlert .gp-clear-exit{' +
        'margin-inline-start:8px;background:#102a43!important;color:#fff!important' +
      '}' +
      '@media(max-width:760px){' +
        '#' + BAR_ID + '{flex-direction:column;align-items:stretch}' +
        '#' + BAR_ID + ' button{width:100%}' +
        '#shippingAlert .gp-clear-exit{margin-inline-start:0;width:100%}' +
      '}';
  }

  function restoreRecent() {
    Array.prototype.forEach.call(document.querySelectorAll('#dashboard .dashboard-recent-card'), function (card) {
      card.classList.remove('hidden');
      card.removeAttribute('hidden');
      card.style.removeProperty('display');
    });
    var track = $('gpOrderTrack');
    if (track) {
      track.classList.add('hidden');
      track.setAttribute('hidden', 'hidden');
      track.style.display = 'none';
    }
  }

  function scopeAlert() {
    document.body.classList.toggle('gp-ship-ok', onAllowedTab());
  }

  function clearFilter(ev) {
    if (ev) ev.preventDefault();
    window.GP_ORDER_SCOPE = '';
    try {
      if ($('osearch')) $('osearch').value = '';
      if ($('ofilter')) $('ofilter').value = '';
      if ($('opayfilter')) $('opayfilter').value = '';
    } catch (e) {}
    if (typeof window.clearPendingExitOrders === 'function' && !window.clearPendingExitOrders.__gpScopeV2) {
      try { window.clearPendingExitOrders(); } catch (e2) {}
    } else if (typeof window.goOrderPage === 'function') {
      window.goOrderPage(1);
    } else if (typeof window.renderOrders === 'function') {
      window.renderOrders();
    }
    paintBar();
    decorateAlert();
  }

  function paintBar() {
    var orders = $('orders');
    if (!orders) return;
    var on = visible(orders) && window.GP_ORDER_SCOPE === 'pending_exit';
    var bar = $(BAR_ID);
    if (!on) {
      if (bar) bar.remove();
      return;
    }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = BAR_ID;
      var first = orders.firstElementChild;
      if (first) orders.insertBefore(bar, first);
      else orders.appendChild(bar);
    }
    bar.innerHTML =
      '<span>فیلتر پیگیری فعال است. فقط سفارش‌های نیازمند خروج دیده می‌شوند.</span>' +
      '<button type="button" data-gp-clear-exit="1">' + CLEAR + '</button>';
    bar.onclick = function (ev) {
      var btn = ev.target && ev.target.closest && ev.target.closest('[data-gp-clear-exit]');
      if (!btn) return;
      clearFilter(ev);
    };
  }

  function decorateAlert() {
    var box = $('shippingAlert');
    if (!box) return;
    var extra = box.querySelector('.gp-clear-exit');
    if (window.GP_ORDER_SCOPE === 'pending_exit') {
      if (!extra) {
        extra = document.createElement('button');
        extra.type = 'button';
        extra.className = 'shipping-alert-all gp-clear-exit';
        extra.setAttribute('data-gp-clear-exit', '1');
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
    try { ensureStyle(); } catch (e) {}
    try { restoreRecent(); } catch (e2) {}
    try { scopeAlert(); } catch (e3) {}
    try { paintBar(); } catch (e4) {}
    try { decorateAlert(); } catch (e5) {}
  }

  function wrap() {
    if (typeof window.show === 'function' && !window.show.__gpScopeV2) {
      var baseShow = window.show;
      window.show = function () {
        var out = baseShow.apply(this, arguments);
        try { apply(); } catch (e) {}
        return out;
      };
      window.show.__gpScopeV2 = true;
    }
    ['renderShippingAlert', 'renderOrders', 'renderDashboardRecentOrders', 'renderDash', 'showPendingExitOrders', 'clearPendingExitOrders'].forEach(function (name) {
      if (typeof window[name] !== 'function' || window[name].__gpScopeV2) return;
      var prev = window[name];
      window[name] = function () {
        var out = prev.apply(this, arguments);
        try { apply(); } catch (e) {}
        return out;
      };
      window[name].__gpScopeV2 = true;
    });
  }

  function boot() {
    try { wrap(); } catch (e) {}
    try { apply(); } catch (e2) {}
  }

  boot();
  [120, 400, 900, 1800, 3200].forEach(function (ms) { setTimeout(boot, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 40); });
  }
})();
