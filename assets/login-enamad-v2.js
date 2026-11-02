/* GP_LOGIN_ENAMAD_SEAL_V2_20261102 — Official, owner-supplied seal. */
(() => {
  "use strict";
  const id = "gp-login-enamad-seal";
  const code = "TWkVm1TWlJur0GPTQsBUkAme2pLiKNIn";
  const linkUrl = "https://trustseal.enamad.ir/?id=7833479&Code=" + code;
  const logoUrl = "https://trustseal.enamad.ir/logo.aspx?id=7833479&Code=" + code;
  const login = document.getElementById("login");
  if (!login) return;

  const original = document.getElementById(id);
  if (original) original.remove();
  const link = document.createElement("a");
  link.id = id;
  link.className = "gp-login-enamad-v2";
  link.href = linkUrl;
  link.rel = "noopener noreferrer";
  link.referrerPolicy = "origin";
  link.target = "_blank";
  link.setAttribute("aria-label", "استعلام اعتبار نماد اعتماد الکترونیکی");

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
    if (image.naturalWidth > 0) link.classList.remove("gp-login-enamad-image-failed");
  });
  image.src = logoUrl;

  const fallback = document.createElement("span");
  fallback.className = "gp-login-enamad-fallback";
  fallback.textContent = "اینماد";
  fallback.setAttribute("aria-hidden", "true");
  link.append(image, fallback);
  // Mount outside transformed/overflow-clipped login panels. Visibility is
  // synchronized with the actual login screen, not tied to the page background.
  document.body.appendChild(link);

  const update = () => {
    const visible = login.isConnected &&
      !login.hidden &&
      !login.classList.contains("hidden") &&
      getComputedStyle(login).display !== "none" &&
      getComputedStyle(login).visibility !== "hidden";
    link.hidden = !visible;
  };
  update();
  const observer = new MutationObserver(update);
  observer.observe(login, {attributes: true, attributeFilter: ["class", "style", "hidden"]});
})();
