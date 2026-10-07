(async function(){
 'use strict';
 await document.fonts.ready;
 const root=document.getElementById('pages');
 function page(title){const label=document.createElement('section');label.className='label';const head=document.createElement('div');head.className='head';head.textContent=title;const content=document.createElement('div');content.className='content';const foot=document.createElement('div');foot.className='foot';label.append(head,content,foot);root.append(label);return {label,content,foot};}
 function block(value){const el=document.createElement('div');el.className='block'+(value.serial?' serial':'');el.textContent=value.text;return el;}
 function fits(p){const last=p.content.lastElementChild;return !last||last.getBoundingClientRect().bottom<=p.content.getBoundingClientRect().bottom+.1;}
 try{
 for(const doc of window.GP_LABEL_DOCUMENTS){let p=page(doc.title),pages=[p];for(const value of doc.blocks){let el=block(value);p.content.append(el);if(fits(p))continue;el.remove();if(p.content.children.length){p=page(doc.title);pages.push(p);}p.content.append(el);if(fits(p))continue;
 // Split oversized content without dropping any characters or shrinking the font.
 el.remove();let rest=Array.from(String(value.text));while(rest.length){el=block({...value,text:''});p.content.append(el);let n=0;while(n<rest.length){el.textContent+=rest[n];if(!fits(p)){el.textContent=Array.from(el.textContent).slice(0,-1).join('');break;}n++;}if(!n)throw Error('ابعاد لیبل برای متن کافی نیست؛ اندازه یا حاشیه را اصلاح کنید.');rest=rest.slice(n);if(rest.length){p=page(doc.title);pages.push(p);}}
 }pages.forEach((v,i)=>v.foot.textContent=(i+1)+' / '+pages.length);}
 document.getElementById('status').textContent=root.children.length+' لیبل آماده است';document.getElementById('print').disabled=false;document.getElementById('print').onclick=()=>window.print();
 }catch(e){document.getElementById('status').textContent=e.message;document.getElementById('status').className='error';}
})();
