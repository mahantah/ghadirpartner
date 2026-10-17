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

  // Icons are local SVGs so they work without external icon fonts or CDNs.
  var icons={
    details:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 11v5M12 8h.01"/></svg>',
    status:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h11M4 8h11M4 11h7M11 19l2.1-.4L20 11.7 17.3 9l-6.9 6.9L10 19z"/></svg>',
    payment:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M15 15h4"/></svg>',
    edit:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5z"/></svg>',
    history:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8V3M3 8h5M3.4 8a9 9 0 1 1-.4 5"/><path d="M12 7v5l3 2"/></svg>',
    label:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v4H7zM7 17h10v4H7zM6 10h12a3 3 0 0 1 3 3v4h-4M7 17H3v-4a3 3 0 0 1 3-3zM17 13h.01"/></svg>'
  };
  function iconKey(text){
    if(/جزئیات سفارش/.test(text))return 'details';
    if(/تغییر وضعیت/.test(text))return 'status';
    if(/نحوه تسویه|تسویه/.test(text))return 'payment';
    if(/ویرایش سفارش/.test(text))return 'edit';
    if(/تاریخچه/.test(text))return 'history';
    return '';
  }
  function orderIdFromButton(button){
    var match=(button.getAttribute('onclick')||'').match(/toggleOrderMenu\\(event\\s*,\\s*(\\d+)\\)/);
    return match?Number(match[1]):0;
  }
  function decorateOrderMenu(menu,orderId){
    if(!menu)return;
    menu.querySelectorAll('button').forEach(function(button){
      if(button.classList.contains('gp-order-icon-action'))return;
      var key=iconKey(button.textContent||'');
      if(!key)return;
      button.insertAdjacentHTML('afterbegin',icons[key]);
      button.classList.add('gp-order-icon-action');
    });
    if(!orderId||menu.querySelector('[data-gp-action="print-label"]'))return;
    var button=document.createElement('button');
    button.type='button';
    button.dataset.gpAction='print-label';
    button.className='gp-order-icon-action gp-order-label-action';
    button.innerHTML=icons.label+'<span>چاپ لیبل سفارش</span>';
    button.addEventListener('click',function(ev){
      ev.stopPropagation();
      // Same authenticated label preview used by the existing batch-print tool.
      // Opening here (during the real click) keeps popup blockers from intervening.
      var url='/print/order-label?id='+encodeURIComponent(orderId);
      var preview=window.open(url,'_blank');
      if(!preview)alert('مرورگر صفحه چاپ را مسدود کرده است. اجازه Pop-up را برای این سایت فعال کنید.');
      if(typeof closeOrderMenus==='function')closeOrderMenus();
      synchronize();
    });
    var separator=menu.querySelector('.order-menu-sep');
    if(separator)menu.insertBefore(button,separator);
    else menu.appendChild(button);
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
                decorateOrderMenu(opened[0],orderIdFromButton(button));
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
