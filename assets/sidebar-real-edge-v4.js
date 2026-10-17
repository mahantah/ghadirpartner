/* GHADIR_SIDEBAR_REAL_EDGE_V4_20261017
   Measure real sidebar width, and use it for the single morphing edge toggle.
   The drawer-open CSS, navigation handlers, OTP, and profile stay unchanged.
*/
(function(){
  'use strict';
  function init(){
    var app=document.getElementById('app');
    var header=app&&app.querySelector('header');
    var nav=header&&header.querySelector('.topnav');
    var toggle=header&&header.querySelector('.nav-toggle.gp-nav-morph');
    if(!app||!header||!nav||!toggle||toggle.dataset.gpRealEdgeV4==='1')return;
    toggle.dataset.gpRealEdgeV4='1';
    var active=true;
    function measure(){
      if(!active)return;
      // offsetWidth reports the computed physical CSS width even when the
      // sidebar is translated off screen by transform:translate3d().
      var width=nav.getBoundingClientRect().width;
      if(!isFinite(width)||width<=0)width=nav.offsetWidth;
      if(width>0)header.style.setProperty('--gp-actual-sidebar-width',width+'px');
    }
    measure();
    var observer=typeof ResizeObserver==='function'?new ResizeObserver(measure):null;
    if(observer)observer.observe(nav);
    window.addEventListener('resize',measure,{passive:true});
    // Changes to desktop/mobile classes can alter actual drawer dimensions.
    var classObserver=new MutationObserver(measure);
    classObserver.observe(nav,{attributes:true,attributeFilter:['class']});
    // Avoid rewriting the original menu-toggle click handler.
    toggle.addEventListener('click',measure);
    window.addEventListener('orientationchange',measure,{passive:true});
    // Correct the geometry once after browser layout/presentation settles.
    window.requestAnimationFrame(measure);
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init,{once:true});
  } else init();
})();
