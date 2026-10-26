/* GP_SEARCH_FILTER_FAB_CLICK_V3_20261026 */
(function () {
  'use strict';
  if (window.__gpSearchFilterFabClickV3) return;
  window.__gpSearchFilterFabClickV3 = true;

  var STYLE_ID = 'gp-search-filter-fab-click-v3-css';

  function installCss() {
    var css = document.getElementById(STYLE_ID);
    if (!css) {
      css = document.createElement('style');
      css.id = STYLE_ID;
      document.head.appendChild(css);
    }
    css.textContent =
      '#gpSearchFabRoot{' +
        'pointer-events:none!important;' +
      '}' +
      '#gpSearchFabRoot.is-open{' +
        'pointer-events:none!important;' +
      '}' +
      '#gpSearchFabRoot .gp-fab-back,' +
      '#gpSearchFabRoot.is-open .gp-fab-back{' +
        'display:none!important;' +
        'opacity:0!important;' +
        'pointer-events:none!important;' +
        'visibility:hidden!important;' +
      '}' +
      '#gpSearchFabRoot .gp-fab-btn,' +
      '#gpSearchFabRoot .gp-fab-sheet,' +
      '#gpSearchFabRoot .gp-fab-sheet *,' +
      '#gpSearchFabRoot .gp-fab-close{' +
        'pointer-events:auto!important;' +
      '}';
  }

  function disarmBack() {
    Array.prototype.forEach.call(document.querySelectorAll('#gpSearchFabRoot .gp-fab-back'), function (el) {
      el.style.display = 'none';
      el.style.pointerEvents = 'none';
      el.style.opacity = '0';
      el.setAttribute('aria-hidden', 'true');
    });
  }

  function closeFab() {
    var root = document.getElementById('gpSearchFabRoot');
    if (root) root.classList.remove('is-open');
  }

  function bindOutside() {
    if (document.__gpFabClickV3Out) return;
    document.__gpFabClickV3Out = true;
    document.addEventListener('pointerdown', function (ev) {
      var root = document.getElementById('gpSearchFabRoot');
      if (!root || !root.classList.contains('is-open')) return;
      if (ev.target.closest('#gpFabSheet, #gpSearchFab, .gp-fab-sheet, .gp-fab-btn')) return;
      closeFab();
    }, true);
  }

  function apply() {
    installCss();
    disarmBack();
    bindOutside();
  }

  apply();
  [80, 400, 1200, 2500].forEach(function (ms) { setTimeout(apply, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  }
})();
