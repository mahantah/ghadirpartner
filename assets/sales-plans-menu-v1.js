/* GP_SALES_PLANS_MENU_V1_20261025 */
(function () {
  'use strict';
  if (window.__gpSalesPlansMenuV1) return;
  window.__gpSalesPlansMenuV1 = true;

  var STYLE_ID = 'gp-sales-plans-menu-v1-css';

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function fold(s) {
    return String(s || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\s]+/g, ' ').trim().toLowerCase();
  }

  function liveCustomers() {
    var list = [];
    try { if (typeof CUST !== 'undefined' && Array.isArray(CUST)) list = CUST; } catch (e) {}
    if (!list.length && Array.isArray(window.CUST)) list = window.CUST;
    return list.filter(function (c) { return c && !c.deleted; });
  }

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent =
      '#gpKartablTools{display:none!important}' +
      '#customers .gp-plan-pick{display:none!important}' +
      '#customers table thead th:empty:first-child{display:none!important}' +
      '#customers table tbody td:has(.gp-plan-pick){display:none!important}' +
      '#gpPlanPickList{max-height:280px;overflow:auto;border:1px solid #e5ebf2;border-radius:12px;padding:8px;background:#fff;margin-top:8px}' +
      '#gpPlanPickList label{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px}' +
      '#gpPlanPickList label:hover{background:#f4f7fb}' +
      '#gpPlanPageMsg{margin-top:8px}';
    document.head.appendChild(css);
  }

  function grantTab() {
    if (window.TAB_ACCESS) {
      window.TAB_ACCESS.salesPlans = window.TAB_ACCESS.salesPlans || window.TAB_ACCESS.customers || ['sales', 'admin'];
    }
    if (typeof window.canViewTab === 'function' && !window.canViewTab.__gpPlans1) {
      var base = window.canViewTab;
      window.canViewTab = function (tab) {
        if (tab === 'salesPlans') return base('customers') || base('salesPlans');
        return base(tab);
      };
      window.canViewTab.__gpPlans1 = true;
    }
  }

  function customersSub() {
    return document.querySelector('#gpCustomers .nav-submenu') ||
      document.querySelector('#gpCustomers-items') ||
      ($('gpNavReps') && $('gpNavReps').parentNode);
  }

  function installNav() {
    var sub = customersSub();
    if (!sub) return;
    var btn = $('gpNavPlans');
    if (!btn) {
      var sample = $('gpNavReps') || $('gpNavKartabl') || sub.querySelector('[data-tab]');
      btn = document.createElement(sample && sample.tagName === 'A' ? 'a' : 'button');
      btn.id = 'gpNavPlans';
      btn.type = sample && sample.tagName === 'A' ? undefined : 'button';
      if (sample && sample.className) btn.className = sample.className;
      btn.innerHTML = sample && sample.querySelector('.gp-menu-text')
        ? '<span class="gp-menu-text">اعمال طرح جدید</span>'
        : 'اعمال طرح جدید';
    }
    btn.setAttribute('data-tab', 'salesPlans');
    btn.textContent = btn.querySelector('.gp-menu-text') ? btn.textContent : 'اعمال طرح جدید';
    if (btn.querySelector('.gp-menu-text')) btn.querySelector('.gp-menu-text').textContent = 'اعمال طرح جدید';
    btn.hidden = false;
    btn.classList.remove('hidden');
    btn.style.display = '';
    if (btn.parentNode !== sub) sub.appendChild(btn);
    else if (sub.lastElementChild !== btn) sub.appendChild(btn);
  }

  function ensurePage() {
    var sec = $('salesPlans');
    if (!sec) {
      sec = document.createElement('section');
      sec.id = 'salesPlans';
      sec.className = 'tab hidden';
      var after = $('salesReps') || $('customers') || document.querySelector('.wrap');
      if (after && after.parentNode) after.parentNode.insertBefore(sec, after.nextSibling);
      else document.body.appendChild(sec);
    }
    if (sec.dataset.gpReady === '1') return sec;
    sec.dataset.gpReady = '1';
    sec.innerHTML =
      '<div class="card">' +
        '<h3>اعمال طرح جدید</h3>' +
        '<div class="small">طرح را برای همه مشتریان یا فقط مشتری‌های دلخواه بسازید و اعمال کنید.</div>' +
        '<div class="mutedbox" style="margin-top:12px">' +
          '<label><input type="radio" name="gpPlanAud" value="all" style="width:auto" checked> همه مشتریان</label>' +
          '<label style="margin-right:16px"><input type="radio" name="gpPlanAud" value="selected" style="width:auto"> مشتری‌های دلخواه</label>' +
        '</div>' +
        '<div id="gpPlanPickWrap" class="hidden" style="margin-top:10px">' +
          '<input id="gpPlanCustSearch" placeholder="جستجوی مشتری برای انتخاب">' +
          '<div id="gpPlanPickList"></div>' +
        '</div>' +
        '<div class="grid" style="margin-top:12px">' +
          '<select id="gpPlanExisting"><option value="">طرح تازه بساز</option></select>' +
          '<input id="gpPlanTitle" placeholder="عنوان طرح یا تخفیف">' +
          '<input id="gpPlanBadge" placeholder="برچسب، مثال: فروش ویژه">' +
          '<input id="gpPlanDiscount" placeholder="تخفیف — درصد یا مبلغ" inputmode="numeric">' +
        '</div>' +
        '<textarea id="gpPlanDesc" style="width:100%;margin-top:8px" placeholder="توضیح طرح"></textarea>' +
        '<div class="toolbar" style="margin-top:10px">' +
          '<button type="button" onclick="gpSavePlanPage()">اعمال طرح</button>' +
          '<button class="btnlight" type="button" onclick="gpClearPlanPage()">فرم تازه</button>' +
        '</div>' +
        '<div id="gpPlanPageMsg" class="small"></div>' +
      '</div>' +
      '<div class="card">' +
        '<h3>طرح‌های ثبت‌شده</h3>' +
        '<div class="tablewrap"><table><thead><tr><th>عنوان</th><th>مخاطب</th><th>تخفیف</th><th>وضعیت</th><th>عملیات</th></tr></thead>' +
        '<tbody id="gpPlanTable"></tbody></table></div>' +
      '</div>';
    if ($('gpPlanCustSearch')) $('gpPlanCustSearch').addEventListener('input', paintPickList);
    [].forEach.call(sec.querySelectorAll('input[name="gpPlanAud"]'), function (r) {
      r.addEventListener('change', syncAudience);
    });
    if ($('gpPlanExisting')) $('gpPlanExisting').addEventListener('change', fillFromExisting);
    return sec;
  }

  function syncAudience() {
    var on = document.querySelector('#salesPlans input[name="gpPlanAud"]:checked');
    var wrap = $('gpPlanPickWrap');
    if (wrap) wrap.classList.toggle('hidden', !on || on.value !== 'selected');
    if (on && on.value === 'selected') paintPickList();
  }

  function paintPickList() {
    var box = $('gpPlanPickList');
    if (!box) return;
    var q = fold($('gpPlanCustSearch') && $('gpPlanCustSearch').value);
    var rows = liveCustomers().filter(function (c) {
      if (!q) return true;
      return fold([c.code, c.name, c.company, c.mobile].join(' ')).indexOf(q) >= 0;
    }).slice(0, 80);
    var keep = {};
    [].forEach.call(document.querySelectorAll('#gpPlanPickList input:checked'), function (el) {
      keep[el.value] = true;
    });
    if (!rows.length) {
      box.innerHTML = '<div class="small" style="padding:12px;text-align:center">مشتری‌ای پیدا نشد</div>';
      return;
    }
    box.innerHTML = rows.map(function (c) {
      return '<label><input type="checkbox" value="' + c.id + '" style="width:auto"' +
        (keep[c.id] ? ' checked' : '') + '> <span><b>' + esc(c.name || '-') + '</b> — ' +
        esc([c.code, c.company, c.mobile].filter(Boolean).join(' | ') || 'بدون کد') + '</span></label>';
    }).join('');
  }

  async function loadOffers() {
    try {
      if (typeof loadPortalOffers === 'function') await loadPortalOffers();
      else window.PORTAL_OFFERS = await req('/api/offers');
    } catch (e) {
      window.PORTAL_OFFERS = window.PORTAL_OFFERS || [];
    }
    return window.PORTAL_OFFERS || [];
  }

  function fillOfferSelect(keep) {
    var sel = $('gpPlanExisting');
    if (!sel) return;
    var rows = window.PORTAL_OFFERS || [];
    sel.innerHTML = '<option value="">طرح تازه بساز</option>' + rows.map(function (o) {
      return '<option value="' + o.id + '"' + (String(o.id) === String(keep) ? ' selected' : '') + '>' +
        esc(o.title || 'طرح') + '</option>';
    }).join('');
  }

  function fillFromExisting() {
    var id = $('gpPlanExisting') && +$('gpPlanExisting').value;
    var o = (window.PORTAL_OFFERS || []).filter(function (x) { return +x.id === id; })[0];
    if (!o) return;
    if ($('gpPlanTitle')) $('gpPlanTitle').value = o.title || '';
    if ($('gpPlanBadge')) $('gpPlanBadge').value = o.badge || '';
    if ($('gpPlanDesc')) $('gpPlanDesc').value = o.description || '';
    if ($('gpPlanDiscount')) $('gpPlanDiscount').value = o.discount_value || '';
    var aud = (o.audience || 'all') === 'selected' ? 'selected' : 'all';
    [].forEach.call(document.querySelectorAll('#salesPlans input[name="gpPlanAud"]'), function (r) {
      r.checked = r.value === aud;
    });
    syncAudience();
    if (aud === 'selected') {
      var ids = (o.customer_ids || []).map(Number);
      paintPickList();
      [].forEach.call(document.querySelectorAll('#gpPlanPickList input'), function (el) {
        el.checked = ids.indexOf(+el.value) >= 0;
      });
    }
  }

  function audienceText(o) {
    if ((o.audience || 'all') === 'all') return 'همه مشتریان';
    var n = (o.customer_ids || []).length;
    return n ? n.toLocaleString('fa-IR') + ' مشتری منتخب' : 'مشتری منتخب';
  }

  function paintTable() {
    var body = $('gpPlanTable');
    if (!body) return;
    var rows = window.PORTAL_OFFERS || [];
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="5"><div class="small" style="text-align:center;padding:24px">طرحی ثبت نشده است.</div></td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (o) {
      return '<tr><td><b>' + esc(o.title || '-') + '</b><div class="small">' + esc(o.description || '') +
        '</div></td><td>' + esc(audienceText(o)) + '</td><td>' + esc(o.discount_value || o.badge || '-') +
        '</td><td>' + (o.active ? 'فعال' : 'غیرفعال') + '</td><td>' +
        '<button class="btnlight" type="button" onclick="gpEditPlanPage(' + o.id + ')">ویرایش</button></td></tr>';
    }).join('');
  }

  window.gpEditPlanPage = function (id) {
    if ($('gpPlanExisting')) $('gpPlanExisting').value = String(id);
    fillFromExisting();
    var form = $('salesPlans') && $('salesPlans').querySelector('.card');
    if (form) try { form.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
  };

  window.gpClearPlanPage = function () {
    ['gpPlanTitle', 'gpPlanBadge', 'gpPlanDiscount', 'gpPlanDesc', 'gpPlanCustSearch'].forEach(function (id) {
      if ($(id)) $(id).value = '';
    });
    if ($('gpPlanExisting')) $('gpPlanExisting').value = '';
    [].forEach.call(document.querySelectorAll('#salesPlans input[name="gpPlanAud"]'), function (r) {
      r.checked = r.value === 'all';
    });
    syncAudience();
    if ($('gpPlanPageMsg')) $('gpPlanPageMsg').textContent = '';
  };

  window.gpSavePlanPage = async function () {
    var msg = $('gpPlanPageMsg');
    try {
      var aud = (document.querySelector('#salesPlans input[name="gpPlanAud"]:checked') || {}).value || 'all';
      var ids = [].map.call(document.querySelectorAll('#gpPlanPickList input:checked'), function (el) { return +el.value; }).filter(Boolean);
      if (aud === 'selected' && !ids.length) throw new Error('حداقل یک مشتری را انتخاب کنید');
      var existing = $('gpPlanExisting') && +$('gpPlanExisting').value;
      var offers = window.PORTAL_OFFERS || [];
      var src = existing ? offers.filter(function (o) { return +o.id === existing; })[0] : null;
      var title = ($('gpPlanTitle') && $('gpPlanTitle').value.trim()) || (src && src.title) || '';
      if (!title) throw new Error('عنوان طرح را بنویسید');
      await req('/api/offers/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: existing || 0,
          title: title,
          badge: ($('gpPlanBadge') && $('gpPlanBadge').value) || (src && src.badge) || 'طرح ویژه',
          description: ($('gpPlanDesc') && $('gpPlanDesc').value) || (src && src.description) || '',
          product: src && src.product || '',
          start_date: src && src.start_date || '',
          end_date: src && src.end_date || '',
          active: true,
          audience: aud === 'selected' ? 'selected' : 'all',
          customer_ids: aud === 'selected' ? ids : [],
          discount_value: $('gpPlanDiscount') ? $('gpPlanDiscount').value : ''
        })
      });
      if (msg) { msg.className = 'ok'; msg.textContent = 'طرح اعمال شد'; }
      toast('طرح اعمال شد');
      await loadOffers();
      fillOfferSelect(existing || '');
      paintTable();
      gpClearPlanPage();
    } catch (e) {
      if (msg) { msg.className = 'msg'; msg.textContent = e.message; }
      else alert(e.message);
    }
  };

  async function renderPage() {
    ensurePage();
    await loadOffers();
    fillOfferSelect($('gpPlanExisting') && $('gpPlanExisting').value);
    syncAudience();
    paintTable();
  }

  function openPlans(ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    }
    ensurePage();
    if (typeof show === 'function') show('salesPlans');
    renderPage();
    if (typeof setSidebar === 'function') setSidebar(false);
  }

  function wrapShow() {
    if (typeof window.show === 'function' && !window.show.__gpPlans1) {
      var base = window.show;
      window.show = function (t) {
        if (t === 'salesPlans') ensurePage();
        var out = base.apply(this, arguments);
        try {
          var btn = $('gpNavPlans');
          if (btn) btn.classList.toggle('active', t === 'salesPlans');
          var cg = $('gpCustomers');
          if (cg && t === 'salesPlans') cg.classList.add('has-active', 'open');
          if (t === 'salesPlans') renderPage();
        } catch (e) {}
        return out;
      };
      window.show.__gpPlans1 = true;
    }
    if (!document.__gpPlansClick) {
      document.__gpPlansClick = true;
      document.addEventListener('click', function (ev) {
        var t = ev.target && ev.target.closest && ev.target.closest('#gpNavPlans');
        if (!t) return;
        openPlans(ev);
      }, true);
    }
  }

  function apply() {
    try { ensureStyle(); } catch (e) {}
    try { grantTab(); } catch (e) {}
    try { installNav(); } catch (e) {}
    try { ensurePage(); } catch (e) {}
    try { wrapShow(); } catch (e) {}
    var tools = $('gpKartablTools');
    if (tools) tools.style.display = 'none';
  }

  apply();
  [220, 800, 1800, 3200].forEach(function (ms) { setTimeout(apply, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 60); });
  }
})();
