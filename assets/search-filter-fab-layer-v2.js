/* GP_SEARCH_FILTER_FAB_LAYER_V2_20261026 */
(function () {
  'use strict';
  if (window.__gpSearchFilterFabLayerV2) return;
  window.__gpSearchFilterFabLayerV2 = true;

  var STYLE_ID = 'gp-search-filter-fab-layer-v2-css';

  function install() {
    if (document.getElementById(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent =
      '#gpSearchFabRoot{' +
        'z-index:260!important;' +
        'pointer-events:none!important;' +
      '}' +
      '#gpSearchFabRoot .gp-fab-btn,' +
      '#gpSearchFabRoot .gp-fab-sheet{' +
        'pointer-events:auto!important;' +
      '}' +
      '#gpSearchFabRoot .gp-fab-back,' +
      '#gpSearchFabRoot.is-open .gp-fab-back{' +
        'display:none!important;' +
        'pointer-events:none!important;' +
      '}' +
      '#gpSearchFabRoot .gp-fab-sheet{' +
        'position:absolute!important;' +
        'z-index:3!important;' +
        'pointer-events:auto!important;' +
        'background:#fff!important;' +
        'color:#111!important;' +
      '}' +
      '#gpSearchFabRoot .gp-fab-btn{' +
        'position:relative!important;' +
        'z-index:4!important;' +
      '}' +
      '#gpSearchFabRoot .gp-fab-field input,' +
      '#gpSearchFabRoot .gp-fab-field select,' +
      '#gpSearchFabRoot .gp-fab-close,' +
      '#gpSearchFabRoot .gp-fab-actions button{' +
        'pointer-events:auto!important;' +
        'position:relative;' +
        'z-index:5;' +
      '}';
    document.head.appendChild(css);
  }

  install();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  }
})();
