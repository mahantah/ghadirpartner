/* GP_WH_LABEL_V1_20261026 */
(function () {
  'use strict';
  if (window.__gpWhLabelV1) return;
  window.__gpWhLabelV1 = true;

  var DAILY = 'تاریخچه و موجودی کالا';
  var VAULT = 'انبار سریال';

  function setBtn(sel, text) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (btn) {
      if (!btn || btn.closest('#gpSearchFabRoot')) return;
      var span = btn.querySelector('.gp-menu-text');
      if (span) {
        if (span.textContent !== text) span.textContent = text;
        return;
      }
      var icon = btn.querySelector('svg, .gp-menu-icon');
      if (icon) {
        Array.prototype.slice.call(btn.childNodes).forEach(function (n) {
          if (n.nodeType === 3 && String(n.textContent || '').trim()) n.remove();
        });
        var t = document.createElement('span');
        t.className = 'gp-menu-text';
        t.textContent = text;
        btn.appendChild(t);
        return;
      }
      if ((btn.textContent || '').replace(/\s+/g, ' ').trim() !== text) btn.textContent = text;
    });
  }

  function setIfOld(el, next) {
    if (!el) return;
    var cur = String(el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!cur) return;
    if (/دفتر روزانه/.test(cur) || cur === 'مخزن انبار' || cur === next) el.textContent = next;
  }

  function relabelPages() {
    setIfOld(document.getElementById('warehousePrintTitle'), DAILY);
    Array.prototype.forEach.call(document.querySelectorAll('#warehouseDaily h3, #warehouseDaily .section-title h3'), function (h) {
      setIfOld(h, DAILY);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.gp-page-head h2, #warehouse .gp-page-head h2'), function (h) {
      setIfOld(h, VAULT);
    });
  }

  function relabelFab() {
    var title = document.querySelector('#gpSearchFabRoot .gp-fab-head b');
    var sub = document.getElementById('gpFabSub');
    if (title) {
      if (/مخزن انبار/.test(title.textContent || '')) title.textContent = 'جستجو و فیلتر انبار سریال';
      if (/دفتر روزانه/.test(title.textContent || '')) title.textContent = 'جستجو در تاریخچه و موجودی کالا';
    }
    if (sub) {
      if (/دفتر روزانه/.test(sub.textContent || '')) sub.textContent = 'ماه و مدل دستگاه';
    }
    Array.prototype.forEach.call(document.querySelectorAll('#gpFabPane_warehouseDaily .gp-fab-label, #gpFabPane_warehouse .gp-fab-label'), function (lab) {
      var t = lab.textContent || '';
      if (/دفتر روزانه/.test(t)) lab.textContent = t.replace(/دفتر روزانه( انبار)?/g, 'تاریخچه و موجودی');
      if (/مخزن انبار/.test(t)) lab.textContent = t.replace(/مخزن انبار/g, 'انبار سریال');
    });
  }

  function apply() {
    setBtn('.topnav [data-tab="warehouseDaily"]', DAILY);
    setBtn('.topnav [data-tab="warehouse"]', VAULT);
    relabelPages();
    relabelFab();
  }

  apply();
  [160, 700, 1600, 2800, 4500].forEach(function (ms) { setTimeout(apply, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 40); });
  }
  document.addEventListener('click', function (ev) {
    if (ev.target.closest('[data-tab], .nav-group-toggle, #gpSearchFab')) setTimeout(apply, 30);
  });
  if (!document.__gpWhLabelWatch) {
    document.__gpWhLabelWatch = true;
    var nav = document.querySelector('.topnav');
    var obs = new MutationObserver(function () {
      if (obs._q) return;
      obs._q = true;
      setTimeout(function () { obs._q = false; apply(); }, 60);
    });
    if (nav) obs.observe(nav, { childList: true, subtree: true, characterData: true });
    if (document.body) obs.observe(document.body, { childList: true, subtree: true });
  }
})();
