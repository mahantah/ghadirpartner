/* GP_NAV_TAB_GUARD_V1_20261026 */
(function () {
  'use strict';
  if (window.__gpNavTabGuardV1) return;
  window.__gpNavTabGuardV1 = true;

  var STYLE_ID = 'gp-nav-tab-guard-v1-css';
  var ROUTES = {
    gpNavPlans: 'salesPlans',
    gpNavKartabl: 'customers',
    gpNavAddCustomer: 'customerAdd',
    gpNavAgents: 'salesAgents',
    gpNavReps: 'salesReps',
    gpNavStocktake: 'stocktake',
    gpNavCatalog: 'portalAdmin'
  };

  function $(id) { return document.getElementById(id); }

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent =
      '.tab.hidden{display:none!important}' +
      '.tab:not(.hidden){display:block!important}' +
      '#gpNavPlans{display:flex!important}' +
      '#gpPlanPickWrap.hidden,#salesPlans #gpPlanPickWrap.hidden{display:none!important}' +
      '#salesPlans #gpPlanPickList{display:none}' +
      '#salesPlans #gpPlanPickWrap:not(.hidden) #gpPlanPickList{display:block!important}' +
      '#customers.hidden,#customerAdd.hidden,#salesAgents.hidden,#salesReps.hidden,' +
      '#salesPlans.hidden,#portalAdmin.hidden{display:none!important}';
    document.head.appendChild(css);
  }

  function grantTabs() {
    if (typeof window.canViewTab === 'function' && !window.canViewTab.__gpGuard1) {
      var base = window.canViewTab;
      window.canViewTab = function (tab) {
        if (tab === 'salesPlans' || tab === 'customerAdd' || tab === 'salesAgents' || tab === 'salesReps') {
          return base('customers') || base(tab);
        }
        if (tab === 'stocktake') return base('reports') || base('stocktake');
        return base(tab);
      };
      window.canViewTab.__gpGuard1 = true;
    }
  }

  function ensurePlansPage() {
    var sec = $('salesPlans');
    if (!sec) {
      sec = document.createElement('section');
      sec.id = 'salesPlans';
      sec.className = 'tab hidden';
      var after = $('salesReps') || $('customers');
      var host = (after && after.parentNode) || document.querySelector('.wrap') || document.body;
      if (after && after.parentNode) after.parentNode.insertBefore(sec, after.nextSibling);
      else host.appendChild(sec);
    }
    if (!sec.classList.contains('tab')) sec.className = (sec.className + ' tab').replace(/^\s+/, '');
    if (typeof window.ensurePage === 'function') {
      try { window.ensurePage(); } catch (e) {}
    }
    return sec;
  }

  function lockPlansNav() {
    var btn = $('gpNavPlans');
    if (!btn) return;
    btn.setAttribute('data-tab', 'salesPlans');
    btn.removeAttribute('data-gp-cview');
    btn.removeAttribute('data-gp-view');
    if (btn.dataset) {
      btn.dataset.tab = 'salesPlans';
      delete btn.dataset.gpCview;
      delete btn.dataset.gpView;
    }
  }

  function hidePlanCustomers() {
    var wrap = $('gpPlanPickWrap');
    var on = document.querySelector('#salesPlans input[name="gpPlanAud"]:checked');
    if (!wrap) return;
    var selected = on && on.value === 'selected';
    wrap.classList.toggle('hidden', !selected);
    if (!selected) wrap.classList.remove('is-open');
  }

  function isolate(tab) {
    if (!tab) return;
    if (tab === 'salesPlans') ensurePlansPage();
    document.querySelectorAll('.tab').forEach(function (sec) {
      var on = sec.id === tab;
      sec.classList.toggle('hidden', !on);
      if (on) sec.removeAttribute('hidden');
      else sec.setAttribute('hidden', 'hidden');
    });
    var el = $(tab);
    if (el) {
      el.classList.remove('hidden');
      el.removeAttribute('hidden');
    }
    if (tab === 'salesPlans') hidePlanCustomers();
    document.querySelectorAll('.topnav [data-tab]').forEach(function (b) {
      var id = b.id || '';
      var want = ROUTES[id] || b.getAttribute('data-tab');
      b.classList.toggle('active', want === tab);
    });
    var cg = $('gpCustomers');
    if (cg) {
      var inCust = ['customers', 'customerAdd', 'salesAgents', 'salesReps', 'salesPlans'].indexOf(tab) >= 0;
      cg.classList.toggle('has-active', inCust);
      if (inCust) cg.classList.add('open');
    }
  }

  function wrapShow() {
    if (typeof window.show !== 'function' || window.show.__gpGuard1) return;
    var base = window.show;
    window.show = function (t) {
      if (t === 'salesPlans') {
        ensurePlansPage();
        lockPlansNav();
      }
      var out;
      try { out = base.apply(this, arguments); } catch (e) { out = undefined; }
      try { isolate(t); } catch (err) {}
      return out;
    };
    window.show.__gpGuard1 = true;
  }

  function openTab(tab, ev) {
    if (!tab) return;
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    }
    if (tab === 'salesPlans') {
      ensurePlansPage();
      lockPlansNav();
    }
    if (typeof show === 'function') show(tab);
    isolate(tab);
    if (typeof setSidebar === 'function') setSidebar(false);
  }

  function onNavClick(ev) {
    var t = ev.target && ev.target.closest && ev.target.closest('#gpNavPlans, #gpNavKartabl, #gpNavAddCustomer, #gpNavAgents, #gpNavReps, #gpNavStocktake, #gpNavCatalog, .topnav [data-tab]');
    if (!t || t.classList.contains('nav-group-toggle')) return;
    if (t.closest && t.closest('.nav-group-toggle')) return;
    var tab = ROUTES[t.id] || t.getAttribute('data-tab');
    if (!tab) return;
    if (t.id === 'gpNavPlans' || tab === 'salesPlans') {
      openTab('salesPlans', ev);
      return;
    }
    if (ROUTES[t.id]) openTab(tab, ev);
  }

  function watchClicks() {
    if (document.__gpNavGuardClick) return;
    document.__gpNavGuardClick = true;
    document.addEventListener('click', onNavClick, true);
  }

  function bootFromUrl() {
    try {
      var u = new URL(location.href);
      var tab = u.searchParams.get('tab') || (location.hash || '').replace('#', '');
      if (tab === 'salesPlans') {
        ensurePlansPage();
        setTimeout(function () { openTab('salesPlans'); }, 80);
      }
    } catch (e) {}
  }

  function apply() {
    try { ensureStyle(); } catch (e) {}
    try { grantTabs(); } catch (e) {}
    try { lockPlansNav(); } catch (e) {}
    try { ensurePlansPage(); } catch (e) {}
    try { wrapShow(); } catch (e) {}
    try { watchClicks(); } catch (e) {}
    try { hidePlanCustomers(); } catch (e) {}
  }

  apply();
  bootFromUrl();
  [180, 700, 1600, 2800].forEach(function (ms) { setTimeout(apply, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 40); });
  }
})();
