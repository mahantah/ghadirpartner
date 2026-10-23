/* GHADIR_PRODUCTION_SIDEBAR_PLACEMENT_V2_20261023
   Geometry-only correction for the existing, handler-bound sidebar switch. */
(function () {
  'use strict';

  function init() {
    var app = document.getElementById('app');
    var nav = app && app.querySelector(':scope > header .topnav');
    var switchButton = document.getElementById('gpSidebarSwitch');
    var legacyButton = document.getElementById('desktopSidebarCollapse');
    if (!app || !nav || !switchButton || !legacyButton) return;
    if (switchButton.dataset.gpPlacementV2 === '1') return;
    switchButton.dataset.gpPlacementV2 = '1';

    // The old element must remain attached so delegated/original click logic
    // continues to work; it is excluded from keyboard and assistive UI.
    legacyButton.hidden = true;
    legacyButton.tabIndex = -1;
    legacyButton.setAttribute('aria-hidden', 'true');

    var pending = false;
    function position() {
      pending = false;
      var open = switchButton.classList.contains('is-open');
      var rect = nav.getBoundingClientRect();
      if (open && rect.width > 0 && !app.classList.contains('hidden')) {
        // Center within the actual responsive drawer width. This deliberately
        // avoids the title (right) and the logo (left) at any screen width.
        var x = rect.left + (rect.width - switchButton.offsetWidth) / 2;
        x = Math.max(4, Math.min(window.innerWidth - switchButton.offsetWidth - 4, x));
        switchButton.style.setProperty('--gp-sidebar-v2-left', Math.round(x) + 'px');
        switchButton.style.setProperty('--gp-sidebar-v2-right', 'auto');
      } else {
        // With the drawer closed, the same switch remains reachable at the
        // upper-right edge of the page; the original action is untouched.
        switchButton.style.setProperty('--gp-sidebar-v2-left', 'auto');
        switchButton.style.setProperty('--gp-sidebar-v2-right', '14px');
      }
    }
    function schedule() {
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(position);
    }
    new MutationObserver(schedule).observe(switchButton, {
      attributes: true, attributeFilter: ['class']
    });
    new MutationObserver(schedule).observe(nav, {
      attributes: true, attributeFilter: ['class']
    });
    new MutationObserver(schedule).observe(app, {
      attributes: true, attributeFilter: ['class']
    });
    nav.addEventListener('transitionend', schedule);
    window.addEventListener('resize', schedule, {passive: true});
    window.addEventListener('orientationchange', schedule, {passive: true});
    schedule();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once: true});
  } else {
    init();
  }
})();
