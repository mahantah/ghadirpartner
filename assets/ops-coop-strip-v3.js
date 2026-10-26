/* GP_OPS_COOP_STRIP_V3_20261026 */
(function () {
  'use strict';
  if (window.__gpOpsCoopStripV3) return;
  window.__gpOpsCoopStripV3 = true;

  var STYLE_ID = 'gp-ops-coop-strip-v3-css';

  function ensureStyle() {
    var css = document.getElementById(STYLE_ID);
    if (!css) {
      css = document.createElement('style');
      css.id = STYLE_ID;
      document.head.appendChild(css);
    }
    css.textContent =
      '.customer-menu .gp-ops-quick,' +
      '.customer-menu [data-gp-ops-agent],' +
      '.customer-menu [data-gp-ops-rep],' +
      '.customer-menu .gp-ops-agent,' +
      '.order-menu.customer-menu .gp-ops-quick{' +
        'display:none!important' +
      '}';
  }

  function isCoopButton(el) {
    if (!el) return false;
    if (el.classList && (el.classList.contains('gp-ops-quick') || el.classList.contains('gp-ops-agent'))) return true;
    if (el.getAttribute && (el.getAttribute('data-gp-ops-agent') || el.getAttribute('data-gp-ops-rep'))) return true;
    var onclick = String(el.getAttribute && el.getAttribute('onclick') || '');
    if (/gpChangeCoop|gpApplyCoopKind/.test(onclick)) return true;
    var text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
    return /تغییر نوع همکاری|عاملین فروش|همکاری/.test(text) && !/ویرایش|رمز|تماس|قیمت|تخفیف|طرح|حذف|فعال/.test(text);
  }

  function stripMenu(menu) {
    if (!menu) return;
    Array.prototype.slice.call(menu.querySelectorAll('.gp-ops-quick, [data-gp-ops-agent], [data-gp-ops-rep]')).forEach(function (el) {
      el.remove();
    });
    Array.prototype.slice.call(menu.querySelectorAll('button')).forEach(function (btn) {
      if (isCoopButton(btn)) btn.remove();
    });
  }

  function stripAll() {
    Array.prototype.forEach.call(document.querySelectorAll('.customer-menu, .order-menu.customer-menu'), stripMenu);
  }

  function wrapMenu() {
    if (typeof window.toggleCustomerMenu === 'function' && !window.toggleCustomerMenu.__gpStrip3) {
      var base = window.toggleCustomerMenu;
      window.toggleCustomerMenu = function () {
        var out = base.apply(this, arguments);
        setTimeout(stripAll, 0);
        setTimeout(stripAll, 60);
        setTimeout(stripAll, 160);
        return out;
      };
      window.toggleCustomerMenu.__gpStrip3 = true;
      window.toggleCustomerMenu.__gpWhOps2 = base.__gpWhOps2;
      window.toggleCustomerMenu.__gpWhOps1 = base.__gpWhOps1;
      window.toggleCustomerMenu.__gpSync1 = base.__gpSync1;
    }
    stripAll();
  }

  function apply() {
    try { ensureStyle(); } catch (e) {}
    try { wrapMenu(); } catch (e) {}
    try { stripAll(); } catch (e) {}
  }

  apply();
  [80, 400, 900, 1800, 3200].forEach(function (ms) { setTimeout(apply, ms); });
  setInterval(stripAll, 500);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 40); });
  }
  document.addEventListener('click', function (ev) {
    if (ev.target && ev.target.closest && ev.target.closest('.customer-menu, [onclick*="toggleCustomerMenu"]')) {
      setTimeout(stripAll, 0);
    }
  }, true);
})();
