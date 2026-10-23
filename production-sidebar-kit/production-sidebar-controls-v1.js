/* GHADIR Partner — sidebar controls V1. Presentation + navigation only; existing auth and sidebar handlers reused. */
(function () {
  "use strict";
  function init() {
    var app = document.getElementById("app");
    var header = app && app.querySelector(":scope > header");
    var nav = header && header.querySelector(".topnav");
    var mobileButton = header && header.querySelector(".nav-toggle");
    var desktopClose = document.getElementById("desktopSidebarCollapse");
    var desktopOpen = document.getElementById("desktopSidebarOpen");
    var userbox = (header && header.querySelector(".userbox")) || (nav && nav.querySelector(".userbox"));
    if (!app || !header || !nav || !mobileButton || !desktopClose || !desktopOpen || !userbox) {
      console.warn("Ghadir sidebar V1: existing controls are not available; original interface retained.");
      return;
    }
    if (document.getElementById("gpSidebarSwitch")) return;
    if (!nav.id) nav.id = "gpMainNavigation";
    nav.querySelector(".sidebar-close")?.remove(); // Obsolete ×, original close controls remain through overlay/Escape.
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.id = "gpSidebarSwitch";
    toggle.className = "gp-sidebar-switch";
    toggle.setAttribute("aria-controls", nav.id);
    toggle.setAttribute("aria-label", "جمع‌کردن منو");
    toggle.innerHTML = '<span class="gp-switch-bars" aria-hidden="true"><span class="gp-switch-bar"></span><span class="gp-switch-bar"></span><span class="gp-switch-bar"></span></span>';
    app.appendChild(toggle);
    function mobile() { return window.matchMedia("(max-width:760px)").matches; }
    function opened() {
      return mobile() ? nav.classList.contains("sidebar-open") : !app.classList.contains("sidebar-collapsed");
    }
    function sync() {
      var open = opened();
      toggle.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "جمع‌کردن منو" : "بازکردن منو");
      toggle.title = toggle.getAttribute("aria-label");
    }
    function placeUserbox() {
      if (userbox.parentElement !== nav) nav.appendChild(userbox);
      userbox.classList.add("gp-sidebar-userbox");
      userbox.classList.remove("mobile-nav-userbox");
      userbox.setAttribute("aria-label", "حساب کاربری");
    }
    toggle.addEventListener("click", function(e) {
      e.preventDefault();
      if (mobile()) {
        mobileButton.click(); // Reuse tested mobile drawer handler, overlay, scroll-lock, Escape.
      } else if (app.classList.contains("sidebar-collapsed")) {
        desktopOpen.click(); // Reuse existing desktop state persistence.
      } else {
        desktopClose.click();
      }
      sync();
    });
    placeUserbox();
    sync();
    var pending = false;
    var observer = new MutationObserver(function() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function() {
        pending = false;
        placeUserbox();
        sync();
      });
    });
    observer.observe(header, {childList: true});
    observer.observe(nav, {attributes: true, attributeFilter: ["class"]});
    observer.observe(app, {attributes: true, attributeFilter: ["class"]});
    window.addEventListener("resize", function() { requestAnimationFrame(function() {placeUserbox();sync();}); }, {passive:true});
    document.addEventListener("keydown", function(e) {if(e.key==="Escape")requestAnimationFrame(sync);});
    nav.addEventListener("click", function(e) {if(e.target.closest("[data-tab]"))requestAnimationFrame(sync);});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
