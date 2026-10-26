/* GP_ACCOUNT_LOGOUT_ACCESS_V1_20261026
   Presentation only: keep handler-bound #logoutbtn / #changePasswordBtn reachable.
   When desktop sidebar is collapsed the whole header (and nav footer) is off-screen;
   dock the original userbox on #app until the menu is opened again.
 */
(function () {
  'use strict';

  function desktopCollapsed() {
    var app = document.getElementById('app');
    return (
      app &&
      !app.classList.contains('hidden') &&
      app.classList.contains('sidebar-collapsed') &&
      window.matchMedia('(min-width: 821px)').matches
    );
  }

  function userboxEl() {
    var logout = document.getElementById('logoutbtn');
    return logout && logout.closest('.userbox');
  }

  var syncQueued = false;

  function syncNow() {
    var app = document.getElementById('app');
    if (!app || app.classList.contains('hidden')) return;
    var header = app.querySelector(':scope > header');
    var nav = header && header.querySelector('.topnav');
    var userbox = userboxEl();
    var logout = document.getElementById('logoutbtn');
    var password = document.getElementById('changePasswordBtn');
    if (!nav || !userbox || !logout || !password) return;

    nav.classList.add('gp-account-nav-flex');
    userbox.classList.add('gp-sidebar-userbox');
    logout.hidden = false;
    password.hidden = false;
    if ((logout.textContent || '').replace(/\s+/g, ' ').trim() === 'خروج') {
      logout.textContent = 'خروج از حساب';
    }

    if (desktopCollapsed()) {
      if (userbox.parentElement !== app) app.appendChild(userbox);
      userbox.classList.add('gp-account-docked');
    } else {
      userbox.classList.remove('gp-account-docked');
      if (userbox.parentElement !== nav) nav.appendChild(userbox);
    }
  }

  function sync() {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(function () {
      syncQueued = false;
      syncNow();
    });
  }

  function init() {
    if (document.documentElement.dataset.gpAccountLogoutAccessV1 === '1') return;
    document.documentElement.dataset.gpAccountLogoutAccessV1 = '1';
    sync();
    var app = document.getElementById('app');
    var nav = app && app.querySelector(':scope > header .topnav');
    if (app) {
      new MutationObserver(sync).observe(app, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }
    if (nav) {
      new MutationObserver(sync).observe(nav, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }
    window.addEventListener('resize', sync, { passive: true });
    window.addEventListener('orientationchange', sync, { passive: true });
    setTimeout(sync, 0);
    setTimeout(sync, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
