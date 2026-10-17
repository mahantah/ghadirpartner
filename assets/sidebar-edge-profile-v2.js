/* GHADIR_SIDEBAR_EDGE_PROFILE_V2_20261017
   Remove obsolete "جمع کردن منو", keep ONE animated icon on the drawer edge,
   and make the real password/logout buttons visible within the sidebar.
*/
(function(){
  'use strict';
  function start(){
    var app=document.getElementById('app');
    var header=app&&app.querySelector('header');
    var nav=header&&header.querySelector('.topnav');
    if(!nav||nav.dataset.gpEdgeProfileV2==='1')return;
    nav.dataset.gpEdgeProfileV2='1';
    var userbox=header.querySelector('.userbox')||nav.querySelector('.userbox');
    var trigger=document.getElementById('gp-profile-trigger');
    var actions=document.getElementById('gp-profile-actions');
    var changeBtn=document.getElementById('changePasswordBtn');
    var logoutBtn=document.getElementById('logoutbtn');
    if(userbox && nav!==userbox.parentElement){
      nav.appendChild(userbox);
    }
    if(userbox)userbox.classList.add('gp-profile-host','mobile-nav-userbox');
    // These are the exact original buttons, not duplicates. Existing handlers
    // remain bound to the same nodes.
    if(actions&&changeBtn&&changeBtn.parentElement!==actions)actions.appendChild(changeBtn);
    if(actions&&logoutBtn&&logoutBtn.parentElement!==actions)actions.appendChild(logoutBtn);
    function removeObsoleteClose(){
      nav.querySelectorAll('button,[role="button"]').forEach(function(btn){
        if(btn.hasAttribute('data-tab')||btn===trigger)return;
        var name=String(btn.textContent||'').replace(/\s+/g,' ').trim();
        if(name==='جمع کردن منو'||name==='بستن منو'||name==='باز کردن منو'){
          btn.remove();
        }
      });
    }
    removeObsoleteClose();
    // An independent legacy module can add the close label asynchronously.
    // The observer removes only exact duplicate close labels, never route buttons.
    new MutationObserver(removeObsoleteClose).observe(nav,{childList:true,subtree:true});
    function revealProfile(){
      if(!actions||actions.hidden)return;
      window.requestAnimationFrame(function(){
        if(!actions.hidden && typeof actions.scrollIntoView==='function'){
          actions.scrollIntoView({block:'nearest',inline:'nearest'});
        }
      });
    }
    if(trigger){
      trigger.addEventListener('click',function(){revealProfile()});
    }
    // Keep menu actions discoverable when a browser restores a previous tab.
    if(nav.classList.contains('sidebar-open')){
      if(trigger)trigger.setAttribute('aria-expanded',actions&&!actions.hidden?'true':'false');
    }
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',start,{once:true});
  }else start();
})();
