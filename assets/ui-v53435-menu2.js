/* GP_UI_MENU2_20261025 */
(() => {
  'use strict';
  if (window.__gpUiMenu2) return;
  window.__gpUiMenu2 = true;

  const nav = document.querySelector('.topnav');
  if (!nav) return;
  const warehouseGroup = document.getElementById('warehouseNavGroup');
  if (!warehouseGroup) return;

  const paths = {
    home: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',
    orders: 'M6 3h12v18H6ZM9 7h6M9 11h6M9 15h6',
    neworder: 'M12 4v16M4 12h16',
    warehouse: 'M3 9l9-6 9 6v12H3ZM7 21V11h10v10M7 15h10',
    inventory: 'M3 5v14M7 5v14M11 5v14M14 5v14M18 5v14M21 5v14',
    reports: 'M4 4v16h16M7 14l5-5 4 3 5-7',
    products: 'M3 3h8l10 10-8 8L3 11ZM7 7h.1',
    customers: 'M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-3a6 6 0 0 1 12 0v3M16 4a4 4 0 0 1 0 8M17 15a5 5 0 0 1 5 5',
    users: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 21v-3a7 7 0 0 1 14 0v3',
    settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
    salesReports: 'M4 21V12h4v9M10 21V7h4v14M16 21V3h4v18',
    catalog: 'M3 3h8l10 10-8 8L3 11ZM7 7h.1',
    offers: 'M3 9h18v4H3ZM5 13v8h14v-8M12 9v12M12 9C2 9 5 0 9 4ZM12 9C22 9 19 0 15 4Z',
    sms: 'M3 4h18v14H9l-6 3ZM6 8h12M6 12h8',
    scan: 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M6 12h12',
    checks: 'm4 12 5 5L20 6'
  };

  function $(id) { return document.getElementById(id); }

  function makeIcon(icon) {
    const i = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    i.setAttribute('class', 'gp-menu-icon');
    i.setAttribute('viewBox', '0 0 24 24');
    i.setAttribute('fill', 'none');
    i.setAttribute('stroke', 'currentColor');
    i.setAttribute('stroke-width', '1.8');
    i.setAttribute('stroke-linecap', 'round');
    i.setAttribute('stroke-linejoin', 'round');
    i.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(i.namespaceURI, 'path');
    path.setAttribute('d', paths[icon] || paths.users);
    i.append(path);
    return i;
  }

  function label(el, text, icon) {
    if (!el) return;
    const span = el.querySelector('.gp-menu-text');
    const hasIcon = el.querySelector('.gp-menu-icon');
    if (span && hasIcon) {
      if (span.textContent !== text) span.textContent = text;
      return;
    }
    el.replaceChildren();
    el.append(makeIcon(icon));
    const t = document.createElement('span');
    t.className = 'gp-menu-text';
    t.textContent = text;
    el.append(t);
  }

  function group(id, text, icon) {
    let g = $(id);
    if (!g) {
      g = document.createElement('div');
      g.id = id;
      g.className = 'nav-group gp-group';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'nav-group-toggle';
      label(b, text, icon);
      const c = document.createElement('span');
      c.className = 'chev';
      c.textContent = '⌄';
      b.append(c);
      const sub = document.createElement('div');
      sub.className = 'nav-submenu';
      sub.id = id + '-items';
      b.setAttribute('aria-controls', sub.id);
      b.setAttribute('aria-expanded', 'false');
      b.onclick = (e) => {
        e.stopPropagation();
        g.classList.toggle('open');
        b.setAttribute('aria-expanded', String(g.classList.contains('open')));
      };
      g.append(b, sub);
    } else {
      const toggle = g.querySelector('.nav-group-toggle');
      if (toggle) label(toggle, text, icon);
      if (toggle && !toggle.querySelector('.chev')) {
        const c = document.createElement('span');
        c.className = 'chev';
        c.textContent = '⌄';
        toggle.append(c);
      }
    }
    g.classList.add('gp-group');
    return g;
  }

  function hideNav(el) {
    if (!el) return;
    el.classList.add('hidden', 'gp-nav-retired');
    el.hidden = true;
    el.style.display = 'none';
  }

  function showNav(el) {
    if (!el) return;
    el.classList.remove('hidden', 'gp-nav-retired');
    el.hidden = false;
    if (el.style && el.style.display === 'none') el.style.display = '';
  }

  function grantTabs() {
    if (!window.TAB_ACCESS) return;
    window.TAB_ACCESS.customerAdd = window.TAB_ACCESS.customerAdd || window.TAB_ACCESS.customers || ['sales', 'viewer'];
    window.TAB_ACCESS.stocktake = window.TAB_ACCESS.stocktake || window.TAB_ACCESS.reports || ['prep', 'viewer'];
    window.TAB_ACCESS.salesAgents = window.TAB_ACCESS.salesAgents || window.TAB_ACCESS.customers || ['sales', 'viewer'];
    window.TAB_ACCESS.salesReps = window.TAB_ACCESS.salesReps || window.TAB_ACCESS.customers || ['sales', 'viewer'];
  }

  function ensureSection(id, html) {
    let sec = $(id);
    if (sec) return sec;
    sec = document.createElement('section');
    sec.id = id;
    sec.className = 'tab hidden';
    if (html) sec.innerHTML = html;
    const customers = $('customers');
    if (customers && customers.parentNode) customers.parentNode.appendChild(sec);
    else (document.querySelector('.wrap') || document.body).appendChild(sec);
    return sec;
  }

  function setChildrenOrder(parent, items) {
    if (!parent) return;
    items = items.filter(Boolean);
    let same = parent.children.length === items.length;
    if (same) {
      for (let i = 0; i < items.length; i++) {
        if (parent.children[i] !== items[i]) { same = false; break; }
      }
    }
    if (same) return;
    items.forEach((el) => parent.appendChild(el));
  }

  grantTabs();

  if (!$('gp-ui-menu2-css')) {
    const css = document.createElement('style');
    css.id = 'gp-ui-menu2-css';
    css.textContent =
      '.gp-nav-retired{display:none!important}' +
      '#gpCustomers .nav-submenu [data-tab="customers"]:not([data-gp-cview]),' +
      '#gpCustomers .nav-submenu [data-gp-view="accounts"],' +
      '#gpCustomers .nav-submenu [data-gp-view="offers"],' +
      '.topnav [data-tab="products"]{display:none!important}';
    document.head.appendChild(css);
  }

  const orders = group('gpOrders', 'سفارش‌ها', 'orders');
  const sales = group('gpCustomers', 'مشتریان', 'customers');
  const settingsGroup = group('gpSystem', 'تنظیمات سامانه', 'settings');
  warehouseGroup.classList.add('gp-group');
  label(warehouseGroup.querySelector('button'), 'مدیریت انبار', 'warehouse');
  if (!warehouseGroup.querySelector('.chev')) {
    const wc = document.createElement('span');
    wc.className = 'chev';
    wc.textContent = '⌄';
    warehouseGroup.querySelector('button').append(wc);
  }

  const firstOrdersTarget = nav.querySelector('[data-tab="orders"]');
  if (firstOrdersTarget) firstOrdersTarget.before(orders);
  warehouseGroup.after(sales);
  sales.after(settingsGroup);

  const names = {
    dashboard: 'پیشخوان',
    orders: 'فهرست سفارش‌ها',
    neworder: 'ثبت سفارش',
    warehouse: 'مخزن انبار',
    inventory: 'سریال‌های مشتریان',
    reports: 'گزارش خروج',
    warehouseDaily: 'دفتر روزانه انبار',
    users: 'کاربران داخلی',
    settings: 'تنظیمات عمومی',
    salesReports: 'گزارش فروش',
    checks: 'تأیید چک‌ها'
  };

  nav.querySelectorAll('[data-tab]').forEach((b) => {
    const tab = b.dataset.tab;
    if (tab === 'portalAdmin') return;
    if (tab === 'customers') {
      if (b.id === 'gpNavKartabl' || b.getAttribute('data-gp-cview')) return;
      hideNav(b);
      return;
    }
    if (tab === 'products') {
      hideNav(b);
      return;
    }
    label(b, names[tab] || b.textContent, tab === 'dashboard' ? 'home' : tab);
    if (['orders', 'neworder', 'checks'].includes(tab)) orders.lastElementChild.append(b);
    else if (['users', 'settings'].includes(tab)) settingsGroup.lastElementChild.append(b);
  });

  const scan = document.getElementById('mobileScanBtn');
  if (scan) {
    label(scan, 'اسکن با گوشی', 'scan');
    warehouseGroup.querySelector('.nav-submenu').append(scan);
  }

  function makeSubItem(id, text, icon, tab, extra) {
    let b = $(id);
    if (!b) {
      b = document.createElement('button');
      b.type = 'button';
      b.id = id;
    }
    b.dataset.tab = tab;
    if (extra) {
      Object.keys(extra).forEach((k) => { b.dataset[k] = extra[k]; });
    }
    showNav(b);
    label(b, text, icon);
    return b;
  }

  const addBtn = makeSubItem('gpNavAddCustomer', 'افزودن مشتری جدید', 'customers', 'customerAdd', { gpCview: 'add' });
  const kartablBtn = makeSubItem('gpNavKartabl', 'کارتابل مشتریان', 'customers', 'customers', { gpCview: 'kartabl' });
  const agentsBtn = makeSubItem('gpNavAgents', 'عاملین فروش', 'customers', 'salesAgents');
  const repsBtn = makeSubItem('gpNavReps', 'نمایندگان فروش', 'customers', 'salesReps');
  sales.lastElementChild.append(addBtn, kartablBtn, agentsBtn, repsBtn);

  let catalogBtn = null;
  nav.querySelectorAll('[data-tab="portalAdmin"]').forEach((b) => {
    const text = b.textContent || '';
    const preset = b.dataset.gpView || '';
    const view = preset || (/قیمت|موجودی|لیست/.test(text) ? 'catalog' : /طرح|آفر/.test(text) ? 'offers' : /پیامک/.test(text) ? 'sms' : 'accounts');
    b.dataset.gpView = view;
    if (view === 'catalog') {
      if (catalogBtn && catalogBtn !== b) {
        hideNav(b);
        return;
      }
      catalogBtn = b;
      b.id = b.id || 'gpNavCatalog';
      showNav(b);
      label(b, 'قیمت و موجودی', 'catalog');
      b.onclick = () => {
        if (typeof canViewTab === 'function' && !canViewTab('portalAdmin')) return;
        window.PORTAL_ADMIN_VIEW = 'catalog';
        show('portalAdmin');
        if (typeof portalAdminView === 'function') portalAdminView('catalog');
      };
    } else if (view === 'sms') {
      showNav(b);
      label(b, 'مرکز پیامک', 'sms');
      settingsGroup.lastElementChild.prepend(b);
      b.onclick = () => {
        if (typeof canViewTab === 'function' && !canViewTab('portalAdmin')) return;
        window.PORTAL_ADMIN_VIEW = 'sms';
        show('portalAdmin');
        if (typeof portalAdminView === 'function') portalAdminView('sms');
      };
    } else {
      hideNav(b);
    }
  });

  if (!catalogBtn) {
    catalogBtn = document.createElement('button');
    catalogBtn.type = 'button';
    catalogBtn.dataset.tab = 'portalAdmin';
    catalogBtn.dataset.gpView = 'catalog';
    catalogBtn.id = 'gpNavCatalog';
    catalogBtn.className = 'adminOnly';
    label(catalogBtn, 'قیمت و موجودی', 'catalog');
    catalogBtn.onclick = () => {
      if (typeof canViewTab === 'function' && !canViewTab('portalAdmin')) return;
      window.PORTAL_ADMIN_VIEW = 'catalog';
      show('portalAdmin');
      if (typeof portalAdminView === 'function') portalAdminView('catalog');
    };
  }

  const baleSetup = document.createElement('button');
  baleSetup.type = 'button';
  baleSetup.className = 'adminOnly';
  baleSetup.dataset.gpExternal = 'bale';
  label(baleSetup, 'ربات بله', 'sms');
  baleSetup.onclick = () => { location.href = '/bale/setup.php'; };
  settingsGroup.lastElementChild.append(baleSetup);

  const head = nav.querySelector('.sidebar-head');
  if (head) {
    head.hidden = false;
    head.innerHTML = '';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'sidebar-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'بستن منو');
    closeBtn.textContent = '×';
    closeBtn.onclick = () => { if (typeof setSidebar === 'function') setSidebar(false); };
    const main = document.createElement('div');
    main.className = 'sidebar-brand-main';
    main.innerHTML = '<div class="sidebar-brand-text"><strong>قدیر پارتنر</strong><small>اتوماسیون فروش و انبار</small></div><img class="sidebar-brand-logo" src="/brand-v5311.png" alt="قدیر پارتنر">';
    const collapse = document.getElementById('desktopSidebarCollapse');
    if (collapse) {
      collapse.classList.add('sidebar-mini-action');
      collapse.textContent = 'جمع کردن منو';
    }
    const holder = document.createElement('div');
    holder.className = 'sidebar-brand';
    holder.append(main);
    if (collapse) holder.append(collapse);
    head.append(closeBtn, holder);
  }

  const userbox = document.querySelector('header .userbox');
  if (userbox) {
    const footer = document.createElement('div');
    footer.className = 'sidebar-footer';
    const hr = document.createElement('div');
    hr.className = 'sidebar-sep';
    footer.append(hr);
    footer.append(userbox);
    nav.append(footer);
  }

  const who = document.getElementById('who');
  if (who) who.textContent = (who.textContent || 'ta-admin').trim() || 'ta-admin';

  function fillWarehouse() {
    const sub = warehouseGroup.querySelector('.nav-submenu');
    if (!sub) return;
    const daily = sub.querySelector('[data-tab="warehouseDaily"]');
    const reports = sub.querySelector('[data-tab="reports"]');
    const vault = sub.querySelector('[data-tab="warehouse"]');
    const inventory = sub.querySelector('[data-tab="inventory"]');
    const scanBtn = document.getElementById('mobileScanBtn');
    if (daily) label(daily, 'دفتر روزانه انبار', 'reports');
    if (reports) label(reports, 'گزارش خروج', 'reports');
    if (vault) label(vault, 'مخزن انبار', 'warehouse');
    if (inventory) label(inventory, 'سریال‌های مشتریان', 'inventory');
    sub.querySelectorAll('[data-tab="products"]').forEach(hideNav);
    let stocktake = $('gpNavStocktake') || sub.querySelector('[data-tab="stocktake"]');
    if (!stocktake) {
      stocktake = makeSubItem('gpNavStocktake', 'انبارگردانی', 'reports', 'stocktake');
      sub.appendChild(stocktake);
    } else {
      stocktake.id = 'gpNavStocktake';
      showNav(stocktake);
      label(stocktake, 'انبارگردانی', 'reports');
      stocktake.dataset.tab = 'stocktake';
    }
    setChildrenOrder(sub, [daily, reports, stocktake, vault, inventory, scanBtn]);
  }

  function dumpBin() {
    let bin = $('gpNavDump');
    if (!bin) {
      bin = document.createElement('div');
      bin.id = 'gpNavDump';
      bin.hidden = true;
      bin.style.display = 'none';
      document.body.appendChild(bin);
    }
    return bin;
  }

  function orderTopNav() {
    if (catalogBtn) catalogBtn.id = catalogBtn.id || 'gpNavCatalog';
    const keep = [
      nav.querySelector('.sidebar-head'),
      nav.querySelector('[data-tab="dashboard"]'),
      $('gpOrders'),
      catalogBtn || $('gpNavCatalog'),
      warehouseGroup,
      $('gpCustomers'),
      nav.querySelector('[data-tab="salesReports"]'),
      $('gpSystem'),
      nav.querySelector('.sidebar-footer')
    ].filter(Boolean);
    setChildrenOrder(nav, keep);
    const keepSet = new Set(keep);
    [...nav.children].forEach((child) => {
      if (keepSet.has(child)) return;
      dumpBin().appendChild(child);
    });
  }

  ensureSection('customerAdd', '');
  ensureSection('salesAgents', '<div class="card gp-placeholder-card"><h3>عاملین فروش</h3><p>طرح‌های فروش این کانال از همین صفحه مدیریت می‌شود.</p></div>');
  ensureSection('salesReps', '<div class="card gp-placeholder-card"><h3>نمایندگان فروش</h3><p>طرح‌های فروش این کانال از همین صفحه مدیریت می‌شود.</p></div>');
  ensureSection('stocktake', '');

  fillWarehouse();
  orderTopNav();

  function sync() {
    nav.querySelectorAll('.gp-group').forEach((g) => {
      const visible = [...g.querySelectorAll('.nav-submenu [data-tab],.nav-submenu #mobileScanBtn,[data-gp-view],[data-gp-external]')]
        .some((b) => !b.hidden && !b.classList.contains('hidden') && b.style.display !== 'none');
      g.hidden = !visible;
      g.classList.toggle('has-active', !!g.querySelector('.nav-submenu .active'));
    });
  }

  const original = window.show;
  window.show = function (t) {
    if (t === 'portalAdmin' && (!window.PORTAL_ADMIN_VIEW || window.PORTAL_ADMIN_VIEW === 'accounts' || window.PORTAL_ADMIN_VIEW === 'offers')) {
      window.PORTAL_ADMIN_VIEW = 'catalog';
    }
    if (!document.getElementById(t) && t !== 'dashboard') {
      t = 'dashboard';
    }
    const result = original.apply(this, arguments.length ? [t].concat([].slice.call(arguments, 1)) : arguments);
    nav.querySelectorAll('[data-gp-view]').forEach((b) => {
      b.classList.toggle('active', t === 'portalAdmin' && b.dataset.gpView === (window.PORTAL_ADMIN_VIEW || 'catalog'));
    });
    const wg = $('warehouseNavGroup');
    if (wg) {
      wg.classList.toggle('has-active', ['inventory', 'warehouse', 'reports', 'warehouseDaily', 'stocktake'].indexOf(t) >= 0);
    }
    const cg = $('gpCustomers');
    if (cg) cg.classList.toggle('has-active', t === 'customers' || t === 'customerAdd' || t === 'salesAgents' || t === 'salesReps');
    if (t === 'portalAdmin' && typeof portalAdminView === 'function') portalAdminView(window.PORTAL_ADMIN_VIEW || 'catalog');
    sync();
    return result;
  };

  nav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-gp-view]');
    if (!b) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (typeof canViewTab === 'function' && !canViewTab('portalAdmin')) return;
    window.PORTAL_ADMIN_VIEW = b.dataset.gpView;
    show('portalAdmin');
    if (typeof portalAdminView === 'function') portalAdminView(b.dataset.gpView);
    if (typeof setSidebar === 'function') setSidebar(false);
  }, true);

  let queued = false;
  const observer = new MutationObserver((records) => {
    const added = records.some((r) => r.type === 'childList' && r.addedNodes && r.addedNodes.length);
    if (queued) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      if (added) fillWarehouse();
      orderTopNav();
      sync();
    }, 200);
  });
  observer.observe(nav, { subtree: true, childList: true });
  setTimeout(() => { fillWarehouse(); orderTopNav(); sync(); }, 300);
  setTimeout(() => { fillWarehouse(); orderTopNav(); sync(); }, 1200);
  sync();
})();
