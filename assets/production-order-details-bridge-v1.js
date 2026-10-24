/* GP_ORDER_DETAILS_PRODUCTION_BRIDGE_V1_20261024 */
(function () {
  'use strict';
  const legacy = window.__gpOdLegacy;
  const visualOpen = window.openOrderDetails;
  const visualClose = window.closeOrderDetails;

  function restoreLegacy() {
    if (!legacy || typeof legacy.open !== 'function' || typeof legacy.close !== 'function') return;
    window.openOrderDetails = legacy.open;
    window.closeOrderDetails = legacy.close;
    const overlay = document.getElementById('orderDetailOverlay');
    if (overlay) {
      overlay.classList.remove('od2-overlay');
      const drawer = overlay.querySelector('.od2-drawer');
      if (drawer) {
        drawer.classList.remove('od2-drawer');
        drawer.removeAttribute('role');
        drawer.removeAttribute('aria-modal');
        drawer.removeAttribute('aria-labelledby');
        drawer.removeAttribute('tabindex');
      }
    }
  }

  if (!legacy || typeof legacy.open !== 'function' ||
      typeof legacy.close !== 'function' ||
      typeof visualOpen !== 'function' || typeof visualClose !== 'function' ||
      typeof window.ensureOrderSerialMeta !== 'function' ||
      typeof window.gpOdQuickHtml !== 'function' ||
      typeof window.orderItemSerials !== 'function') {
    restoreLegacy();
    return;
  }

  window.openOrderDetails = async function (id, section) {
    const priorOverflow = document.body.style.overflow;
    try {
      // Preserve the live order-to-inventory serial hydration before rendering.
      await window.ensureOrderSerialMeta(id);
      return visualOpen(id, section);
    } catch (error) {
      // A visual failure must never prevent access to the original read-only view.
      restoreLegacy();
      document.body.style.overflow = priorOverflow;
      const image = document.getElementById('od2ImageDialog');
      if (image) image.remove();
      return legacy.open(id);
    }
  };
  window.__gpOdUiReady = true;
})();
