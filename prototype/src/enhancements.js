import {repository} from './repository.js';
import {config} from './config.js';
import {catalogKey, simpleRequestSentinel, suggestTicketTitle, isSimpleRequest} from './operations.js';

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=value=>catalogKey(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const normalizeTitle=value=>String(value??'').replace(/\s+/g,' ').trim();
const isOperationsArea=area=>normalize(area)==='OPERACIONES';
const isSimpleArea=area=>Boolean(String(area||'').trim())&&!isOperationsArea(area);
const titleMax=80;
let personnel=[];
let rewriteTarget=null;
let rewriteOriginal='';
let titleTimer=null;
let newTicketEnhanceQueued=false;
let detailEnhanceQueued=false;

const peoplePromise=repository.personnel().then(rows=>{personnel=rows||[];return personnel;}).catch(()=>[]);

function getPerson(name){return personnel.find(p=>normalize(p.name)===normalize(name));}

function protectedTerms(text,prefix=''){
 const terms=new Set();
 const source=String(text||'');
 const add=value=>{const v=String(value||'').trim();if(v.length>=2)terms.add(v);};
 add($(prefix+'model')?.value);add($(prefix+'serial')?.value);add($(prefix+'equipmentType')?.value);
 const unitPattern=/\b\d+(?:[.,]\d+)?\s?(?:VCA|VDC|VAC|V|kW|kVA|Hz|RPM|A|Ah|bar|psi|°C|mm|cm|kg|L|%)\b/gi;
 for(const match of source.matchAll(unitPattern))add(match[0]);
 const codePattern=/\b(?=[A-Z0-9/_-]{3,}\b)(?=[A-Z0-9/_-]*\d)[A-Z0-9][A-Z0-9/_-]*\b/g;
 for(const match of source.matchAll(codePattern))add(match[0]);
 return [...terms].slice(0,80);
}

function ensureRewriteDialog(){
 if($('sudmarRewriteDialog'))return;
 document.body.insertAdjacentHTML('beforeend',`
 <dialog id="sudmarRewriteDialog" class="small-dialog sudmar-rewrite-dialog" aria-labelledby="sudmarRewriteTitle">
  <div class="dialog-header"><div><span class="eyebrow">ASISTENTE DE REDACCIÓN</span><h2 id="sudmarRewriteTitle">✨ Mejorar redacción</h2></div><button type="button" class="icon-button" data-sudmar-rewrite-close aria-label="Cerrar">×</button></div>
  <div class="dialog-body">
   <p class="muted">Elige cuánto quieres modificar. La propuesta nunca sustituye tu texto hasta que la aceptes.</p>
   <div class="sudmar-rewrite-modes" role="group" aria-label="Modo de mejora">
    <button type="button" class="button secondary" data-sudmar-rewrite-mode="orthography">Corregir ortografía</button>
    <button type="button" class="button secondary" data-sudmar-rewrite-mode="clarity">Mejorar claridad</button>
    <button type="button" class="button secondary" data-sudmar-rewrite-mode="technical">Redacción técnica</button>
   </div>
   <div class="sudmar-rewrite-block"><span class="tiny-label">TEXTO ORIGINAL</span><div id="sudmarRewriteOriginal" class="sudmar-rewrite-text"></div></div>
   <div class="sudmar-rewrite-block"><span class="tiny-label">PROPUESTA</span><div id="sudmarRewriteStatus" class="muted">Selecciona una opción para generar la propuesta.</div><textarea id="sudmarRewriteProposal" rows="7" hidden></textarea></div>
   <div id="sudmarRewriteError" class="form-error" role="alert"></div>
  </div>
  <div class="dialog-footer"><button type="button" class="button ghost" data-sudmar-rewrite-close>Descartar</button><button type="button" class="button primary" id="sudmarRewriteAccept" disabled>Aceptar</button></div>
 </dialog>`);
}

async function callWritingAssistant(mode,text,terms=[]){
 const base=config.supabase?.url?.replace(/\/$/,'');
 const key=config.supabase?.publishableKey;
 if(!base||!key)throw new Error('El asistente de redacción no está configurado.');
 const response=await fetch(base+'/functions/v1/sudmar-text-assistant',{
  method:'POST',
  headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`,'X-SUDMAR-CLIENT':'service-platform'},
  body:JSON.stringify({mode,text,protectedTerms:terms})
 });
 let body={};try{body=await response.json();}catch{}
 if(!response.ok)throw new Error(body?.error||'No se pudo generar la propuesta de redacción.');
 if(!body?.text)throw new Error('El asistente no devolvió una propuesta.');
 return String(body.text).trim();
}

function openRewrite(target){
 ensureRewriteDialog();
 rewriteTarget=target;rewriteOriginal=String(target.value||'').trim();
 $('sudmarRewriteOriginal').textContent=rewriteOriginal||'Sin texto.';
 $('sudmarRewriteProposal').value='';$('sudmarRewriteProposal').hidden=true;
 $('sudmarRewriteStatus').hidden=false;$('sudmarRewriteStatus').textContent='Selecciona una opción para generar la propuesta.';
 $('sudmarRewriteError').textContent='';$('sudmarRewriteAccept').disabled=true;
 document.querySelectorAll('[data-sudmar-rewrite-mode]').forEach(btn=>btn.classList.remove('active'));
 $('sudmarRewriteDialog').showModal();
}

async function generateRewrite(mode,button){
 if(!rewriteTarget||!rewriteOriginal)return;
 document.querySelectorAll('[data-sudmar-rewrite-mode]').forEach(btn=>btn.classList.toggle('active',btn===button));
 $('sudmarRewriteError').textContent='';$('sudmarRewriteProposal').hidden=true;$('sudmarRewriteAccept').disabled=true;
 $('sudmarRewriteStatus').hidden=false;$('sudmarRewriteStatus').textContent='Generando propuesta…';
 button.disabled=true;
 try{
  const prefix=rewriteTarget.id.startsWith('newTicket')?'newTicket':rewriteTarget.id.startsWith('ticketEdit')?'ticketEdit':'';
  const result=await callWritingAssistant(mode,rewriteOriginal,protectedTerms(rewriteOriginal,prefix));
  $('sudmarRewriteProposal').value=result;$('sudmarRewriteProposal').hidden=false;$('sudmarRewriteStatus').hidden=true;$('sudmarRewriteAccept').disabled=false;
 }catch(error){
  $('sudmarRewriteStatus').textContent='No se generó ninguna propuesta.';
  $('sudmarRewriteError').textContent=error.message;
 }finally{button.disabled=false;}
}

function attachRewriteButtons(root=document){
 const ids=['newTicketwhat','newTicketwhere','newTicketcondition','newTicketrequired','ticketEditwhat','ticketEditwhere','ticketEditcondition','ticketEditrequired','ticketEditTechnicalFindings','ticketEditWorkPerformed','ticketEditFinalCondition','ticketEditLog'];
 for(const id of ids){
  const textarea=$(id);if(!textarea||textarea.dataset.rewriteReady==='1')continue;
  textarea.dataset.rewriteReady='1';textarea.spellcheck=true;textarea.lang='es-MX';
  const button=document.createElement('button');button.type='button';button.className='text-action sudmar-rewrite-button';button.dataset.sudmarRewrite=id;button.textContent='✨ Mejorar redacción';
  textarea.insertAdjacentElement('afterend',button);
 }
}

function requestContextFrom(prefix){
 return {
  what:$(prefix+'what')?.value?.trim()||'',
  where:$(prefix+'where')?.value?.trim()||'',
  condition:$(prefix+'condition')?.value?.trim()||'',
  required:$(prefix+'required')?.value?.trim()||''
 };
}

function requestReady(prefix){
 const context=requestContextFrom(prefix);
 if(isSimpleRequest(context))return context.required.length>=4;
 return ['what','where','condition','required'].every(key=>context[key].length>=4);
}

function titleFieldHtml(prefix,value=''){
 return `<div class="field full-width sudmar-title-field" id="${prefix}TitleField">
  <label>Título del ticket<input id="${prefix}TitleInput" maxlength="120" value="${esc(value)}" autocomplete="off" placeholder="Título breve para identificar el ticket"></label>
  <div class="sudmar-title-toolbar"><button type="button" class="text-action" data-sudmar-title-suggest="${prefix}">↻ Generar sugerencia</button><span>Máximo recomendado: ${titleMax} caracteres.</span></div>
  <div class="sudmar-title-proposal" id="${prefix}TitleProposal" hidden><span></span><button type="button" class="button secondary small" data-sudmar-title-use="${prefix}">Usar sugerencia</button></div>
 </div>`;
}

function localTitle(prefix){return suggestTicketTitle(requestContextFrom(prefix),titleMax);}

async function generateTitleProposal(prefix,useAI=true){
 const proposal=$(prefix+'TitleProposal'),input=$(prefix+'TitleInput');if(!proposal||!input)return;
 const local=localTitle(prefix);if(!local)return;
 let suggestion=local;
 if(useAI){
  try{
   const context=requestContextFrom(prefix);
   const source=isSimpleRequest(context)?context.required:[context.what,context.where,context.condition,context.required].filter(v=>v&&!v.startsWith('__SUDMAR_')).join('\n');
   suggestion=await callWritingAssistant('title',source,protectedTerms(source,prefix));
  }catch{/* Local suggestion remains available when the AI service is not configured. */}
 }
 suggestion=normalizeTitle(suggestion);
 if(suggestion.length>titleMax)suggestion=suggestion.slice(0,titleMax).replace(/[\s.,;:]+$/,'')+'…';
 proposal.querySelector('span').textContent=suggestion;proposal.hidden=false;
 return suggestion;
}

function autoSuggestTitle(prefix){
 clearTimeout(titleTimer);titleTimer=setTimeout(()=>{
  const input=$(prefix+'TitleInput');if(!input||input.dataset.userEdited==='1'||input.value.trim()||!requestReady(prefix))return;
  const suggestion=localTitle(prefix);if(suggestion){input.value=suggestion;input.dataset.autoSuggested='1';}
 },250);
}

function applyNewTicketCaptureMode(){
 const area=$('newTicketarea')?.value||'';const simple=isSimpleArea(area);
 const keys=['what','where','condition'];
 for(const key of keys){
  const textarea=$('newTicket'+key);if(!textarea)continue;
  const wrapper=textarea.closest('.field');
  if(simple){
   if(textarea.value!==simpleRequestSentinel)textarea.dataset.fullValue=textarea.value||'';
   textarea.value=simpleRequestSentinel;textarea.required=false;if(wrapper)wrapper.hidden=true;
  }else{
   if(textarea.value===simpleRequestSentinel)textarea.value=textarea.dataset.fullValue||'';
   textarea.required=true;if(wrapper)wrapper.hidden=false;
  }
 }
 const required=$('newTicketrequired');if(required){required.required=true;required.spellcheck=true;}
 let note=$('newTicketCaptureModeNote');
 if(!note&&required?.closest('.field')){
  note=document.createElement('p');note.id='newTicketCaptureModeNote';note.className='definition-note full-width';required.closest('.field').insertAdjacentElement('afterend',note);
 }
 const noteText=simple?`Captura simplificada para ${area}: solo se requiere describir qué se necesita realizar.`:'Captura técnica completa para Operaciones.';
 if(note&&note.textContent!==noteText)note.textContent=noteText;
 const summary=$('newTicketsummary');
 const summaryText=required?.value?.trim()||'El resumen se generará con “¿Qué se requiere realizar?”.';
 if(summary&&simple&&summary.textContent!==summaryText)summary.textContent=summaryText;
 autoSuggestTitle('newTicket');
}

function applyTicketEditCaptureMode(){
 const context=requestContextFrom('ticketEdit');
 const simple=isSimpleRequest(context);
 for(const key of ['what','where','condition']){
  const textarea=$('ticketEdit'+key);if(!textarea)continue;
  const wrapper=textarea.closest('.field');
  textarea.required=!simple;
  if(wrapper)wrapper.hidden=simple;
 }
 const required=$('ticketEditrequired');if(required)required.required=true;
 let note=$('ticketEditCaptureModeNote');
 if(simple&& !note && required?.closest('.field')){
  note=document.createElement('p');note.id='ticketEditCaptureModeNote';note.className='definition-note full-width';required.closest('.field').insertAdjacentElement('afterend',note);
 }
 if(note){
  note.hidden=!simple;
  if(simple)note.textContent='Este ticket usa captura simplificada: solo se requiere describir qué se necesita realizar.';
 }
 const summary=$('ticketEditsummary');
 if(simple&&summary){
  const summaryText=required?.value?.trim()||summary.textContent;
  if(summaryText&&summary.textContent!==summaryText)summary.textContent=summaryText;
 }
}

function updateSimpleSummary(){
 if(!isSimpleArea($('newTicketarea')?.value))return;
 const required=$('newTicketrequired'),summary=$('newTicketsummary');
 const summaryText=required?.value?.trim()||'El resumen se generará con “¿Qué se requiere realizar?”.';
 if(summary&&summary.textContent!==summaryText)summary.textContent=summaryText;
}

function enhanceNewTicket(){
 const form=$('newTicketForm');if(!form||!$('newTicketDialog')?.open)return;
 const summary=$('newTicketsummary');
 if(summary&&!$('newTicketTitleField'))summary.parentElement.insertAdjacentHTML('afterend',titleFieldHtml('newTicket'));
 applyNewTicketCaptureMode();
 attachRewriteButtons(form);
 autoSuggestTitle('newTicket');
}

function enhanceTicketDetail(){
 const folio=$('ticketEditfolio');if(!folio||!$('detailDialog')?.open)return;
 if(!$('ticketEditTitleField')){
  const current=document.querySelector('#detailContent .detail-heading-title h3')?.textContent?.trim()||'';
  folio.closest('.field')?.insertAdjacentHTML('afterend',titleFieldHtml('ticketEdit',current));
  const input=$('ticketEditTitleInput');if(input)input.dataset.userEdited='1';
 }
 applyTicketEditCaptureMode();
 attachRewriteButtons($('detailContent'));
}

async function syncNewTicketOwner(){
 if(!personnel.length)await peoplePromise;
 const owner=$('newTicketowner')?.value||'';const person=getPerson(owner);const area=$('newTicketarea');
 if(area&&person){
  const preferred=person.area||person.operationalAreas?.[0]||'';
  if([...area.options||[]].some(option=>option.value===preferred))area.value=preferred;
 }
 else if(area&&!owner)area.value='';
 applyNewTicketCaptureMode();
}

// Keep the original repository API intact and only enrich ticket writes with the
// editable title collected by the enhancement UI.
const originalTicketBody=repository.ticketBody.bind(repository);
repository.ticketBody=async function(payload,creating=false){
 const body=await originalTicketBody(payload,creating);
 if(payload.title!==undefined){
  const title=normalizeTitle(payload.title);
  if(title)body.title=title.slice(0,180);
 }
 return body;
};
const originalCreateTicket=repository.createTicket.bind(repository);
repository.createTicket=async function(payload){
 const title=normalizeTitle($('newTicketTitleInput')?.value);
 return originalCreateTicket({...payload,...(title?{title}:{})});
};
const originalUpdateTicket=repository.updateTicket.bind(repository);
repository.updateTicket=async function(id,changes){
 const title=normalizeTitle($('ticketEditTitleInput')?.value);
 return originalUpdateTicket(id,{...changes,...(title?{title}:{})});
};

ensureRewriteDialog();

function queueNewTicketEnhancement(){
 if(newTicketEnhanceQueued)return;
 newTicketEnhanceQueued=true;
 queueMicrotask(()=>{newTicketEnhanceQueued=false;enhanceNewTicket();});
}
function queueDetailEnhancement(){
 if(detailEnhanceQueued)return;
 detailEnhanceQueued=true;
 queueMicrotask(()=>{detailEnhanceQueued=false;enhanceTicketDetail();});
}

document.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.action==='new-ticket')queueNewTicketEnhancement();
 if(button.dataset.action==='ticket')queueDetailEnhancement();
 if(button.dataset.sudmarRewrite){const target=$(button.dataset.sudmarRewrite);if(target)openRewrite(target);}
 if(button.dataset.sudmarRewriteClose!==undefined)$('sudmarRewriteDialog')?.close();
 if(button.dataset.sudmarRewriteMode){await generateRewrite(button.dataset.sudmarRewriteMode,button);}
 if(button.id==='sudmarRewriteAccept'&&rewriteTarget){
  rewriteTarget.value=$('sudmarRewriteProposal').value;rewriteTarget.dispatchEvent(new Event('input',{bubbles:true}));$('sudmarRewriteDialog').close();
 }
 if(button.dataset.sudmarTitleSuggest){
  const prefix=button.dataset.sudmarTitleSuggest;button.disabled=true;try{await generateTitleProposal(prefix,true);}finally{button.disabled=false;}
 }
 if(button.dataset.sudmarTitleUse){
  const prefix=button.dataset.sudmarTitleUse,input=$(prefix+'TitleInput'),proposal=$(prefix+'TitleProposal');
  const text=proposal?.querySelector('span')?.textContent?.trim();if(input&&text){input.value=text;input.dataset.userEdited='1';proposal.hidden=true;}
 }
});

document.addEventListener('change',event=>{
 if(event.target.id==='newTicketowner')syncNewTicketOwner();
 if(event.target.id==='newTicketarea')applyNewTicketCaptureMode();
 if(event.target.id==='ticketEditowner'||event.target.id==='ticketEditarea')queueDetailEnhancement();
});

document.addEventListener('input',event=>{
 if(event.target.id==='newTicketTitleInput'||event.target.id==='ticketEditTitleInput')event.target.dataset.userEdited='1';
 if(['newTicketwhat','newTicketwhere','newTicketcondition','newTicketrequired'].includes(event.target.id)){
  updateSimpleSummary();autoSuggestTitle('newTicket');
 }
});

// Dialog open/close changes and detail re-renders are observed separately. The
// enhancement functions are idempotent, so a re-render after saving restores the
// title field and writing controls without creating duplicate elements.
const dialogObserver=new MutationObserver(()=>{
 if($('newTicketDialog')?.open)queueNewTicketEnhancement();
 if($('detailDialog')?.open)queueDetailEnhancement();
});
dialogObserver.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});

const detailContent=$('detailContent');
if(detailContent){
 const detailObserver=new MutationObserver(()=>{if($('detailDialog')?.open)queueDetailEnhancement();});
 detailObserver.observe(detailContent,{childList:true});
}
