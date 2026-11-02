/* GP_LOGIN_ENAMAD_SEAL_V1_20261102
 * The official trustseal URL and code are supplied by the business owner.
 * Keep the badge inside #login so it disappears when authentication finishes.
 */
(() => {
  "use strict";
  const marker = "gp-login-enamad-seal";
  const url = "https://trustseal.enamad.ir/?id=7833479&Code=TWkVm1TWlJur0GPTQsBUkAme2pLiKNIn";
  const imageUrl = "https://trustseal.enamad.ir/logo.aspx?id=7833479&Code=TWkVm1TWlJur0GPTQsBUkAme2pLiKNIn";

  const install = () => {
    const login = document.getElementById("login");
    if (!login || document.getElementById(marker)) return;
    const link = document.createElement("a");
    link.id = marker;
    link.className = "gp-login-enamad";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.referrerPolicy = "origin";
    link.setAttribute("aria-label", "مشاهده اعتبار نماد اعتماد الکترونیکی قدیر پارتنر");

    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = "نماد اعتماد الکترونیکی";
    image.referrerPolicy = "origin";
    image.setAttribute("code", "TWkVm1TWlJur0GPTQsBUkAme2pLiKNIn");
    image.loading = "lazy";
    image.decoding = "async";
    link.appendChild(image);
    login.appendChild(link);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, {once: true});
  } else {
    install();
  }
})();
