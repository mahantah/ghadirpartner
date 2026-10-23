/* GHADIR_PROD_SIDEBAR_CONTROLS_V1_20261023
 * Presentation only. Preserve the real navigation and authentication handlers.
 * The existing morph button remains the ONE open/close control.
 */
(function () {
  'use strict';
  function init() {
    var app = document.getElementById('app');
    var header = app && app.querySelector('header');
    var nav = header && header.querySelector('.topnav');
    var toggle = header && header.querySelector('.nav-toggle.gp-nav-morph');
    var host = header && header.querySelector('.userbox');
    var password = document.getElementById('changePasswordBtn');
    var logout = document.getElementById('logoutbtn');
    if (!nav || !toggle || !host || !password || !logout) {
      console.warn('Ghadir sidebar: original controls unavailable; unchanged.');
      return;
    }
    if (nav.dataset.gpProdSidebarControls === '1') return;
    nav.dataset.gpProdSidebarControls = '1';

    function removeObsoleteClose() {
      nav.querySelectorAll('.sidebar-close, .gp-sidebar-legacy-close').forEach(function (button) {
        if (button !== toggle) button.remove();
      });
    }
    removeObsoleteClose();

    // Move the original, handler-bound buttons out of the hidden profile menu.
    // These are the existing account actions, never duplicated replacements.
    var who = document.getElementById('who');
    if (host.parentElement !== nav) nav.appendChild(host);
    host.classList.add('gp-prod-account-footer');
    host.classList.remove('mobile-nav-userbox');
    if (who && who.parentElement !== host) host.appendChild(who);
    [password, logout].forEach(function (button) {
      if (button.parentElement !== host) host.appendChild(button);
      button.removeAttribute('role'); // No longer inside a role=menu disclosure.
      button.hidden = false;
    });
    var oldTrigger = document.getElementById('gp-profile-trigger');
    var oldActions = document.getElementById('gp-profile-actions');
    if (oldTrigger) oldTrigger.hidden = true;
    if (oldActions) oldActions.hidden = true;

    // Keep late-added obsolete X buttons removed, but leave routes untouched.
    if (typeof MutationObserver === 'function') {
      new MutationObserver(removeObsoleteClose).observe(nav, {childList: true, subtree: true});
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once: true});
  } else init();
})();
