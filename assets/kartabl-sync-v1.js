/* GP_KARTABL_SYNC_V1_20261025 */
(function () {
  'use strict';
  if (window.__gpKartablSyncV1) return;
  window.__gpKartablSyncV1 = true;

  var STYLE_ID = 'gp-kartabl-sync-v1-css';
  var PRICE_TITLE = 'تنظیمات مشاهده قیمت‌ها';

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function syncGlobals() {
    try { if (typeof CUST !== 'undefined') window.CUST = CUST; } catch (e) {}
    try { if (typeof ORD !== 'undefined') window.ORD = ORD; } catch (e) {}
    try { if (typeof USERS !== 'undefined') window.USERS = USERS; } catch (e) {}
    try { if (typeof PORTAL_OFFERS !== 'undefined') window.PORTAL_OFFERS = PORTAL_OFFERS; } catch (e) {}
    try { if (typeof PORTAL_ACCOUNTS !== 'undefined') window.PORTAL_ACCOUNTS = PORTAL_ACCOUNTS; } catch (e) {}
  }

  function customers() {
    syncGlobals();
    var list = [];
    try { if (typeof CUST !== 'undefined' && Array.isArray(CUST)) list = CUST; } catch (e) {}
    if (!list.length && Array.isArray(window.CUST)) list = window.CUST;
    return list.filter(function (c) { return c && !c.deleted; });
  }

  function isActive(c) {
    if (typeof window.gpCustomerActive === 'function') return window.gpCustomerActive(c);
    return !c || !Object.prototype.hasOwnProperty.call(c, 'active') || !!c.active;
  }

  function kindOf(c) {
    if (!c) return '';
    var ch = String(c.sales_channel || '').toLowerCase();
    if (ch === 'agent') return 'agent';
    if (ch === 'rep' || c.is_marketer || c.parent_marketer_id) {
      return c.parent_marketer_id ? 'sub' : 'marketer';
    }
    return '';
  }

  function kindLabel(kind) {
    return kind === 'agent' ? 'عامل فروش' : kind === 'marketer' ? 'بازاریاب' : kind === 'sub' ? 'زیرمجموعه بازاریاب' : '';
  }

  function parentOf(c) {
    if (typeof marketerParent === 'function') return marketerParent(c);
    var id = c && c.parent_marketer_id;
    if (!id) return null;
    return customers().filter(function (x) { return +x.id === +id; })[0] || null;
  }

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent =
      '#customers .card:has(#ctbody),#customers .card:has(#custSearch){display:block!important;visibility:visible!important}' +
      '#gpKartablTools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px}' +
      '#ctbody tr.gp-coop-agent td{background:#d8f5e3!important}' +
      '#ctbody tr.gp-coop-marketer td{background:#ffe0bf!important}' +
      '#ctbody tr.gp-coop-sub td{background:#fff1dd!important}' +
      '#users .checks,#users .newrole,#users label:has(.newrole){display:none!important}' +
      '#users table th:nth-child(3),#users table td:nth-child(3){display:none}' +
      '.customer-menu button{display:block;width:100%;text-align:right}' +
      '.gp-ops-sep{height:1px;background:#edf1f5;margin:6px 0}';
    document.head.appendChild(css);
  }

  function showCard(el) {
    if (!el) return;
    el.classList.remove('hidden');
    el.hidden = false;
    if (el.style) el.style.display = '';
  }

  function revealKartabl() {
    var body = $('ctbody');
    var search = $('custSearch');
    showCard(body && body.closest('.card'));
    showCard(search && search.closest('.card'));
    showCard($('customers'));
    ['portalAccounts', 'portalRegistrations'].forEach(function (id) {
      var node = $(id);
      var card = node && node.closest('.card');
      var list = body && body.closest('.card');
      if (card && list && list.contains(node) && card !== list) {
        var host = $('portalAdmin');
        if (host) host.appendChild(card);
      }
      if (card && card !== list) card.classList.add('hidden');
    });
  }

  function ensureTools() {
    var search = $('custSearch');
    if (!search || $('gpKartablTools')) return;
    var box = document.createElement('div');
    box.id = 'gpKartablTools';
    box.innerHTML =
      '<button type="button" class="btn2" onclick="gpOpenPlanApply()">اعمال طرح جدید — همه یا مشتری‌های دلخواه</button>' +
      '<span class="small">از ستون انتخاب، مشتری‌های موردنظر را تیک بزنید. اگر تیکی نباشد برای همه اعمال می‌شود.</span>';
    search.parentNode.insertBefore(box, search);
  }

  function ensureHead() {
    var table = $('ctbody') && $('ctbody').closest('table');
    if (!table) return;
    var head = table.querySelector('thead tr');
    if (!head) return;
    head.innerHTML = '<th></th><th>کد</th><th>نام (شخص / حقیقی)</th><th>نام شرکت / حقوقی</th><th>شماره تماس</th><th>شهر</th><th>آدرس</th><th>وضعیت</th><th>عملیات</th>';
  }

  function renderKartabl() {
    syncGlobals();
    revealKartabl();
    ensureTools();
    ensureHead();
    var body = $('ctbody');
    if (!body) return;
    var q = ($('custSearch') && $('custSearch').value || '').trim().toLowerCase();
    var rows = customers().filter(function (c) {
      if (!q) return true;
      var p = parentOf(c);
      return [c.code, c.name, c.company, c.mobile, c.city, c.address, p && p.name].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="9"><div class="small" style="text-align:center;padding:28px">' +
        (customers().length ? 'مشتری‌ای با این جستجو پیدا نشد.' : 'در حال خواندن مشتریان از پایگاه داده...') +
        '</div></td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (c) {
      var kind = kindOf(c);
      var p = parentOf(c);
      var active = isActive(c);
      var badge = kind ? '<span class="gp-coop-badge ' + kind + '">' + kindLabel(kind) + '</span>' : '';
      return '<tr class="gp-coop-' + (kind || 'plain') + (active ? '' : ' customer-inactive-row') + '">' +
        '<td><input type="checkbox" class="gp-plan-pick" data-id="' + c.id + '" style="width:auto"></td>' +
        '<td><b>' + esc(c.code || '-') + '</b></td>' +
        '<td>' + badge + esc(c.name || '-') +
        (p ? '<div class="small">زیرمجموعه: ' + esc(p.name) + '</div>' : '') +
        '</td><td>' + esc(c.company || '-') + '</td><td>' + esc(c.mobile || '-') +
        '</td><td>' + esc(c.city || '-') + '</td><td>' + esc(c.address || '-') +
        '</td><td><span class="badge ' + (active ? 'customer-active-badge' : 'customer-inactive-badge') + '">' +
        (active ? 'فعال' : 'غیرفعال') + '</span></td><td>' +
        (typeof has !== 'function' || has('sales') ? '<button class="dots-btn" onclick="toggleCustomerMenu(event,' + c.id + ')">⋮</button>' : '-') +
        '</td></tr>';
    }).join('');
  }

  function wrapRender() {
    window.renderCustomers = function () {
      renderKartabl();
    };
    window.renderCustomers.__gpSync1 = true;
    if ($('custSearch') && !$('custSearch').dataset.gpSync1) {
      $('custSearch').dataset.gpSync1 = '1';
      $('custSearch').addEventListener('input', renderKartabl);
    }
  }

  function selectedIds() {
    return [].map.call(document.querySelectorAll('#ctbody .gp-plan-pick:checked'), function (el) {
      return +el.getAttribute('data-id');
    }).filter(Boolean);
  }

  async function ensureOffers() {
    if (window.PORTAL_OFFERS && window.PORTAL_OFFERS.length) return window.PORTAL_OFFERS;
    try {
      if (typeof loadPortalOffers === 'function') await loadPortalOffers();
      else window.PORTAL_OFFERS = await req('/api/offers');
    } catch (e) {
      window.PORTAL_OFFERS = window.PORTAL_OFFERS || [];
    }
    return window.PORTAL_OFFERS || [];
  }

  async function ensureAccounts() {
    if (window.PORTAL_ACCOUNTS && window.PORTAL_ACCOUNTS.length) return window.PORTAL_ACCOUNTS;
    try { window.PORTAL_ACCOUNTS = await req('/api/customer-accounts'); } catch (e) { window.PORTAL_ACCOUNTS = []; }
    return window.PORTAL_ACCOUNTS || [];
  }

  function accountOf(id) {
    return (window.PORTAL_ACCOUNTS || []).filter(function (a) { return +a.customer_id === +id; })[0] || null;
  }

  window.gpOpenPlanApply = async function (presetId) {
    await ensureOffers();
    var picked = presetId ? [+presetId] : selectedIds();
    var offerOpts = (window.PORTAL_OFFERS || []).map(function (o) {
      return '<option value="' + o.id + '">' + esc(o.title || 'طرح') + '</option>';
    }).join('');
    modal(
      '<h3>اعمال طرح جدید</h3>' +
      '<div class="small" style="margin-bottom:10px">طرح را برای همه مشتریان یا فقط انتخاب‌شده‌ها اعمال کنید. از همین‌جا طرح تازه هم می‌سازید.</div>' +
      '<div class="mutedbox">' +
        '<label><input type="radio" name="gpPlanAud" value="all" style="width:auto" ' + (picked.length ? '' : 'checked') + '> همه مشتریان</label>' +
        '<label style="margin-right:14px"><input type="radio" name="gpPlanAud" value="selected" style="width:auto" ' + (picked.length ? 'checked' : '') + '> مشتری‌های دلخواه' +
        (picked.length ? ' (' + picked.length + ' مورد)' : '') + '</label>' +
      '</div>' +
      '<div class="grid" style="margin-top:10px">' +
        '<select id="gpPlanExisting"><option value="">طرح تازه بساز</option>' + offerOpts + '</select>' +
        '<input id="gpPlanTitle" placeholder="عنوان طرح یا تخفیف">' +
        '<input id="gpPlanBadge" placeholder="برچسب، مثال: فروش ویژه">' +
        '<input id="gpPlanDiscount" placeholder="تخفیف — درصد یا مبلغ" inputmode="numeric">' +
      '</div>' +
      '<textarea id="gpPlanDesc" style="width:100%;margin-top:8px" placeholder="توضیح طرح"></textarea>' +
      '<input type="hidden" id="gpPlanIds" value="' + picked.join(',') + '">' +
      '<div class="toolbar" style="margin-top:10px">' +
        '<button type="button" onclick="gpSavePlanApply()">اعمال طرح</button>' +
        '<button class="btnlight" type="button" onclick="closeModal()">بستن</button>' +
      '</div>'
    );
  };

  window.gpSavePlanApply = async function () {
    try {
      var aud = (document.querySelector('input[name="gpPlanAud"]:checked') || {}).value || 'all';
      var ids = ($('gpPlanIds').value || '').split(',').map(Number).filter(Boolean);
      if (aud === 'selected' && !ids.length) ids = selectedIds();
      if (aud === 'selected' && !ids.length) throw new Error('حداقل یک مشتری را از کارتابل انتخاب کنید');
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
      closeModal();
      toast('طرح اعمال شد');
      if (typeof loadPortalOffers === 'function') loadPortalOffers();
    } catch (e) { alert(e.message); }
  };

  window.gpChangeCustomerContact = function (id) {
    var c = typeof customerById === 'function' ? customerById(id) : null;
    if (!c) return;
    modal(
      '<h3>تغییر تماس — ' + esc(c.name) + '</h3>' +
      '<input id="gpContactMobile" value="' + esc(c.mobile || '') + '" inputmode="tel" placeholder="موبایل" style="width:100%">' +
      '<div class="toolbar" style="margin-top:10px"><button type="button" onclick="gpSaveCustomerContact(' + id + ')">ذخیره تماس</button>' +
      '<button class="btnlight" type="button" onclick="closeModal()">بستن</button></div>'
    );
  };

  window.gpSaveCustomerContact = async function (id) {
    try {
      var c = typeof customerById === 'function' ? customerById(id) : {};
      await req('/api/customers/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id, name: c.name, mobile: $('gpContactMobile').value, company: c.company, address: c.address })
      });
      closeModal();
      toast('شماره تماس ذخیره شد');
      await refresh();
    } catch (e) { alert(e.message); }
  };

  window.gpResetCustomerPassword = async function (id) {
    var c = typeof customerById === 'function' ? customerById(id) : null;
    if (!c) return;
    await ensureAccounts();
    var acc = accountOf(id);
    modal(
      '<h3>بازیابی رمز — ' + esc(c.name) + '</h3>' +
      (acc ? '<div class="small">شماره ورود فعلی: ' + esc(acc.login_mobile || '-') + '</div>' : '<div class="small">این مشتری هنوز حساب پرتال ندارد؛ با تعیین رمز، حساب ساخته می‌شود.</div>') +
      '<input id="gpResetMobile" value="' + esc((acc && acc.login_mobile) || c.mobile || '') + '" placeholder="شماره ورود" style="width:100%;margin-top:8px">' +
      '<input id="gpResetPw" type="password" placeholder="رمز جدید — حداقل ۸ کاراکتر" style="width:100%;margin-top:8px">' +
      '<div class="toolbar" style="margin-top:10px"><button type="button" onclick="gpSaveCustomerPassword(' + id + ')">ثبت رمز</button>' +
      '<button class="btnlight" type="button" onclick="closeModal()">بستن</button></div>'
    );
  };

  window.gpSaveCustomerPassword = async function (id) {
    try {
      var mobile = $('gpResetMobile').value.trim();
      var password = $('gpResetPw').value;
      if (password.length < 8) throw new Error('رمز جدید حداقل ۸ کاراکتر باشد');
      await ensureAccounts();
      var acc = accountOf(id);
      if (acc) {
        await req('/api/customer-accounts/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: acc.id, mobile: mobile, alternate_mobile: acc.alternate_mobile || '', password: password, active: true })
        });
      } else {
        await req('/api/customer-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_id: id, mobile: mobile, password: password })
        });
      }
      closeModal();
      toast('رمز مشتری ثبت شد');
    } catch (e) { alert(e.message); }
  };

  window.gpChangeCoop = function (id) {
    var c = typeof customerById === 'function' ? customerById(id) : null;
    if (!c) return;
    var kind = kindOf(c);
    modal(
      '<h3>تغییر مدل همکاری — ' + esc(c.name) + '</h3>' +
      '<div class="gp-channel-row">' +
        '<label><input type="radio" name="gpOpsChannel" value="agent" style="width:auto"' + (kind === 'agent' ? ' checked' : '') + '> عاملین فروش</label>' +
        '<label><input type="radio" name="gpOpsChannel" value="rep" style="width:auto"' + (kind === 'marketer' || kind === 'sub' ? ' checked' : '') + '> نمایندگان</label>' +
      '</div>' +
      '<select id="gpOpsRole" style="width:100%;margin-top:8px">' +
        '<option value="marketer"' + (kind !== 'sub' ? ' selected' : '') + '>بازاریاب</option>' +
        '<option value="sub"' + (kind === 'sub' ? ' selected' : '') + '>زیرمجموعه بازاریاب</option>' +
      '</select>' +
      '<div class="toolbar" style="margin-top:10px"><button type="button" onclick="gpSaveCoop(' + id + ')">ذخیره مدل</button>' +
      '<button class="btnlight" type="button" onclick="closeModal()">بستن</button></div>'
    );
  };

  window.gpSaveCoop = async function (id) {
    try {
      var on = document.querySelector('input[name="gpOpsChannel"]:checked');
      if (!on) throw new Error('مدل همکاری را انتخاب کنید');
      var role = $('gpOpsRole') ? $('gpOpsRole').value : 'marketer';
      var isMarketer = on.value === 'rep' && role === 'marketer';
      var prices = on.value === 'agent' ? ['agent', 'panel', 'serial'] : ['panel', 'serial'];
      var c = typeof customerById === 'function' ? customerById(id) : {};
      await req('/api/customers/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: id,
          name: c.name,
          mobile: c.mobile,
          sales_channel: on.value,
          is_marketer: isMarketer,
          parent_marketer_id: (on.value === 'rep' && role === 'sub') ? (c.parent_marketer_id || 0) : 0,
          visible_price_groups: prices
        })
      });
      closeModal();
      toast('مدل همکاری ذخیره شد');
      await refresh();
    } catch (e) { alert(e.message); }
  };

  function fillOpsMenu(id) {
    var menus = document.querySelectorAll('.customer-menu.open');
    var menu = menus.length ? menus[menus.length - 1] : null;
    if (!menu || menu.dataset.gpSync1 === '1') return;
    menu.dataset.gpSync1 = '1';
    var extra = menu.querySelector('.customer-price-box, .customer-price-edit');
    if (extra) extra.remove();
    var c = typeof customerById === 'function' ? customerById(id) : {};
    menu.innerHTML =
      '<button type="button" onclick="closeCustomerMenus();openCustomerEdit(' + id + ')">✎ ویرایش مشخصات</button>' +
      '<button type="button" onclick="closeCustomerMenus();gpChangeCustomerContact(' + id + ')">📱 تغییر تماس</button>' +
      '<button type="button" onclick="closeCustomerMenus();gpResetCustomerPassword(' + id + ')">🔑 بازیابی رمز مشتری</button>' +
      '<button type="button" onclick="closeCustomerMenus();openCustomerPriceEdit(' + id + ')">💲 ' + PRICE_TITLE + '</button>' +
      '<button type="button" onclick="closeCustomerMenus();gpChangeCoop(' + id + ')">🤝 تغییر نوع همکاری</button>' +
      '<button type="button" onclick="closeCustomerMenus();gpOpenPlanApply(' + id + ')">٪ اعمال و ایجاد تخفیف</button>' +
      '<button type="button" onclick="closeCustomerMenus();gpAssignCustomerOffers(' + id + ')">📋 تخصیص طرح و آفر</button>' +
      (typeof toggleCustomerActive === 'function'
        ? '<button type="button" onclick="closeCustomerMenus();toggleCustomerActive(' + id + ')">' + (isActive(c) ? '⏸ غیرفعال کردن' : '▶ فعال کردن') + '</button>'
        : '') +
      '<div class="gp-ops-sep"></div>' +
      '<button class="danger-menu" type="button" onclick="closeCustomerMenus();deleteCustomer(' + id + ')">حذف مشتری</button>';
  }

  function wrapMenu() {
    if (typeof window.toggleCustomerMenu !== 'function' || window.toggleCustomerMenu.__gpSync1) return;
    var base = window.toggleCustomerMenu;
    window.toggleCustomerMenu = function (ev, id) {
      base.apply(this, arguments);
      try { fillOpsMenu(id); } catch (e) {}
    };
    window.toggleCustomerMenu.__gpSync1 = true;
  }

  function staffUsers(list) {
    return (list || []).filter(function (u) {
      var roles = u && u.roles ? u.roles : [];
      return roles.indexOf('customer') < 0;
    });
  }

  function wrapUsers() {
    if (typeof window.loadUsers !== 'function' || window.loadUsers.__gpSync1) {
      slimUsersPage();
      return;
    }
    var base = window.loadUsers;
    window.loadUsers = async function () {
      await base.apply(this, arguments);
      try {
        syncGlobals();
        slimUsersPage();
        var body = $('utbody');
        if (!body) return;
        var rows = staffUsers(typeof USERS !== 'undefined' ? USERS : window.USERS);
        body.innerHTML = rows.map(function (u) {
          return '<tr><td>' + esc(u.username) + '</td><td>' + esc(u.mobile || '-') +
            '</td><td class="gp-role-hide"></td><td>' + (u.active ? 'فعال' : 'غیرفعال') +
            '</td><td><button class="btnlight" onclick="openUserEdit(' + u.id + ')">ویرایش</button></td></tr>';
        }).join('') || '<tr><td colspan="5">کاربر اتوماسیونی ثبت نشده است.</td></tr>';
      } catch (e) {}
    };
    window.loadUsers.__gpSync1 = true;
    if (typeof window.openUserEdit === 'function' && !window.openUserEdit.__gpSync1) {
      var baseEdit = window.openUserEdit;
      window.openUserEdit = function (id) {
        baseEdit.apply(this, arguments);
        [].forEach.call(document.querySelectorAll('#modal .checks, #modal label:has(.editrole)'), function (el) {
          el.style.display = 'none';
        });
      };
      window.openUserEdit.__gpSync1 = true;
    }
    if (typeof window.saveUser === 'function' && !window.saveUser.__gpSync1) {
      var baseSave = window.saveUser;
      window.saveUser = async function (id) {
        var list = typeof USERS !== 'undefined' ? USERS : window.USERS || [];
        var u = list.filter(function (x) { return +x.id === +id; })[0] || {};
        [].forEach.call(document.querySelectorAll('.editrole'), function (el) {
          el.checked = (u.roles || []).indexOf(el.value) >= 0;
        });
        return baseSave.apply(this, arguments);
      };
      window.saveUser.__gpSync1 = true;
    }
    slimUsersPage();
  }

  function slimUsersPage() {
    var sec = $('users');
    if (!sec) return;
    var h = sec.querySelector('h3');
    if (h) h.textContent = 'کاربران اتوماسیون';
    [].forEach.call(sec.querySelectorAll('.checks'), function (el) { el.style.display = 'none'; });
    if ($('addUserBtn') && !$('addUserBtn').dataset.gpSync1) {
      $('addUserBtn').dataset.gpSync1 = '1';
      var prev = window.addUser;
      window.addUser = async function () {
        try {
          [].forEach.call(document.querySelectorAll('.newrole'), function (el) { el.checked = el.value === 'sales'; });
          if (typeof prev === 'function') return prev.apply(this, arguments);
        } catch (e) {
          if ($('umsg')) $('umsg').textContent = e.message;
        }
      };
    }
  }

  function paintChannelPages() {
    ['gpAgentsListSearch', 'gpRepsListSearch'].forEach(function (id) {
      var el = $(id);
      if (el) {
        try { el.dispatchEvent(new Event('input')); } catch (e) {}
      }
    });
  }

  function wrapViews() {
    if (typeof window.refresh === 'function' && !window.refresh.__gpSync1) {
      var base = window.refresh;
      window.refresh = async function () {
        var out = await base.apply(this, arguments);
        try {
          syncGlobals();
          renderKartabl();
          paintChannelPages();
        } catch (e) {}
        return out;
      };
      window.refresh.__gpSync1 = true;
    }
    if (typeof window.show === 'function' && !window.show.__gpSync1) {
      var baseShow = window.show;
      window.show = function (t) {
        var out = baseShow.apply(this, arguments);
        try {
          syncGlobals();
          if (t === 'customers') renderKartabl();
          if (t === 'salesAgents' || t === 'salesReps') paintChannelPages();
          if (t === 'users') {
            slimUsersPage();
            if (typeof loadUsers === 'function') loadUsers();
          }
        } catch (e) {}
        return out;
      };
      window.show.__gpSync1 = true;
    }
  }

  function apply() {
    try { ensureStyle(); } catch (e) {}
    try { syncGlobals(); } catch (e) {}
    try { revealKartabl(); } catch (e) {}
    try { wrapRender(); } catch (e) {}
    try { wrapMenu(); } catch (e) {}
    try { wrapUsers(); } catch (e) {}
    try { wrapViews(); } catch (e) {}
    try {
      if ($('customers') && !$('customers').classList.contains('hidden')) renderKartabl();
    } catch (e) {}
  }

  apply();
  [180, 600, 1200, 2200, 4000].forEach(function (ms) { setTimeout(apply, ms); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 80); });
  }
})();
