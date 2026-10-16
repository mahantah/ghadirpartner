/* GHADIR_STAFF_OTP_SAFARI_UI_FIX_V2_20261016 */
/* GHADIR_STAFF_LOGIN_OTP_UI_V1_20261016
   Enhances the existing live login: preserves original #lu #lp #loginbtn,
   existing password reset/OTP, session bootstrap and all application tabs.
*/
(function(){
  'use strict';
  function init(){
    const login=document.getElementById('login');
    if(!login||login.dataset.gpOtp==='1')return;
    login.dataset.gpOtp='1';login.classList.add('gp-otp-skin');
    const shell=login.querySelector('.automation-login-inner')||login;
    let passwordPanel=document.getElementById('staffLoginForm');
    if(!passwordPanel){
      passwordPanel=document.createElement('div');passwordPanel.id='gp-password-flow';
      for(const name of ['lu','lp','loginbtn','lmsg']){const el=document.getElementById(name);if(el)passwordPanel.appendChild(el);}
      shell.appendChild(passwordPanel);
      const originalHeading=shell.querySelector(':scope > h2');if(originalHeading)originalHeading.hidden=true;
    }
    const card=login.querySelector('.automation-login-card')||login;
    if(card===login)login.classList.add('gp-auth-card');
    const brand=login.querySelector('.automation-login-brand');
    if(!brand){
      const header=document.createElement('div');header.className='automation-login-brand';
      header.innerHTML='<img src="/assets/ghadir-logo-transparent.svg" alt="لوگوی قدیر پرداخت"><div><b>قدیر پارتنر</b><small>GHADIR PARTNER</small></div>';
      shell.insertBefore(header,shell.firstChild);
    }
    const head=document.createElement('div');head.className='gp-auth-head';
    head.innerHTML='<span class="gp-auth-mark">GHADIR PARTNER · SECURE STAFF ACCESS</span><h2>ورود به اتوماسیون</h2><p>با کد یک‌بارمصرف پیامکی وارد شوید یا از رمز عبور خود استفاده کنید.</p>';
    const tabs=document.createElement('div');tabs.className='gp-mode-switch';tabs.setAttribute('role','tablist');
    tabs.innerHTML='<button type="button" role="tab" id="gp-otp-tab" aria-selected="true">ورود با کد OTP</button><button type="button" role="tab" id="gp-password-tab" aria-selected="false">ورود با رمز عبور</button>';
    const otpRoot=document.createElement('div');otpRoot.id='gp-staff-otp-flow';
    otpRoot.innerHTML='<form id="gp-otp-form" autocomplete="on" novalidate><label class="gp-auth-label" for="gp-otp-identity">نام کاربری یا شماره موبایل</label><input id="gp-otp-identity" autocomplete="username" placeholder="نام کاربری یا شماره ثبت‌شده" required><button type="submit" id="gp-otp-request" class="gp-uiverse"><span class="button-outer"><span class="button-inner"><span>دریافت کد ورود</span></span></span></button><div class="gp-otp-step" id="gp-otp-step" hidden><label class="gp-auth-label" for="gp-otp-code">کد یک‌بارمصرف پیامکی</label><input id="gp-otp-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" dir="ltr" placeholder="------" required><button type="button" id="gp-otp-verify" class="gp-uiverse"><span class="button-outer"><span class="button-inner"><span>تأیید و ورود به سامانه</span></span></span></button><div class="gp-otp-actions"><button type="button" id="gp-otp-resend">ارسال مجدد کد</button><button type="button" id="gp-otp-edit">ویرایش نام کاربری</button></div></div><div id="gp-otp-status" class="gp-auth-status" aria-live="polite" role="status"></div></form>';
    const note=document.createElement('div');note.className='gp-auth-note';note.textContent='ورود فقط برای کاربران فعال اتوماسیون با نقش مجاز امکان‌پذیر است.';
    const insertion=brand||shell.firstChild;
    if(insertion&&insertion.parentElement===shell){insertion.insertAdjacentElement('afterend',head);}else shell.insertBefore(head,shell.firstChild);
    head.insertAdjacentElement('afterend',tabs);tabs.insertAdjacentElement('afterend',otpRoot);
    shell.appendChild(note);
    const loading=document.createElement('div');loading.id='gp-staff-loading';loading.hidden=true;loading.setAttribute('role','status');loading.setAttribute('aria-live','polite');
    loading.innerHTML='<div><div class="gp-loader" aria-hidden="true"><div class="gp-loader-cube gp-loader-color"></div><div class="gp-loader-cube gp-loader-glow"></div><img class="gp-loader-logo" src="/assets/ghadir-logo-transparent.svg" alt="" width="96" height="96"></div><div class="gp-loader-copy">در حال بررسی و ورود امن ...</div></div>';
    document.body.appendChild(loading);
    let step='request',busy=false;
    const $=id=>document.getElementById(id);
    function status(text,error){const el=$('gp-otp-status');el.textContent=text;el.dataset.error=error?'1':'0';}
    function lock(on){busy=on;loading.hidden=!on;for(const b of otpRoot.querySelectorAll('button'))b.disabled=on;}
    async function post(path,payload){
      const response=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const body=await response.text();
      let parsed=null;
      try{parsed=JSON.parse(body)}catch(_){}
      if(!response.ok){
        const detail=parsed && typeof parsed==='object' ? (parsed.message||parsed.error||parsed.msg) : '';
        throw new Error(typeof detail==='string'&&detail.trim() ? detail : (parsed?'درخواست انجام نشد؛ دوباره تلاش کنید.':body.slice(0,180)||'خطای ارتباط با سرور'));
      }
      if(!parsed || typeof parsed!=='object')throw new Error('پاسخ سرور معتبر نیست');
      return parsed;
    }
    function showMode(mode){
      const isOtp=mode==='otp';$('gp-otp-tab').setAttribute('aria-selected',String(isOtp));$('gp-password-tab').setAttribute('aria-selected',String(!isOtp));
      otpRoot.hidden=!isOtp;passwordPanel.hidden=isOtp;
      if(isOtp&&$('staffResetForm'))$('staffResetForm').classList.add('hidden');
    }
    function decorated(btn){
      if(!btn||btn.classList.contains('gp-uiverse'))return;
      const text=btn.textContent.trim();btn.classList.add('gp-uiverse');
      btn.innerHTML='<span class="button-outer"><span class="button-inner"><span></span></span></span>';
      btn.querySelector('.button-inner span').textContent=text;
    }
    decorated($('loginbtn'));
    if($('staffOtpBtn'))decorated($('staffOtpBtn'));
    const recovery=login.querySelectorAll('#staffResetForm button.btn2');recovery.forEach(decorated);
    $('gp-otp-tab').addEventListener('click',()=>showMode('otp'));
    $('gp-password-tab').addEventListener('click',()=>showMode('password'));
    login.addEventListener('click',event=>{
      if(event.target.closest('.staff-forgot-btn')){
        // Keep the original password reset handler and its fields untouched.
        showMode('password');
      }
    },true);
    $('gp-otp-form').addEventListener('submit',async e=>{
      e.preventDefault();if(busy)return;
      if(step!=='request')return verify();
      const identity=$('gp-otp-identity').value.trim();
      if(!identity){status('نام کاربری یا شماره موبایل را وارد کنید.',true);return;}
      lock(true);
      try{
        const result=await post('/api/staff-login-otp/request',{identity});
        step='verify';$('gp-otp-step').hidden=false;$('gp-otp-identity').readOnly=true;$('gp-otp-request').hidden=true;
        status(result.message||'اگر حساب فعال و شماره موبایل ثبت‌شده باشد، کد ارسال می‌شود.',false);
        $('gp-otp-code').focus();
      }catch(e){status(e.message,true)}finally{lock(false)}
    });
    async function verify(){
      if(busy)return;
      const identity=$('gp-otp-identity').value.trim();
      const code=$('gp-otp-code').value.replace(/[۰-۹٠-٩]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.includes(c)?'۰۱۲۳۴۵۶۷۸۹'.indexOf(c):'٠١٢٣٤٥٦٧٨٩'.indexOf(c))).trim();
      if(!/^\d{6}$/.test(code)){status('کد تأیید باید شش رقم باشد.',true);return;}
      lock(true);
      try{
        await post('/api/staff-login-otp/verify',{identity,otp:code});
        status('ورود با موفقیت انجام شد.',false);
        window.location.reload();
      }catch(e){status(e.message,true)}finally{lock(false)}
    }
    $('gp-otp-verify').addEventListener('click',verify);
    $('gp-otp-code').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();verify()}});
    $('gp-otp-code').addEventListener('input',e=>{e.target.value=e.target.value.replace(/[^0-9۰-۹٠-٩]/g,'').slice(0,6)});
    $('gp-otp-edit').addEventListener('click',()=>{step='request';$('gp-otp-step').hidden=true;$('gp-otp-request').hidden=false;$('gp-otp-identity').readOnly=false;$('gp-otp-code').value='';status('نام کاربری را اصلاح کنید و کد جدید بگیرید.',false);$('gp-otp-identity').focus()});
    // Resend without resetting the OTP step: on 30-second throttle the previous
    // verified request remains usable and the user can retry the same code.
    $('gp-otp-resend').addEventListener('click',async()=>{
      if(busy)return;
      const identity=$('gp-otp-identity').value.trim();
      if(!identity){status('نام کاربری یا شماره موبایل را وارد کنید.',true);return;}
      lock(true);
      try{
        const result=await post('/api/staff-login-otp/request',{identity});
        step='verify';$('gp-otp-code').value='';$('gp-otp-step').hidden=false;
        $('gp-otp-request').hidden=true;$('gp-otp-identity').readOnly=true;
        status(result.message||'اگر حساب فعال و شماره موبایل ثبت‌شده باشد، کد ارسال می‌شود.',false);
        $('gp-otp-code').focus();
      }catch(e){status(e.message,true)}finally{lock(false)}
    });
    // Existing password login remains available as a fallback; no API replacement.
    showMode('otp');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();