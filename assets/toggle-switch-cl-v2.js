/* GP_TOGGLE_SWITCH_CL_V2_20261026 */
(function () {
  'use strict';
  if (window.__gpToggleSwitchClV2) return;
  window.__gpToggleSwitchClV2 = true;

  var STYLE_ID = 'gp-toggle-switch-cl-v2-css';

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent =
      '.toggle-border,.toggle-border .handle{display:none!important}' +
      '.cl-toggle-switch{position:relative;display:inline-flex;align-items:center;flex:0 0 auto}' +
      '.cl-switch{position:relative;display:inline-block;margin:0;padding:0;border:0;background:transparent!important;box-shadow:none!important;min-width:0}' +
      '.cl-switch > input{appearance:none;-moz-appearance:none;-webkit-appearance:none;z-index:-1;position:absolute;right:6px;top:-8px;display:block;margin:0;border-radius:50%;width:40px;height:40px;background-color:rgba(0,0,0,0.38);outline:none;opacity:0;transform:scale(1);pointer-events:none;transition:opacity 0.3s 0.1s,transform 0.2s 0.1s}' +
      '.cl-switch > span{display:inline-block;position:relative;min-width:46px;height:24px}' +
      '.cl-switch > span::before{content:"";float:right;display:inline-block;margin:5px 0 5px 10px;border-radius:7px;width:36px;height:14px;background-color:rgba(0,0,0,0.38);vertical-align:top;transition:background-color 0.2s,opacity 0.2s}' +
      '.cl-switch > span::after{content:"";position:absolute;top:2px;right:16px;border-radius:50%;width:20px;height:20px;background-color:#fff;box-shadow:0 3px 1px -2px rgba(0,0,0,0.2),0 2px 2px 0 rgba(0,0,0,0.14),0 1px 5px 0 rgba(0,0,0,0.12);transition:background-color 0.2s,transform 0.2s}' +
      '.cl-switch > input:checked{right:-10px;background-color:#85b8b7}' +
      '.cl-switch > input:checked + span::before{background-color:#85b8b7}' +
      '.cl-switch > input:checked + span::after{background-color:#018786;transform:translateX(16px)}' +
      '.cl-switch:hover > input{opacity:0.04}' +
      '.cl-switch > input:focus{opacity:0.12}' +
      '.cl-switch:hover > input:focus{opacity:0.16}' +
      '.cl-switch > input:active{opacity:1;transform:scale(0);transition:transform 0s,opacity 0s}' +
      '.cl-switch > input:active + span::before{background-color:#8f8f8f}' +
      '.cl-switch > input:checked:active + span::before{background-color:#85b8b7}' +
      '.cl-switch > input:disabled{opacity:0}' +
      '.cl-switch > input:disabled + span::before{background-color:#ddd}' +
      '.cl-switch > input:checked:disabled + span::before{background-color:#bfdbda}' +
      '.cl-switch > input:checked:disabled + span::after{background-color:#61b5b4}' +
      '.gp-toggle-row{display:flex;align-items:center;gap:10px;margin:8px 0;min-height:28px;flex-wrap:nowrap}' +
      '.gp-toggle-text{font-weight:800;font-size:13px;color:#102a43;line-height:1.4;white-space:nowrap}' +
      '#gpChannelBox .cl-switch,#modal .cl-switch,#customerAdd .cl-switch,#salesPlans .cl-switch{background:transparent!important;border:0!important;padding:0!important}' +
      '.customCheckBox{height:32px;min-width:68px;padding:2px 12px}' +
      '.customCheckBox .inner{font-size:13px}' +
      '@media (max-width:720px){.customCheckBox{height:34px;min-width:60px;padding:2px 10px}.customCheckBox .inner{font-size:12px}.gp-toggle-text{font-size:12px}}';
    document.head.appendChild(css);
  }

  function skipFresh(inp) {
    if (!inp || inp.type !== 'checkbox') return true;
    if (inp.closest('.cl-switch')) return true;
    if (inp.classList.contains('customCheckBoxInput')) return true;
    if (inp.closest('table')) return true;
    if (inp.closest('.gp-channel-legacy') || inp.classList.contains('hidden')) return true;
    if (inp.classList.contains('gp-plan-pick') || inp.classList.contains('returnSerialCheck')) return true;
    if (inp.classList.contains('newrole') || inp.classList.contains('editrole')) return true;
    if (/^(isMarketer|hasMarketer|eIsMarketer|eHasMarketer)$/.test(inp.id || '')) return true;
    return false;
  }

  function textOf(inp) {
    var row = inp.closest('.gp-toggle-row');
    if (row) {
      var t = row.querySelector('.gp-toggle-text');
      if (t) return t.textContent.replace(/\s+/g, ' ').trim();
    }
    var lab = inp.closest('label');
    if (lab && !lab.classList.contains('cl-switch')) {
      return String(lab.textContent || '').replace(/\s+/g, ' ').trim();
    }
    return '';
  }

  function mountCl(inp, text) {
    if (!inp.id) inp.id = 'gpTog_' + Math.random().toString(36).slice(2, 8);
    inp.dataset.gpToggle = '1';
    inp.style.display = '';
    var box = document.createElement('div');
    box.className = 'cl-toggle-switch';
    var lab = document.createElement('label');
    lab.className = 'cl-switch';
    var track = document.createElement('span');
    lab.appendChild(inp);
    lab.appendChild(track);
    box.appendChild(lab);
    var row = document.createElement('div');
    row.className = 'gp-toggle-row';
    row.appendChild(box);
    if (text) {
      var span = document.createElement('span');
      span.className = 'gp-toggle-text';
      span.textContent = text;
      row.appendChild(span);
    }
    return row;
  }

  function migrate(inp) {
    if (!inp || inp.closest('.cl-switch')) return;
    var old = inp.closest('.toggle-border');
    var oldRow = inp.closest('.gp-toggle-row');
    var lab = !old && inp.closest('label');
    var text = textOf(inp);
    var row = mountCl(inp, text);
    if (oldRow && oldRow.parentNode) {
      oldRow.parentNode.insertBefore(row, oldRow);
      oldRow.remove();
      return;
    }
    if (old && old.parentNode) {
      old.parentNode.insertBefore(row, old);
      old.remove();
      return;
    }
    if (lab && lab.parentNode) {
      lab.parentNode.insertBefore(row, lab);
      lab.remove();
      return;
    }
    if (inp.parentNode) inp.parentNode.insertBefore(row, inp);
  }

  function upgrade(root) {
    root = root || document;
    [].forEach.call(root.querySelectorAll('input[type="checkbox"]'), function (inp) {
      if (inp.closest('.toggle-border') || inp.closest('.gp-toggle-row')) {
        migrate(inp);
        return;
      }
      if (skipFresh(inp)) return;
      if (inp.offsetParent === null && !inp.closest('#modal')) return;
      migrate(inp);
    });
  }

  function watch() {
    if (document.__gpClToggleWatch) return;
    document.__gpClToggleWatch = true;
    var obs = new MutationObserver(function () {
      if (watch._q) return;
      watch._q = true;
      setTimeout(function () {
        watch._q = false;
        try { upgrade(); } catch (e) {}
      }, 40);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  function apply() {
    try { ensureStyle(); } catch (e) {}
    try { upgrade(); } catch (e) {}
    try { watch(); } catch (e) {}
  }

  apply();
  [160, 700, 1600, 2800, 4500].forEach(function (ms) { setTimeout(apply, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 40); });
  }
})();
