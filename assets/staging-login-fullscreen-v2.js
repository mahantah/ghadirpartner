/* Ghadir Partner staging login icon controls — visual behavior only; auth code unchanged. */
(function(){
  function init(){
    const button=document.getElementById('stg-password-toggle');
    const password=document.getElementById('lp');
    if(!button||!password||button.dataset.gpIconBound==='1')return;
    button.dataset.gpIconBound='1';
    button.addEventListener('click',()=>{
      const show=password.type==='password';
      password.type=show?'text':'password';
      button.setAttribute('aria-pressed',String(show));
      button.setAttribute('aria-label',show?'مخفی‌کردن رمز عبور':'نمایش رمز عبور');
      button.title=button.getAttribute('aria-label');
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();