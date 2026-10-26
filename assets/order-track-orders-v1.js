/* GP_ORDER_TRACK_ORDERS_V1_20261026 */
(function () {
  'use strict';
  if (window.__gpOrderTrackOrdersV1) return;
  window.__gpOrderTrackOrdersV1 = true;

  var STYLE_ID = 'gp-order-track-orders-v1-css';
  var ROOT_ID = 'gpOrderTrack';
  var TITLE = 'پیگیری سفارش';
  var ALL = 'مشاهده همه';

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function liveOrders() {
    var list = [];
    try { if (typeof ORD !== 'undefined' && Array.isArray(ORD)) list = ORD; } catch (e) {}
    if (!list.length && Array.isArray(window.ORD)) list = window.ORD;
    return list.filter(function (o) { return o && !o.deleted; });
  }

  function statusClass(s) {
    if (typeof window.statusClass === 'function') return window.statusClass(s);
    return s === 'ثبت شده' ? 'st-registered'
      : s === 'در حال آماده سازی' ? 'st-prep'
      : s === 'آماده ارسال' ? 'st-ready'
      : s === 'ارسال شد' ? 'st-sent'
      : s === 'تحویل شد' ? 'st-delivered'
      : 'st-cancel';
  }

  function ensureStyle() {
    var css = $(STYLE_ID);
    if (!css) {
      css = document.createElement('style');
      css.id = STYLE_ID;
      document.head.appendChild(css);
    }
    css.textContent =
      '#dashboard .dashboard-recent-card,' +
      '.dashboard-recent-card,' +
      '#dashboard #dashRecentBody,' +
      'section:not(#orders) #gpOrderTrack{' +
        'display:none!important' +
      '}' +
      '#orders #gpOrderTrack{display:block!important;margin:0 0 14px}' +
      '#gpOrderTrack .gp-track-head{' +
        'display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin:0 0 12px' +
      '}' +
      '#gpOrderTrack .gp-track-head h3{margin:0;font-size:17px;color:#102a43}' +
      '#gpOrderTrack .gp-track-head .small{margin-top:4px;color:#64748b}' +
      '#gpOrderTrack .gp-track-list{display:flex;flex-direction:column;gap:8px}' +
      '#gpOrderTrack .gp-track-row{' +
        'display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr) auto auto;' +
        'align-items:center;gap:10px 12px;padding:12px 14px;border:1px solid #e6edf5;' +
        'border-radius:14px;background:#f8fafc' +
      '}' +
      '#gpOrderTrack .gp-track-row b{color:#102a43}' +
      '#gpOrderTrack .gp-track-row .small{color:#64748b}' +
      '#gpOrderTrack .gp-track-empty{' +
        'padding:18px 12px;text-align:center;color:#64748b;background:#f8fafc;' +
        'border:1px dashed #d7e1ec;border-radius:14px' +
      '}' +
      '#gpOrderTrack .gp-track-all{' +
        'display:flex;width:100%;margin-top:12px;min-height:44px;border:0;border-radius:12px;' +
        'background:#102a43;color:#fff;font-weight:800;cursor:pointer' +
      '}' +
      '#gpOrderTrack .gp-track-all:hover{background:#153b65}' +
      '@media(max-width:720px){' +
        '#gpOrderTrack .gp-track-row{grid-template-columns:1fr auto;}' +
        '#gpOrderTrack .gp-track-row .gp-track-pay{grid-column:1}' +
      '}';
  }

  function hideDashboardRecent() {
    Array.prototype.forEach.call(document.querySelectorAll('.dashboard-recent-card'), function (card) {
      if (card.closest('#orders')) return;
      card.classList.add('hidden');
      card.style.display = 'none';
      card.setAttribute('hidden', 'hidden');
    });
  }

  function trackRows() {
    var done = { 'تحویل شد': 1, 'لغو شد': 1 };
    var list = liveOrders().slice().reverse();
    var active = list.filter(function (o) { return !done[o.status]; });
    var rows = (active.length ? active : list).slice(0, 4);
    return rows;
  }

  function customerName(o) {
    if (o.customer_name) return o.customer_name;
    if (typeof customerById === 'function') {
      try {
        var c = customerById(o.customer_id);
        if (c && c.name) return c.name;
      } catch (e) {}
    }
    return 'مشتری';
  }

  function ensureRoot() {
    var orders = $('orders');
    if (!orders) return null;
    var root = $(ROOT_ID);
    if (!root) {
      root = document.createElement('div');
      root.id = ROOT_ID;
      root.className = 'card';
      var first = orders.firstElementChild;
      if (first) orders.insertBefore(root, first);
      else orders.appendChild(root);
    }
    return root;
  }

  function openAll() {
    if (typeof show === 'function') show('orders');
    var table = document.querySelector('#orders .compact-orders-card, #orders .tablewrap');
    if (table && table.scrollIntoView) {
      setTimeout(function () { table.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 40);
    }
  }

  function paint() {
    hideDashboardRecent();
    var orders = $('orders');
    if (!orders) return;
    var onOrders = !orders.classList.contains('hidden') && !orders.hasAttribute('hidden');
    var root = ensureRoot();
    if (!root) return;
    root.classList.toggle('hidden', !onOrders);
    if (!onOrders) return;
    var rows = trackRows();
    var body = rows.length
      ? '<div class="gp-track-list">' + rows.map(function (o) {
          return '<div class="gp-track-row">' +
            '<div><b class="order-no">' + esc(o.number || '-') + '</b>' +
              '<div class="small">' + esc(customerName(o)) + '</div></div>' +
            '<div class="gp-track-pay small">' + esc(o.payment_status || 'پرداخت نشده') + '</div>' +
            '<span class="badge ' + statusClass(o.status) + '">' + esc(o.status || '-') + '</span>' +
            '<button class="btnlight" type="button" data-gp-track-id="' + esc(o.id) + '">جزئیات</button>' +
          '</div>';
        }).join('') + '</div>'
      : '<div class="gp-track-empty">سفارشی برای پیگیری نیست.</div>';
    root.innerHTML =
      '<div class="gp-track-head"><div><h3>' + TITLE + '</h3>' +
        '<div class="small">آخرین سفارش‌های در جریان</div></div></div>' +
      body +
      '<button type="button" class="gp-track-all" data-gp-track-all="1">' + ALL + '</button>';
    root.onclick = function (ev) {
      var all = ev.target && ev.target.closest && ev.target.closest('[data-gp-track-all]');
      if (all) {
        ev.preventDefault();
        openAll();
        return;
      }
      var btn = ev.target && ev.target.closest && ev.target.closest('[data-gp-track-id]');
      if (!btn) return;
      ev.preventDefault();
      var id = +btn.getAttribute('data-gp-track-id');
      if (typeof openOrderDetails === 'function') openOrderDetails(id);
    };
  }

  function wrap() {
    if (typeof window.show === 'function' && !window.show.__gpTrack1) {
      var base = window.show;
      window.show = function (t) {
        var out = base.apply(this, arguments);
        try { paint(); } catch (e) {}
        return out;
      };
      window.show.__gpTrack1 = true;
    }
    ['renderOrders', 'renderDashboardRecentOrders', 'renderDash'].forEach(function (name) {
      if (typeof window[name] !== 'function' || window[name].__gpTrack1) return;
      var prev = window[name];
      window[name] = function () {
        var out = prev.apply(this, arguments);
        try { paint(); } catch (e) {}
        return out;
      };
      window[name].__gpTrack1 = true;
    });
  }

  function apply() {
    try { ensureStyle(); } catch (e) {}
    try { wrap(); } catch (e) {}
    try { paint(); } catch (e) {}
  }

  apply();
  [160, 700, 1600, 2800].forEach(function (ms) { setTimeout(apply, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 40); });
  }
})();
