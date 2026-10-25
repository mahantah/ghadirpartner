/* GP_TOGGLE_SWITCH_POLISH_V1_20261025 */
(function () {
  'use strict';
  if (window.__gpToggleSwitchPolishV1) return;
  window.__gpToggleSwitchPolishV1 = true;

  var STYLE_ID = 'gp-toggle-switch-polish-v1-css';

  function $(id) { return document.getElementById(id); }

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent =
      '.customCheckBoxHolder{gap:0!important;flex-wrap:nowrap!important;margin:8px 0}' +
      '#gpChannelBox .gp-channel-row,#gpEditCoopBox .gp-channel-row{gap:0!important;flex-wrap:nowrap!important}' +
      '#gpChannelBox label.customCheckBoxWrapper,#gpEditCoopBox label.customCheckBoxWrapper,' +
      '#gpChannelBox .customCheckBoxWrapper,#gpEditCoopBox .customCheckBoxWrapper,' +
      '.customCheckBoxWrapper{background:transparent!important;border:0!important;padding:0!important;margin:0!important;border-radius:0!important;box-shadow:none!important;gap:0!important}' +
      '.customCheckBox{border:0!important;margin:0!important;box-shadow:rgba(0,0,0,0.15) 0 2px 1px 0 inset,rgba(255,255,255,0.17) 0 1px 1px 0}' +
      '.customCheckBoxHolder > .customCheckBoxInput + .customCheckBoxWrapper .customCheckBox{border-right:0!important;border-left:0!important}' +
      '.toggle-border{border:2px solid #f0ebeb;border-radius:130px;margin:0;padding:1px 2px;background:linear-gradient(to bottom right,white,rgba(220,220,220,.5)),white;box-shadow:0 0 0 2px #fbfbfb;cursor:pointer;display:flex;align-items:center;flex:0 0 auto}' +
      '.toggle-border input[type="checkbox"]{display:none}' +
      '.toggle-border > label{position:relative;display:inline-block;width:65px;height:20px;background:#d13613;border-radius:80px;cursor:pointer;box-shadow:inset 0 0 16px rgba(0,0,0,.3);transition:background .5s;margin:0;padding:0;border:0;min-width:65px}' +
      '.toggle-border input[type="checkbox"]:checked + label{background:#13d162}' +
      '.toggle-border .handle{position:absolute;top:-8px;left:-10px;width:35px;height:35px;border:1px solid #e5e5e5;background:repeating-radial-gradient(circle at 50% 50%,rgba(200,200,200,.2) 0%,rgba(200,200,200,.2) 2%,transparent 2%,transparent 3%,rgba(200,200,200,.2) 3%,transparent 3%),conic-gradient(white 0%,silver 10%,white 35%,silver 45%,white 60%,silver 70%,white 80%,silver 95%,white 100%);border-radius:50%;box-shadow:3px 5px 10px 0 rgba(0,0,0,.4);transition:left .4s}' +
      '.toggle-border input[type="checkbox"]:checked + label > .handle{left:calc(100% - 35px + 10px)}' +
      '.gp-toggle-row{display:flex;align-items:center;gap:12px;margin:8px 0;flex-wrap:wrap}' +
      '.gp-toggle-text{font-weight:800;color:#102a43;line-height:1.4}' +
      '#gpChannelBox .gp-toggle-row label,#modal .gp-toggle-row label{background:transparent!important;border:0!important;padding:0!important;box-shadow:none!important}';
    document.head.appendChild(css);
  }

  function skipToggle(inp) {
    if (!inp || inp.type !== 'checkbox') return true;
    if (inp.dataset.gpToggle === '1') return true;
    if (inp.classList.contains('customCheckBoxInput')) return true;
    if (inp.closest('.toggle-border')) return true;
    if (inp.closest('table')) return true;
    if (inp.closest('.gp-channel-legacy') || inp.closest('.hidden')) return true;
    if (inp.classList.contains('gp-plan-pick') || inp.classList.contains('returnSerialCheck')) return true;
    if (inp.classList.contains('newrole') || inp.classList.contains('editrole')) return true;
    if (inp.id === 'isMarketer' || inp.id === 'hasMarketer' || inp.id === 'eIsMarketer' || inp.id === 'eHasMarketer') return true;
    if (inp.offsetParent === null && !inp.closest('#modal')) return true;
    return false;
  }

  function wrapToggle(inp) {
    if (skipToggle(inp)) return;
    inp.dataset.gpToggle = '1';
    if (!inp.id) inp.id = 'gpTog_' + Math.random().toString(36).slice(2, 8);
    var lab = inp.closest('label');
    var text = lab ? String(lab.textContent || '').replace(/\s+/g, ' ').trim() : '';
    var row = document.createElement('div');
    row.className = 'gp-toggle-row';
    var border = document.createElement('div');
    border.className = 'toggle-border';
    var sw = document.createElement('label');
    sw.htmlFor = inp.id;
    sw.innerHTML = '<div class="handle"></div>';
    border.appendChild(inp);
    border.appendChild(sw);
    row.appendChild(border);
    if (text) {
      var span = document.createElement('span');
      span.className = 'gp-toggle-text';
      span.textContent = text;
      row.appendChild(span);
    }
    var host = lab && lab.parentNode ? lab : inp.parentNode;
    if (lab && lab.parentNode) {
      lab.parentNode.insertBefore(row, lab);
      lab.remove();
    } else if (inp.parentNode) {
      inp.parentNode.insertBefore(row, inp);
    }
    if (host && host !== document.body) { /* keep layout */ }
  }

  function upgradeToggles(root) {
    root = root || document;
    [].forEach.call(root.querySelectorAll('input[type="checkbox"]'), wrapToggle);
  }

  function watch() {
    if (document.__gpToggleWatch) return;
    document.__gpToggleWatch = true;
    var obs = new MutationObserver(function () {
      if (watch._q) return;
      watch._q = true;
      setTimeout(function () {
        watch._q = false;
        try { upgradeToggles(); } catch (e) {}
      }, 50);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  function apply() {
    try { ensureStyle(); } catch (e) {}
    try { upgradeToggles(); } catch (e) {}
    try { watch(); } catch (e) {}
  }

  apply();
  [180, 800, 1800, 3200, 5000].forEach(function (ms) { setTimeout(apply, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 40); });
  }
})();
