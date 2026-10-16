/* GHADIR_SIDEBAR_PROFILE_POLISH_V1_20261017
   Menu close area, clean orange logo and a single profile disclosure.
   Original #changePasswordBtn/#logoutbtn are MOVED, not recreated, so
   existing server handlers and permission checks remain unchanged.
*/
(function(){
  'use strict';
  function init(){
    var app=document.getElementById('app');
    var header=app&&app.querySelector('header');
    var nav=header&&header.querySelector('.topnav');
    if(!header||!nav||nav.dataset.gpSidebarProfile==='1')return;
    var profileHost=header.querySelector('.userbox')||nav.querySelector('.userbox');
    var changeBtn=document.getElementById('changePasswordBtn');
    var logoutBtn=document.getElementById('logoutbtn');
    if(!profileHost||!changeBtn||!logoutBtn)return;
    nav.dataset.gpSidebarProfile='1';
    // Reserve the topmost row exclusively for the animated hamburger/X.
    // Navigation content starts underneath it; no overlap with the name.
    var navHead=nav.querySelector('.sidebar-head');
    if(navHead)navHead.classList.add('gp-sidebar-heading');
    // The existing project already contains a transparent orange SVG mark.
    var logo=(navHead&&navHead.querySelector('img'))||
      nav.querySelector('img[src*="logo"],img[src*="brand"]');
    if(!logo)logo=nav.querySelector('img');
    if(logo){
      logo.src='/assets/ghadir-logo-transparent.svg';
      logo.classList.add('gp-orange-logo');
      var logoShell=logo.parentElement;
      if(logoShell&&logoShell.children.length===1){
        logoShell.classList.add('gp-orange-logo-shell');
      }
    }else if(navHead){
      logo=document.createElement('img');
      logo.className='gp-orange-logo';
      logo.src='/assets/ghadir-logo-transparent.svg';
      logo.alt='نشان قدیر پرداخت';
      logo.width=52;logo.height=52;
      navHead.insertBefore(logo,navHead.firstChild);
    }
    // Remove duplicate legacy close control if present. The animated
    // hamburger itself is the single accessible close affordance.
    nav.querySelectorAll('button').forEach(function(btn){
      var label=(btn.textContent||'').replace(/\s+/g,' ').trim();
      if(btn.classList.contains('sidebar-close') ||
         (!btn.hasAttribute('data-tab') && label==='جمع کردن منو')){
        btn.classList.add('gp-sidebar-legacy-close');
        btn.hidden=true;
      }
    });
    var who=document.getElementById('who');
    var wrap=document.createElement('div');
    wrap.className='gp-profile-wrap';
    var trigger=document.createElement('button');
    trigger.type='button';
    trigger.className='gp-profile-trigger';
    trigger.id='gp-profile-trigger';
    trigger.setAttribute('aria-haspopup','true');
    trigger.setAttribute('aria-expanded','false');
    trigger.setAttribute('aria-controls','gp-profile-actions');
    trigger.setAttribute('aria-label','پروفایل کاربر؛ تغییر رمز و خروج');
    trigger.innerHTML='<span class="gp-profile-avatar" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M4.5 20c.7-4 3.2-6 7.5-6s6.8 2 7.5 6"></path></svg></span>'+
      '<span class="gp-profile-label"><span class="gp-profile-title">پروفایل کاربر</span></span>'+
      '<span class="gp-profile-chevron" aria-hidden="true">⌄</span>';
    var label=trigger.querySelector('.gp-profile-label');
    if(who){label.appendChild(who)}
    var actions=document.createElement('div');
    actions.id='gp-profile-actions';
    actions.className='gp-profile-actions';
    actions.setAttribute('role','menu');
    actions.hidden=true;
    // Reparent existing action buttons to preserve their click handlers.
    [changeBtn,logoutBtn].forEach(function(btn){
      btn.setAttribute('role','menuitem');
      actions.appendChild(btn);
    });
    wrap.appendChild(trigger);
    wrap.appendChild(actions);
    profileHost.classList.add('gp-profile-host');
    profileHost.appendChild(wrap);
    function setProfileOpen(open){
      actions.hidden=!open;
      trigger.setAttribute('aria-expanded',String(open));
    }
    trigger.addEventListener('click',function(e){
      e.preventDefault();
      setProfileOpen(actions.hidden);
    });
    [changeBtn,logoutBtn].forEach(function(btn){
      btn.addEventListener('click',function(){
        setProfileOpen(false);
        // Restore the content area for modal/logout while retaining the
        // actual original action handlers on these DOM buttons.
        var navToggle=header.querySelector('.nav-toggle');
        if(nav.classList.contains('sidebar-open')&&navToggle){
          navToggle.click();
        }
      });
    });
    document.addEventListener('pointerdown',function(e){
      if(!wrap.contains(e.target))setProfileOpen(false);
    });
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&!actions.hidden){
        setProfileOpen(false);
        trigger.focus({preventScroll:true});
      }
    });
    var observer=new MutationObserver(function(){
      if(!nav.classList.contains('sidebar-open'))setProfileOpen(false);
    });
    observer.observe(nav,{attributes:true,attributeFilter:['class']});
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init,{once:true});
  }else init();
})();
