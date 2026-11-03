// @ts-check
/* GP_LOGIN_ENAMAD_SEAL_V2_20261103 — Seal below the login form. */
(() => {
  "use strict";
  const id = "gp-login-enamad-seal";
  const script = document.currentScript;
  if (!(script instanceof HTMLScriptElement)) return;
  const {
    enamadTrustUrl: linkUrl,
    enamadLogoUrl: logoUrl,
    enamadDesktopWidth: desktopWidth,
    enamadMobileWidth: mobileWidth,
  } = script.dataset;
  if (!linkUrl || !logoUrl || !desktopWidth || !mobileWidth) return;
  const code = new URL(linkUrl).searchParams.get("Code");
  if (!code) return;
  const login = document.getElementById("login");
  if (!login) return;

  const card = login.querySelector(".automation-login-card") || login;
  const original = document.getElementById(id);
  if (original) original.remove();
  const link = document.createElement("a");
  link.id = id;
  link.className = "gp-login-enamad-v2";
  link.href = linkUrl;
  link.rel = "noopener";
  link.referrerPolicy = "origin";
  link.target = "_blank";
  link.setAttribute("aria-label", "استعلام اعتبار نماد اعتماد الکترونیکی");
  link.style.setProperty("--gp-enamad-desktop-width", desktopWidth + "px");
  link.style.setProperty("--gp-enamad-mobile-width", mobileWidth + "px");

  const image = document.createElement("img");
  image.alt = "نماد اعتماد الکترونیکی";
  image.referrerPolicy = "origin";
  image.setAttribute("code", code);
  image.decoding = "async";
  image.loading = "eager";
  image.addEventListener("error", () => {
    image.hidden = true;
    link.classList.add("gp-login-enamad-image-failed");
  });
  image.addEventListener("load", () => {
    if (image.naturalWidth > 0)
      link.classList.remove("gp-login-enamad-image-failed");
  });
  image.src = logoUrl;

  const fallback = document.createElement("span");
  fallback.className = "gp-login-enamad-fallback";
  fallback.textContent = "اینماد";
  fallback.setAttribute("aria-hidden", "true");
  link.append(image, fallback);
  // The login container already controls visibility; mounting in the card
  // keeps the seal below the forms on desktop and mobile without an overlay.
  card.appendChild(link);
})();
