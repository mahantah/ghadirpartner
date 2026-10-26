/* GP_OD_CHROME_V1_20261026 */
(function () {
  'use strict';
  if (window.__gpOdChromeV1) return;
  window.__gpOdChromeV1 = true;

  var STYLE_ID = 'gp-od-chrome-v1-css';

  function ensureStyle() {
    var css = document.getElementById(STYLE_ID);
    if (!css) {
      css = document.createElement('style');
      css.id = STYLE_ID;
      document.head.appendChild(css);
    }
    css.textContent =
      '#orderDetailOverlay,' +
      '#orderDetailOverlay.od2-overlay,' +
      '.order-detail-overlay{' +
        'z-index:90!important;' +
      '}' +
      '#app>header{' +
        'z-index:160!important;' +
      '}' +
      '#app>header .nav-toggle,' +
      '.nav-toggle,' +
      '.desktop-sidebar-open{' +
        'z-index:170!important;' +
      '}' +
      '#app>header .topnav,' +
      '#app>header .topnav.sidebar-open,' +
      '.topnav.sidebar-open{' +
        'z-index:165!important;' +
      '}' +
      '.nav-overlay.visible{' +
        'z-index:155!important;' +
      '}' +
      '#orderDetailBody .od2-header-actions{' +
        'display:flex!important;' +
        'align-items:center!important;' +
        'gap:8px!important;' +
        'flex-wrap:wrap!important;' +
        'position:relative;' +
        'z-index:6;' +
      '}' +
      '#orderDetailBody .od2-header-actions a.btn2,' +
      '#orderDetailBody a.btn2[href*="/pdf/order-details"]{' +
        'display:inline-flex!important;' +
        'align-items:center!important;' +
        'justify-content:center!important;' +
        'min-height:42px!important;' +
        'padding:10px 16px!important;' +
        'border-radius:10px!important;' +
        'background:#f58220!important;' +
        'color:#fff!important;' +
        'font-weight:800!important;' +
        'text-decoration:none!important;' +
        'border:0!important;' +
        'cursor:pointer!important;' +
        'white-space:nowrap!important;' +
        'box-shadow:0 6px 16px #f5822033!important;' +
      '}' +
      '#orderDetailBody .od2-header-actions button.btnlight,' +
      '#orderDetailBody .od2-header-actions [data-od2-close]{' +
        'display:inline-flex!important;' +
        'align-items:center!important;' +
        'justify-content:center!important;' +
        'min-height:42px!important;' +
        'padding:10px 16px!important;' +
        'border-radius:10px!important;' +
        'background:#edf2f7!important;' +
        'color:#102a43!important;' +
        'font-weight:800!important;' +
        'border:1px solid #d7e0ea!important;' +
        'cursor:pointer!important;' +
      '}';
  }

  function paintPdf() {
    var root = document.getElementById('orderDetailBody');
    if (!root) return;
    var link = root.querySelector('.od2-header-actions a.btn2, a[href*="/pdf/order-details"]');
    if (!link) return;
    if (!/دانلود/.test(link.textContent || '')) link.textContent = 'دانلود PDF';
    link.classList.add('btn2');
    if (!link.getAttribute('target')) link.setAttribute('target', '_blank');
    if (!link.getAttribute('rel')) link.setAttribute('rel', 'noopener');
  }

  function apply() {
    ensureStyle();
    paintPdf();
  }

  apply();
  [120, 600, 1600, 3000].forEach(function (ms) { setTimeout(apply, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  }
  if (!document.__gpOdChromeWatch) {
    document.__gpOdChromeWatch = true;
    var obs = new MutationObserver(function () {
      if (obs._q) return;
      obs._q = true;
      setTimeout(function () { obs._q = false; apply(); }, 40);
    });
    var body = document.getElementById('orderDetailBody');
    if (body) obs.observe(body, { childList: true, subtree: true });
    else if (document.body) obs.observe(document.body, { childList: true, subtree: true });
  }
})();
