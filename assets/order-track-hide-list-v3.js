/* GP_ORDER_TRACK_HIDE_LIST_V3_20261026 */
(function () {
  'use strict';
  if (window.__gpOrderTrackHideListV3) return;
  window.__gpOrderTrackHideListV3 = true;

  var STYLE_ID = 'gp-order-track-hide-list-v3-css';
  var BAR_ID = 'gpClearOrderFilter';
  var ALLOWED = { dashboard: 1, orders: 1 };
  var CLEAR = 'نمایش همه سفارشات';
  // Hide rejected card: آخرین سفارش‌های در جریان + مشاهده همه

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

  function killV1Style() {
    var old = $('gp-order-track-orders-v1-css');
    if (old) {
      old.textContent =
        '#gpOrderTrack,#orders #gpOrderTrack,.gp-track-all,.gp-track-row,.gp-track-head{display:none!important}';
    }
  }

  function ensureStyle() {
    var css = $(STYLE_ID);
    if (!css) {
      css = document.createElement('style');
      css.id = STYLE_ID;
      document.head.appendChild(css);
    }
    css.textContent =
      '#orders #gpOrderTrack,' +
      '#dashboard #gpOrderTrack,' +
      '#gpOrderTrack,' +
      '#gpOrderTrack.card,' +
      '#gpOrderTrack .gp-track-head,' +
      '#gpOrderTrack .gp-track-list,' +
      '#gpOrderTrack .gp-track-row,' +
      '#gpOrderTrack .gp-track-all,' +
      '#gpOrderTrack .gp-track-empty{' +
        'display:none!important;visibility:hidden!important;' +
        'height:0!important;max-height:0!important;overflow:hidden!important;' +
        'margin:0!important;padding:0!important;border:0!important' +
      '}' +
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
      '@media(max-width:760px){' +
        '#' + BAR_ID + '{flex-direction:column;align-items:stretch}' +
        '#' + BAR_ID + ' button{width:100%}' +
      '}';
  }

  function removeTrack() {
    var track = $('gpOrderTrack');
    if (track && track.parentNode) track.parentNode.removeChild(track);
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
    if (typeof window.goOrderPage === 'function') window.goOrderPage(1);
    else if (typeof window.renderOrders === 'function') window.renderOrders();
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
    try { killV1Style(); } catch (e) {}
    try { ensureStyle(); } catch (e2) {}
    try { removeTrack(); } catch (e3) {}
    try { scopeAlert(); } catch (e4) {}
    try { paintBar(); } catch (e5) {}
    try { decorateAlert(); } catch (e6) {}
  }

  function wrap() {
    if (typeof window.show === 'function' && !window.show.__gpHideListV3) {
      var baseShow = window.show;
      window.show = function () {
        var out = baseShow.apply(this, arguments);
        try { apply(); } catch (e) {}
        return out;
      };
      window.show.__gpHideListV3 = true;
    }
    ['renderShippingAlert', 'renderOrders', 'renderDashboardRecentOrders', 'renderDash', 'showPendingExitOrders', 'clearPendingExitOrders'].forEach(function (name) {
      if (typeof window[name] !== 'function' || window[name].__gpHideListV3) return;
      var prev = window[name];
      window[name] = function () {
        var out = prev.apply(this, arguments);
        try { apply(); } catch (e) {}
        return out;
      };
      window[name].__gpHideListV3 = true;
    });
  }

  function watch() {
    if (window.__gpHideListV3Watch) return;
    var orders = $('orders');
    if (!orders || !window.MutationObserver) return;
    window.__gpHideListV3Watch = true;
    new MutationObserver(function () {
      if ($('gpOrderTrack')) removeTrack();
    }).observe(orders, { childList: true });
  }

  function boot() {
    try { wrap(); } catch (e) {}
    try { apply(); } catch (e2) {}
    try { watch(); } catch (e3) {}
  }

  boot();
  [80, 300, 800, 1600, 3000].forEach(function (ms) { setTimeout(boot, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 40); });
  }
})();
