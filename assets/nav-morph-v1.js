/* GHADIR_NAV_MORPH_V1_20261017
   One accessible toggle for both hamburger and X. Keeps existing route
   navigation, submenu clicks, roles and original sidebar CSS behavior.
*/
(function(){
  'use strict';
  function init(){
    var app=document.getElementById('app');
    if(!app)return;
    var header=app.querySelector('header');
    var nav=header&&header.querySelector('.topnav');
    var toggle=header&&header.querySelector('.nav-toggle');
    var overlay=app.querySelector('.nav-overlay');
    if(!header||!nav||!toggle||!overlay||toggle.dataset.gpMorphNav==='1')return;
    toggle.dataset.gpMorphNav='1';
    toggle.classList.add('gp-nav-morph');
    toggle.type='button';
    toggle.textContent='';
    toggle.innerHTML='<span class="gp-nav-lines" aria-hidden="true"><span class="gp-nav-line"></span><span class="gp-nav-line"></span><span class="gp-nav-line"></span></span>';
    if(!nav.id)nav.id='gp-main-sidebar';
    toggle.setAttribute('aria-controls',nav.id);
    toggle.setAttribute('aria-haspopup','true');
    // There is only one close affordance: the same button morphs into an X.
    var oldClose=nav.querySelector('.sidebar-head .sidebar-close');
    if(oldClose)oldClose.remove();
    function sync(){
      var open=nav.classList.contains('sidebar-open');
      toggle.setAttribute('aria-expanded',String(open));
      toggle.setAttribute('aria-label',open?'بستن منوی سامانه':'باز کردن منوی سامانه');
      toggle.title=open?'بستن منوی سامانه':'باز کردن منوی سامانه';
    }
    function setOpen(open){
      nav.classList.toggle('sidebar-open',open);
      overlay.classList.toggle('visible',open);
      document.body.style.overflow=open?'hidden':'';
      sync();
    }
    // Replace only the old navigation toggle/overlay handlers. All menu
    // action handlers and section routing stay untouched.
    toggle.onclick=function(e){e.preventDefault();setOpen(!nav.classList.contains('sidebar-open'))};
    overlay.onclick=function(){setOpen(false);toggle.focus({preventScroll:true})};
    // The original application also closes the menu after selecting a page.
    // Reconcile accessibility and icon appearance even in that legacy path.
    var observer=new MutationObserver(sync);
    observer.observe(nav,{attributes:true,attributeFilter:['class']});
    nav.addEventListener('click',function(event){
      if(event.target.closest('[data-tab]')) {
        setOpen(false);
      }
    });
    document.addEventListener('keydown',function(event){
      if(event.key==='Escape'&&nav.classList.contains('sidebar-open')){
        setOpen(false);
        toggle.focus({preventScroll:true});
      }
    });
    sync();
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init,{once:true});
  }else init();
})();
