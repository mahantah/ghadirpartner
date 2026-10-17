/* GHADIR_ORDER_ACTION_BURGER_V1_20261017
   Use the user's three-line/animated-X checkbox for each ORDER action menu.
   Keep the existing order-menu creation, permission checks, links, and
   event.currentTarget geometry from the native button unchanged.
   Do NOT affect customers' unrelated three-dot actions or the global nav.
*/
(function(){
  'use strict';
  var nextId=0;
  var installed=false;
  var refreshing=false;
  function orderMenus(){
    return Array.from(document.querySelectorAll('body > .order-menu.open:not(.customer-menu)'));
  }
  function synchronize(){
    var menu=orderMenus()[0]||null;
    var activeId=menu?.dataset.gpOrderBurgerOwner||'';
    document.querySelectorAll('#orders .gp-order-burger-wrap input.gp-order-burger-input')
      .forEach(function(input){
        var expanded=!!menu && input.id===activeId;
        if(input.checked!==expanded)input.checked=expanded;
        input.setAttribute('aria-expanded',expanded?'true':'false');
      });
  }
  function render(){
    var root=document.getElementById('orders');
    if(!root||refreshing)return;
    refreshing=true;
    try{
      root.querySelectorAll('button.dots-btn[onclick*="toggleOrderMenu"]:not(.gp-order-native-action)')
        .forEach(function(button){
          if(button.closest('.gp-order-burger-wrap'))return;
          var wrap=document.createElement('span');
          wrap.className='gp-order-burger-wrap';
          var label=document.createElement('label');
          label.className='burger gp-order-burger';
          var input=document.createElement('input');
          input.type='checkbox';
          input.className='gp-order-burger-input';
          input.id='gp-order-burger-'+(++nextId);
          input.setAttribute('aria-label',button.getAttribute('aria-label')||'عملیات سفارش');
          input.setAttribute('aria-expanded','false');
          label.setAttribute('for',input.id);
          label.appendChild(input);
          for(var i=0;i<3;i++)label.appendChild(document.createElement('span'));
          // Global document click closes native order menus; the label is an
          // activator, not an outside click.
          label.addEventListener('click',function(ev){ev.stopPropagation()});
          input.addEventListener('click',function(ev){ev.stopPropagation()});
          input.addEventListener('change',function(ev){
            ev.stopPropagation();
            if(input.checked){
              // Same handler used by the old three-dot control; it builds
              // exactly the same menu with access-controlled actions.
              button.click();
              var opened=orderMenus();
              if(opened.length){
                opened[0].dataset.gpOrderBurgerOwner=input.id;
              }else input.checked=false;
            }else if(typeof closeOrderMenus==='function'){
              closeOrderMenus();
            }else{
              orderMenus().forEach(function(menu){menu.remove()});
            }
            synchronize();
          });
          button.classList.add('gp-order-native-action');
          button.tabIndex=-1;
          button.setAttribute('aria-hidden','true');
          button.parentNode.insertBefore(wrap,button);
          wrap.appendChild(label);
          wrap.appendChild(button);
        });
      synchronize();
    }finally{refreshing=false}
  }
  function init(){
    if(installed)return;
    var root=document.getElementById('orders');
    if(!root)return;
    installed=true;
    render();
    // renderOrders() replaces table rows during paging, searching and
    // status changes, so decorate only newly inserted native buttons.
    var observer=new MutationObserver(function(records){
      if(records.some(function(r){return r.addedNodes.length||r.removedNodes.length}))render();
    });
    observer.observe(root,{childList:true,subtree:true});
    // Native menus are appended to document.body and removed by the
    // unchanged closeOrderMenus() or outside clicks.
    new MutationObserver(function(records){
      if(records.some(function(r){
        return Array.from(r.addedNodes).concat(Array.from(r.removedNodes))
          .some(function(node){
            return node.nodeType===1 &&
              (node.matches?.('.order-menu')||node.querySelector?.('.order-menu'));
          });
      }))synchronize();
    }).observe(document.body,{childList:true});
    document.addEventListener('keydown',function(ev){
      if(ev.key==='Escape'&&orderMenus().length){
        if(typeof closeOrderMenus==='function')closeOrderMenus();
        else orderMenus().forEach(function(el){el.remove()});
        synchronize();
      }
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
