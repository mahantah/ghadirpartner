/* GP_SHAMSI_CALENDAR_TABLE_V1_20261025 */
(function () {
  'use strict';
  if (window.__gpShamsiCalendarTableV1) return;
  window.__gpShamsiCalendarTableV1 = true;

  var MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  var WEEK = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
  var MIN_YEAR = 1380;
  var MAX_YEAR = 1430;

  function pad(n) { return String(n).padStart(2, '0'); }

  function todayJalali() {
    var y, m, d;
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date());
      var map = {};
      parts.forEach(function (p) { map[p.type] = p.value; });
      y = +map.year; m = +map.month; d = +map.day;
    } catch (e) {
      var now = new Date();
      y = now.getFullYear(); m = now.getMonth() + 1; d = now.getDate();
    }
    var j = (typeof g2j === 'function') ? g2j(y, m, d) : [1405, 1, 1];
    return { y: j[0], m: j[1], d: j[2], text: j[0] + '/' + pad(j[1]) + '/' + pad(j[2]) };
  }

  function isJalaliLeap(jy) {
    return [1, 5, 9, 13, 17, 22, 26, 30].indexOf(((Number(jy) % 33) + 33) % 33) >= 0;
  }

  function monthDays(jy, jm) {
    jm = Number(jm);
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return isJalaliLeap(jy) ? 30 : 29;
  }

  function firstWeekday(jy, jm) {
    if (typeof j2g !== 'function') return 0;
    var g = j2g(Number(jy), Number(jm), 1);
    return (new Date(g[0], g[1] - 1, g[2]).getDay() + 1) % 7;
  }

  function parseJalali(value) {
    var m = String(value || '').trim().match(/^(\d{4})\/(\d{1,2})(?:\/(\d{1,2}))?$/);
    if (!m) return null;
    return { y: +m[1], m: +m[2], d: m[3] ? +m[3] : 0 };
  }

  function looksLikeDateInput(el) {
    if (!el || el.tagName !== 'INPUT' || el.type === 'hidden' || el.type === 'checkbox' || el.type === 'password' || el.type === 'file') return false;
    if (el.dataset.gpCalSkip === '1') return false;
    if (el.classList.contains('jdate') || el.type === 'date') return true;
    if (el.id === 'warehouseLedgerMonth') return true;
    var hint = String(el.placeholder || '') + ' ' + String(el.title || '') + ' ' + String(el.getAttribute('aria-label') || '');
    return /تاریخ|شمسی/.test(hint);
  }

  function monthOnly(el) {
    return el && (el.id === 'warehouseLedgerMonth' || el.dataset.gpCalMode === 'month' || /^\d{4}\/\d{2}$/.test(String(el.value || '').trim()));
  }

  function ensureWrap(input) {
    if (!input.id) input.id = 'gpCal_' + Math.random().toString(36).slice(2, 8);
    input.classList.add('jdate');
    input.setAttribute('readonly', 'readonly');
    input.style.cursor = 'pointer';
    var wrap = input.closest('.jdate-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'jdate-wrap';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
    }
    var pop = document.getElementById(input.id + '_picker');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = input.id + '_picker';
      pop.className = 'jdate-pop hidden';
      wrap.appendChild(pop);
    }
    if (!input.dataset.gpCalBound) {
      input.dataset.gpCalBound = '1';
      if (!/toggleJPicker/.test(String(input.getAttribute('onclick') || ''))) {
        input.addEventListener('click', function (e) {
          e.stopPropagation();
          window.toggleJPicker(input.id);
        });
      }
    }
    return pop;
  }

  function positionPop(pop, input) {
    if (!pop || !input) return;
    var rect = input.getBoundingClientRect();
    var width = Math.min(320, Math.max(280, window.innerWidth - 16));
    pop.style.position = 'fixed';
    pop.style.zIndex = '1000000';
    pop.style.width = width + 'px';
    pop.style.right = 'auto';
    var left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width));
    var top = rect.bottom + 6;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    requestAnimationFrame(function () {
      var h = pop.getBoundingClientRect().height || 320;
      if (top + h > window.innerHeight - 8) pop.style.top = Math.max(8, rect.top - h - 6) + 'px';
    });
  }

  function applyValue(target, y, m, d) {
    var input = $(target);
    if (!input) return;
    var next = monthOnly(input) ? (y + '/' + pad(m)) : (y + '/' + pad(m) + '/' + pad(d));
    input.value = next;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    closeJPickers();
    try {
      if (target.indexOf('whLabel') === 0 && typeof warehouseLabelCount === 'function') warehouseLabelCount();
      else if (target === 'warehouseLedgerMonth' && typeof renderWarehouseLedger === 'function') renderWarehouseLedger();
      else if (target.indexOf('offer') === 0) { /* keep offer form dirty */ }
      else if (typeof renderExitReport === 'function' && (target === 'repFrom' || target === 'repTo')) renderExitReport();
    } catch (e) {}
  }

  function renderCal(target, viewY, viewM) {
    var input = $(target);
    var pop = $(target + '_picker');
    if (!input || !pop) return;
    var today = todayJalali();
    var selected = parseJalali(input.value) || today;
    viewY = Math.max(MIN_YEAR, Math.min(MAX_YEAR, Number(viewY || selected.y || today.y)));
    viewM = Math.max(1, Math.min(12, Number(viewM || selected.m || today.m)));
    var days = monthDays(viewY, viewM);
    var start = firstWeekday(viewY, viewM);
    var years = '';
    for (var y = MIN_YEAR; y <= MAX_YEAR; y++) years += '<option value="' + y + '"' + (y === viewY ? ' selected' : '') + '>' + y + '</option>';
    var months = MONTHS.map(function (name, i) {
      var n = i + 1;
      return '<option value="' + n + '"' + (n === viewM ? ' selected' : '') + '>' + name + '</option>';
    }).join('');
    var cells = '';
    for (var i = 0; i < start; i++) cells += '<button type="button" class="empty" tabindex="-1" disabled></button>';
    for (var day = 1; day <= days; day++) {
      var cls = [];
      if (viewY === today.y && viewM === today.m && day === today.d) cls.push('today');
      if (selected.y === viewY && selected.m === viewM && selected.d === day) cls.push('selected');
      cells += '<button type="button" data-gp-cal="day" data-day="' + day + '" class="' + cls.join(' ') + '">' + Number(day).toLocaleString('fa-IR') + '</button>';
    }
    pop.dataset.viewY = String(viewY);
    pop.dataset.viewM = String(viewM);
    pop.innerHTML =
      '<div class="gp-cal">' +
        '<div class="gp-cal-nav">' +
          '<button type="button" data-gp-cal="prev" title="ماه قبل">‹</button>' +
          '<select class="jy">' + years + '</select>' +
          '<select class="jm">' + months + '</select>' +
          '<button type="button" data-gp-cal="next" title="ماه بعد">›</button>' +
        '</div>' +
        '<div class="gp-cal-week">' + WEEK.map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div>' +
        '<div class="gp-cal-days">' + cells + '</div>' +
        '<div class="toolbar" style="margin-top:8px">' +
          '<button type="button" data-gp-cal="today">امروز</button>' +
          '<button type="button" class="btnlight" data-gp-cal="clear">پاک کردن</button>' +
        '</div>' +
      '</div>';
    pop.classList.remove('hidden');
    positionPop(pop, input);
  }

  function bindPop(target) {
    var pop = $(target + '_picker');
    if (!pop || pop.dataset.gpCalBound) return;
    pop.dataset.gpCalBound = '1';
    pop.addEventListener('click', function (e) { e.stopPropagation(); });
    pop.addEventListener('change', function (e) {
      if (!e.target.classList.contains('jy') && !e.target.classList.contains('jm')) return;
      renderCal(target, pop.querySelector('.jy').value, pop.querySelector('.jm').value);
    });
    pop.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-gp-cal]');
      if (!btn) return;
      var act = btn.getAttribute('data-gp-cal');
      var y = +(pop.dataset.viewY || 1405);
      var m = +(pop.dataset.viewM || 1);
      if (act === 'prev') {
        if (m === 1) { y -= 1; m = 12; } else m -= 1;
        renderCal(target, y, m);
      } else if (act === 'next') {
        if (m === 12) { y += 1; m = 1; } else m += 1;
        renderCal(target, y, m);
      } else if (act === 'day') {
        applyValue(target, y, m, +btn.getAttribute('data-day'));
      } else if (act === 'today') {
        var t = todayJalali();
        applyValue(target, t.y, t.m, t.d);
      } else if (act === 'clear') {
        var input = $(target);
        if (input) {
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        closeJPickers();
        try {
          if (target.indexOf('whLabel') === 0 && typeof warehouseLabelCount === 'function') warehouseLabelCount();
          else if (typeof renderExitReport === 'function' && (target === 'repFrom' || target === 'repTo')) renderExitReport();
        } catch (err) {}
      }
    });
  }

  window.closeJPickers = function () {
    document.querySelectorAll('.jdate-pop').forEach(function (x) { x.classList.add('hidden'); });
  };

  window.toggleJPicker = function (target) {
    var input = $(target);
    if (!input) return;
    ensureWrap(input);
    var pop = $(target + '_picker');
    var wasOpen = pop && !pop.classList.contains('hidden');
    closeJPickers();
    if (wasOpen || !pop) return;
    bindPop(target);
    var cur = parseJalali(input.value) || todayJalali();
    renderCal(target, cur.y, cur.m || 1);
  };
  window.toggleJPicker.__gpFixed = true;
  window.toggleJPicker.__gpShamsiTable = true;

  window.setJDateInline = function (target) {
    var pop = $(target + '_picker');
    if (!pop) return;
    var y = +(pop.querySelector('.jy') && pop.querySelector('.jy').value);
    var m = +(pop.querySelector('.jm') && pop.querySelector('.jm').value);
    var dayBtn = pop.querySelector('.gp-cal-days button.selected') || pop.querySelector('.gp-cal-days button.today');
    var d = dayBtn ? +dayBtn.getAttribute('data-day') : 1;
    applyValue(target, y, m, d);
  };

  window.clearJDateInline = function (target) {
    var input = $(target);
    if (input) input.value = '';
    closeJPickers();
  };

  window.gpShamsiMonthDays = monthDays;
  window.gpShamsiIsLeap = isJalaliLeap;
  window.gpShamsiFirstWeekday = firstWeekday;

  function enhanceAll(root) {
    (root || document).querySelectorAll('input').forEach(function (el) {
      if (!looksLikeDateInput(el)) return;
      ensureWrap(el);
      if (monthOnly(el)) el.dataset.gpCalMode = 'month';
    });
  }

  if (!document.getElementById('gp-shamsi-cal-css')) {
    var css = document.createElement('style');
    css.id = 'gp-shamsi-cal-css';
    css.textContent =
      '.gp-cal{direction:rtl}' +
      '.gp-cal-nav{display:flex;gap:6px;align-items:center;margin-bottom:8px}' +
      '.gp-cal-nav button{width:34px;min-width:34px;height:34px;padding:0;font-size:18px;font-weight:900}' +
      '.gp-cal-nav select{flex:1;min-width:0;padding:7px 6px;font-weight:800}' +
      '.gp-cal-week,.gp-cal-days{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center}' +
      '.gp-cal-week span{font-size:11px;color:#64748b;font-weight:800;padding:4px 0}' +
      '.gp-cal-days button{height:32px;border:0;background:#f7f9fc;border-radius:8px;font-weight:800;cursor:pointer;color:#102a43}' +
      '.gp-cal-days button:hover{background:#eef4fb}' +
      '.gp-cal-days button.today{box-shadow:inset 0 0 0 1.5px #f58220}' +
      '.gp-cal-days button.selected{background:#f58220;color:#fff}' +
      '.gp-cal-days button.empty,.gp-cal-days button:disabled.empty{background:transparent;cursor:default;box-shadow:none}' +
      '.jdate-pop{width:300px;max-width:calc(100vw - 16px);z-index:1000000}' +
      '.jdate-wrap{position:relative;display:block}';
    document.head.appendChild(css);
  }

  enhanceAll(document);
  setTimeout(function () { enhanceAll(document); }, 400);
  setTimeout(function () { enhanceAll(document); }, 1200);
  var queued = false;
  new MutationObserver(function () {
    if (queued) return;
    queued = true;
    setTimeout(function () { queued = false; enhanceAll(document); }, 80);
  }).observe(document.body, { subtree: true, childList: true });
})();
