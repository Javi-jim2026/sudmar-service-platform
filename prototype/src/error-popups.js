/* Avisos de validación: sin alterar los formularios ni los datos capturados. */
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const errorIds=new Set(['newTicketError','newTaskError','catalogError','filterError','deleteTicketError','newTicketError','newTaskError']);
let modal=null,previousFocus=null,lastMessage='',lastAt=0;
function showError(message){
 const value=String(message??'').trim();
 if(!value)return;
 if(modal?.open){modal.querySelector('[data-error-message]').textContent=value;return;}
 if(value===lastMessage&&Date.now()-lastAt<550)return;
 lastMessage=value;lastAt=Date.now();
 previousFocus=document.activeElement;
 modal=document.createElement('dialog');
 modal.className='sudmar-error-popup';
 modal.setAttribute('aria-labelledby','sudmarErrorHeading');
 modal.innerHTML='<section class="sudmar-error-popup-inner"><div class="sudmar-error-heading"><span aria-hidden="true">⚠️</span><h2 id="sudmarErrorHeading">No se pudo completar la operación</h2></div><p data-error-message>'+escapeHtml(value)+'</p><div class="sudmar-error-actions"><button type="button" class="button primary" data-error-dismiss>Entendido</button></div></section>';
 document.body.append(modal);
 modal.addEventListener('click',event=>{if(event.target===modal)modal.close();});
 modal.querySelector('[data-error-dismiss]').addEventListener('click',()=>modal.close());
 modal.addEventListener('close',()=>{modal.remove();modal=null;if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});});
 modal.showModal();
}
function checkErrorElement(el){
 if(!el||!errorIds.has(el.id))return;
 const msg=el.textContent.trim();
 if(msg&&el.dataset.presentedError!==msg){el.dataset.presentedError=msg;showError(msg);}
 if(!msg)delete el.dataset.presentedError;
}
const observer=new MutationObserver(records=>{
 const nodes=new Set();
 for(const record of records){
  const element=record.target.nodeType===1?record.target:record.target.parentElement;
  const field=element?.closest?.('[id]');
  if(field&&errorIds.has(field.id))nodes.add(field);
 }
 for(const element of nodes)checkErrorElement(element);
});
observer.observe(document.body,{subtree:true,childList:true,characterData:true});
document.addEventListener('invalid',event=>{
 const control=event.target;
 if(!control.closest?.('form'))return;
 const form=control.closest('form');
 if(!form.closest('#newTicketDialog,#newTaskDialog,#catalogDialog,#detailDialog,#sudmarRewriteDialog'))return;
 event.preventDefault();
 const label=control.closest('label')?.textContent?.trim()||control.getAttribute('aria-label')||control.name||'Campo obligatorio';
 showError('Revisa el campo «'+label.slice(0,100)+'». '+(control.validity.valueMissing?'Falta completar este dato.':control.validationMessage));
},true);
