/* GP_CHOICE_UI_ICONS_V1_20261025 */
(function () {
  'use strict';
  if (window.__gpChoiceUiIconsV1) return;
  window.__gpChoiceUiIconsV1 = true;

  var STYLE_ID = 'gp-choice-ui-icons-v1-css';
  var ICONS = {
    gpNavAddCustomer: 'M15 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0ZM3 21v-2a6 6 0 0 1 12 0v2M19 8v8M15 12h8',
    gpNavKartabl: 'M8 3h8l1 3h4v15H3V6h4l1-3ZM8 12h8M8 16h5M9 3v3h6V3',
    gpNavAgents: 'M8 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2 21v-2.2A5.5 5.5 0 0 1 13 19v2M16 8h6M19 5v6M16 16l2 2 4-4',
    gpNavReps: 'M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-3a6 6 0 0 1 12 0v3M17 8a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM14 21v-2a4.8 4.8 0 0 1 8-3.5',
    gpNavPlans: 'M9 9h.01M15 15h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9 15l6-6'
  };

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent =
      '#ctbody tr.gp-coop-rep td{background:#fff!important}' +
      '#ctbody tr.gp-coop-rep td:first-child{border-right:0!important}' +
      '.gp-coop-badge.rep{background:#fff;color:#334155;border:1px solid #d7dee7}' +
      '#gpCoopLegend i.rep{background:#fff;border:1px solid #c5ced8}' +
      '.customCheckBoxHolder{margin:5px 0;display:flex;flex-wrap:wrap;direction:rtl}' +
      '.customCheckBox{width:fit-content;position:relative;overflow:hidden;cursor:pointer;user-select:none;padding:2px 8px;background-color:rgba(0,0,0,0.16);border-radius:0;color:#222;transition-timing-function:cubic-bezier(0.25,0.8,0.25,1);transition-duration:300ms;transition-property:color,background-color,box-shadow;display:flex;height:32px;align-items:center;box-shadow:rgba(0,0,0,0.15) 0 2px 1px 0 inset,rgba(255,255,255,0.17) 0 1px 1px 0;outline:none;justify-content:center;min-width:55px}' +
      '.customCheckBox:hover{background-color:#2c2c2c;color:#fff;box-shadow:rgba(0,0,0,0.23) 0 -4px 1px 0 inset,rgba(255,255,255,0.17) 0 -1px 1px 0,rgba(0,0,0,0.17) 0 2px 4px 1px}' +
      '.customCheckBox .inner{font-size:13px;font-weight:900;pointer-events:none;transition:transform 300ms cubic-bezier(0.25,0.8,0.25,1);transform:translateY(0);white-space:nowrap}' +
      '.customCheckBox:hover .inner{transform:translateY(-2px)}' +
      '.customCheckBoxInput{display:none}' +
      '.customCheckBoxInput:checked + .customCheckBoxWrapper .customCheckBox{background-color:#2d6737;color:#fff;box-shadow:rgba(0,0,0,0.23) 0 -4px 1px 0 inset,rgba(255,255,255,0.17) 0 -1px 1px 0,rgba(0,0,0,0.17) 0 2px 4px 1px}' +
      '.customCheckBoxInput:checked + .customCheckBoxWrapper .customCheckBox .inner{transform:translateY(-2px)}' +
      '.customCheckBoxInput:checked + .customCheckBoxWrapper .customCheckBox:hover{background-color:#34723f;box-shadow:rgba(0,0,0,0.26) 0 -4px 1px 0 inset,rgba(255,255,255,0.17) 0 -1px 1px 0,rgba(0,0,0,0.15) 0 3px 6px 2px}' +
      '.customCheckBoxHolder > .customCheckBoxInput:first-child + .customCheckBoxWrapper .customCheckBox{border-top-right-radius:5px;border-bottom-right-radius:5px}' +
      '.customCheckBoxHolder > .customCheckBoxWrapper:last-of-type .customCheckBox{border-top-left-radius:5px;border-bottom-left-radius:5px}' +
      '.customCheckBoxWrapper{margin:0}' +
      '#gpChannelBox .gp-channel-row:has(.customCheckBoxHolder),#gpEditCoopBox .gp-channel-row:has(.customCheckBoxHolder){display:block;border:0;padding:0;background:transparent}' +
      'select.gp-choice-hidden{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important}';
    document.head.appendChild(css);
  }

  function setIcon(id, d) {
    var btn = $(id);
    if (!btn || !d) return;
    var svg = btn.querySelector('.gp-menu-icon');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'gp-menu-icon');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '1.8');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('aria-hidden', 'true');
      var text = btn.querySelector('.gp-menu-text');
      if (text) btn.insertBefore(svg, text);
      else btn.insertBefore(svg, btn.firstChild);
    }
    var path = svg.querySelector('path');
    if (!path) {
      path = document.createElementNS(svg.namespaceURI, 'path');
      svg.appendChild(path);
    }
    if (path.getAttribute('d') !== d) path.setAttribute('d', d);
  }

  function paintIcons() {
    Object.keys(ICONS).forEach(function (id) { setIcon(id, ICONS[id]); });
  }

  function liveCustomers() {
    var list = [];
    try { if (typeof CUST !== 'undefined' && Array.isArray(CUST)) list = CUST; } catch (e) {}
    if (!list.length && Array.isArray(window.CUST)) list = window.CUST;
    return list;
  }

  function kindOf(c) {
    if (!c) return '';
    var lock = (window.__gpCoopLock || {})[+c.id];
    if (lock) c = Object.assign({}, c, lock);
    var ch = String(c.sales_channel || c.rep_role || '').toLowerCase();
    if (ch === 'agent' || ch === 'sales_agent') return 'agent';
    if (c.parent_marketer_id) return 'sub';
    if (c.rep_role === 'rep') return 'rep';
    if (c.is_marketer) return 'marketer';
    if (ch === 'rep') return 'rep';
    return '';
  }

  function paintRepWhite() {
    var body = $('ctbody');
    if (!body) return;
    var byId = {};
    liveCustomers().forEach(function (c) { if (c) byId[c.id] = c; });
    [].forEach.call(body.querySelectorAll('tr'), function (tr) {
      var pick = tr.querySelector('.gp-plan-pick,[data-id]');
      var id = pick && (pick.getAttribute('data-id') || pick.value);
      var c = byId[id];
      if (!c) return;
      if (kindOf(c) !== 'rep') return;
      tr.classList.remove('gp-coop-marketer', 'gp-coop-agent', 'gp-coop-sub', 'gp-coop-rep');
      tr.classList.add('gp-coop-rep');
      [].forEach.call(tr.querySelectorAll('td'), function (td) {
        td.style.background = '#fff';
      });
      var badge = tr.querySelector('.gp-coop-badge');
      if (badge) {
        badge.className = 'gp-coop-badge rep';
        badge.textContent = 'نماینده';
      }
    });
    var legend = $('gpCoopLegend');
    if (legend && !legend.querySelector('i.rep')) {
      var span = document.createElement('span');
      span.innerHTML = '<i class="rep"></i> نماینده';
      legend.appendChild(span);
    }
  }

  function chipLabel(text) {
    var wrap = document.createElement('label');
    wrap.className = 'customCheckBoxWrapper';
    wrap.innerHTML = '<div class="customCheckBox"><div class="inner">' + esc(text) + '</div></div>';
    return wrap;
  }

  function hostOf(el) {
    return el.closest('.gp-channel-row') ||
      el.closest('.mutedbox') ||
      el.closest('#gpChannelBox') ||
      el.closest('#gpEditCoopBox') ||
      el.closest('#modalbody') ||
      el.closest('.card') ||
      el.parentNode;
  }

  function upgradeRadioName(name, root) {
    root = root || document;
    var nodes = [].filter.call(root.querySelectorAll('input[name="' + name + '"]'), function (el) {
      return !el.classList.contains('customCheckBoxInput');
    });
    if (nodes.length < 2) return;
    var host = hostOf(nodes[0]);
    var holder = document.createElement('div');
    holder.className = 'customCheckBoxHolder';
    holder.setAttribute('data-gp-choice', name);
    nodes.forEach(function (inp) {
      var lab = inp.closest('label');
      var text = (lab ? lab.textContent : inp.value || '').replace(/\s+/g, ' ').trim();
      if (!inp.id) inp.id = name + '_' + inp.value;
      inp.classList.add('customCheckBoxInput');
      var chip = chipLabel(text);
      chip.htmlFor = inp.id;
      if (lab && lab.parentNode) {
        lab.parentNode.insertBefore(inp, lab);
        lab.remove();
      }
      holder.appendChild(inp);
      holder.appendChild(chip);
    });
    if (host) {
      if (host.classList && host.classList.contains('gp-channel-row')) host.innerHTML = '';
      host.appendChild(holder);
    }
  }

  function upgradeSelect(sel) {
    if (!sel || sel.dataset.gpChoice === '1') return;
    var opts = [].filter.call(sel.options, function (o) { return o.value; });
    if (opts.length < 2) return;
    sel.dataset.gpChoice = '1';
    sel.classList.add('gp-choice-hidden');
    var holder = document.createElement('div');
    holder.className = 'customCheckBoxHolder';
    holder.setAttribute('data-gp-choice', sel.id);
    opts.forEach(function (opt) {
      var id = sel.id + '_' + opt.value;
      var inp = document.createElement('input');
      inp.type = 'radio';
      inp.name = sel.id + '_choice';
      inp.value = opt.value;
      inp.id = id;
      inp.className = 'customCheckBoxInput';
      inp.checked = sel.value === opt.value;
      var chip = chipLabel(opt.text);
      chip.htmlFor = id;
      inp.addEventListener('change', function () {
        if (!inp.checked) return;
        sel.value = inp.value;
        try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
      });
      holder.appendChild(inp);
      holder.appendChild(chip);
    });
    if (sel.parentNode) sel.parentNode.insertBefore(holder, sel.nextSibling);
    if (!sel.__gpChoiceSync) {
      sel.__gpChoiceSync = true;
      sel.addEventListener('change', function () {
        [].forEach.call(holder.querySelectorAll('input'), function (inp) {
          inp.checked = inp.value === sel.value;
        });
      });
    }
  }

  function upgradeChecks(ids, labels) {
    var nodes = ids.map(function (id) { return $(id); }).filter(function (el) {
      return el && !el.classList.contains('customCheckBoxInput');
    });
    if (nodes.length < 2) return;
    var host = hostOf(nodes[0]);
    var holder = document.createElement('div');
    holder.className = 'customCheckBoxHolder';
    holder.setAttribute('data-gp-choice', ids[0]);
    nodes.forEach(function (inp, i) {
      var lab = inp.closest('label');
      var text = labels[i] || (lab ? lab.textContent : inp.id).replace(/\s+/g, ' ').trim();
      inp.classList.add('customCheckBoxInput');
      var chip = chipLabel(text);
      chip.htmlFor = inp.id;
      if (lab && lab.parentNode) {
        lab.parentNode.insertBefore(inp, lab);
        lab.remove();
      }
      holder.appendChild(inp);
      holder.appendChild(chip);
    });
    if (host) host.appendChild(holder);
  }

  function upgradeAll() {
    upgradeRadioName('gpChannel');
    upgradeRadioName('gpEditChannel');
    upgradeRadioName('gpOpsChannel');
    upgradeRadioName('gpPlanAud');
    upgradeSelect($('gpRepRole'));
    upgradeSelect($('gpEditRepRole'));
    upgradeSelect($('gpOpsRole'));
    upgradeChecks(['cp_agent', 'cp_panel', 'cp_serial'], ['عامل فروش', 'ثبت در پنل', 'سریال آزاد']);
    upgradeChecks(['ep_agent', 'ep_panel', 'ep_serial'], ['عامل فروش', 'ثبت در پنل', 'سریال آزاد']);
    upgradeChecks(['mp_agent', 'mp_panel', 'mp_serial'], ['عامل فروش', 'ثبت در پنل', 'سریال آزاد']);
  }

  function wrapRender() {
    if (typeof window.renderCustomers === 'function' && !window.renderCustomers.__gpChoice1) {
      var base = window.renderCustomers;
      window.renderCustomers = function () {
        var out = base.apply(this, arguments);
        try { paintRepWhite(); } catch (e) {}
        return out;
      };
      window.renderCustomers.__gpChoice1 = true;
    }
  }

  function watch() {
    if (document.__gpChoiceWatch) return;
    document.__gpChoiceWatch = true;
    var obs = new MutationObserver(function () {
      if (watch._q) return;
      watch._q = true;
      setTimeout(function () {
        watch._q = false;
        try { upgradeAll(); paintIcons(); paintRepWhite(); } catch (e) {}
      }, 40);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  function apply() {
    try { ensureStyle(); } catch (e) {}
    try { paintIcons(); } catch (e) {}
    try { upgradeAll(); } catch (e) {}
    try { paintRepWhite(); } catch (e) {}
    try { wrapRender(); } catch (e) {}
    try { watch(); } catch (e) {}
  }

  apply();
  [160, 700, 1500, 2800, 4000, 5500].forEach(function (ms) { setTimeout(apply, ms); });
  setInterval(function () { try { paintIcons(); paintRepWhite(); } catch (e) {} }, 2000);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 40); });
  }
})();
