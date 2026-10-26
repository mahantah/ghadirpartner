/* GP_FORM_CARD_COMPACT_V1_20261026 */
(function () {
  'use strict';
  if (window.__gpFormCardCompactV1) return;
  window.__gpFormCardCompactV1 = true;

  var STYLE_ID = 'gp-form-card-compact-v1-css';

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent =
      '#customerAdd> .card,' +
      '#customerAddCard,' +
      '#customerImportCard,' +
      '#salesPlans> .card:first-child,' +
      '#users> .card:first-child,' +
      '#settings> .card:first-child,' +
      '#products> .card:first-child,' +
      '.gp-form-compact{' +
        'width:min(680px,100%)!important;' +
        'max-width:680px!important;' +
        'margin-top:0!important;' +
        'margin-bottom:14px!important;' +
        'margin-right:0!important;' +
        'margin-left:auto!important;' +
        'padding:16px 16px 14px!important;' +
      '}' +
      '#gpChannelBox,#gpEditCoopBox{' +
        'width:fit-content!important;' +
        'max-width:100%!important;' +
        'padding:8px 10px!important;' +
        'margin:0 0 10px!important;' +
      '}' +
      '#customerAdd .mutedbox,' +
      '#salesPlans> .card:first-child .mutedbox,' +
      '#users> .card:first-child .mutedbox,' +
      '#products> .card:first-child .mutedbox,' +
      '#settings> .card:first-child .mutedbox,' +
      '#modal .mutedbox,' +
      '#modal .customer-price-box{' +
        'width:fit-content!important;' +
        'max-width:100%!important;' +
        'padding:8px 10px!important;' +
      '}' +
      '.customCheckBoxHolder{' +
        'width:fit-content!important;' +
        'max-width:100%!important;' +
        'display:inline-flex!important;' +
        'flex:0 0 auto!important;' +
        'flex-wrap:nowrap!important;' +
        'margin:4px 0!important;' +
      '}' +
      '.customCheckBoxWrapper,.customCheckBox{' +
        'flex:0 0 auto!important;' +
        'width:auto!important;' +
        'max-width:none!important;' +
      '}' +
      '#gpChannelBox label.customCheckBoxWrapper,' +
      '#gpEditCoopBox label.customCheckBoxWrapper,' +
      '#modal label.customCheckBoxWrapper{' +
        'width:auto!important;' +
        'display:block!important;' +
        'background:transparent!important;' +
        'border:0!important;' +
        'padding:0!important;' +
        'margin:0!important;' +
      '}' +
      '.gp-toggle-row{' +
        'width:fit-content!important;' +
        'max-width:100%!important;' +
      '}' +
      '#gpChannelBox .gp-typeahead,' +
      '#gpEditCoopBox .gp-typeahead,' +
      '#customerAdd .gp-typeahead{' +
        'width:min(360px,100%)!important;' +
      '}' +
      '#customerAdd .grid,' +
      '#salesPlans> .card:first-child .grid,' +
      '#users> .card:first-child .grid,' +
      '#products> .card:first-child .grid,' +
      '#settings> .card:first-child .grid{' +
        'grid-template-columns:repeat(2,minmax(0,1fr))!important;' +
      '}' +
      '#customerAdd textarea,' +
      '#salesPlans> .card:first-child textarea,' +
      '#settings> .card:first-child textarea{' +
        'width:100%!important;' +
        'max-width:100%!important;' +
      '}' +
      '@media (max-width:720px){' +
        '#customerAdd> .card,#customerAddCard,#customerImportCard,' +
        '#salesPlans> .card:first-child,#users> .card:first-child,' +
        '#settings> .card:first-child,#products> .card:first-child,' +
        '.gp-form-compact{' +
          'width:100%!important;' +
          'max-width:100%!important;' +
          'margin-left:0!important;' +
          'padding:14px 12px!important;' +
        '}' +
        '#customerAdd .grid,' +
        '#salesPlans> .card:first-child .grid,' +
        '#users> .card:first-child .grid,' +
        '#products> .card:first-child .grid,' +
        '#settings> .card:first-child .grid{' +
          'grid-template-columns:1fr!important;' +
        '}' +
      '}';
    document.head.appendChild(css);
  }

  function mark() {
    ['customerAddCard', 'customerImportCard'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.add('gp-form-compact');
    });
    ['salesPlans', 'users', 'settings', 'products'].forEach(function (id) {
      var sec = document.getElementById(id);
      var card = sec && sec.querySelector(':scope > .card');
      if (card && !card.querySelector('table, .tablewrap')) card.classList.add('gp-form-compact');
    });
  }

  function apply() {
    try { ensureStyle(); } catch (e) {}
    try { mark(); } catch (e) {}
  }

  apply();
  [180, 800, 1800, 3200].forEach(function (ms) { setTimeout(apply, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 40); });
  }
})();
