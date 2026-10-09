import {repository} from './repository.js';
import {config} from './config.js';
import {catalogKey, simpleRequestSentinel, suggestTicketTitle, isSimpleRequest} from './operations.js';

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=value=>catalogKey(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const normalizeTitle=value=>String(value??'').replace(/\s+/g,' ').trim();
const fullCaptureAreas=new Set(['OPERACIONES','SERVICIOS ESPECIALIZADOS','ALMACEN FISCAL','PROYECTOS']);
const isFullCaptureArea=area=>fullCaptureAreas.has(normalize(area));
const isSimpleArea=area=>Boolean(String(area||'').trim())&&!isFullCaptureArea(area);
const titleMax=80;
const todayLocal=()=>new Intl.DateTimeFormat('en-CA',{timeZone:config.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let personnel=[];
let rewriteTarget=null;
let rewriteOriginal='';
let titleTimer=null;
let newTicketEnhanceQueued=false;
let newTaskEnhanceQueued=false;
let detailEnhanceQueued=false;

const peoplePromise=repository.personnel().then(rows=>{personnel=rows||[];return personnel;}).catch(()=>[]);

function getPerson(name){return personnel.find(p=>normalize(p.name)===normalize(name));}
function dateOnly(value){return value?String(value).slice(0,10):'';}
function daysBetween(from,to){
 if(!from||!to)return null;
 const a=new Date(from+'T00:00:00Z'),b=new Date(to+'T00:00:00Z');
 return Math.round((b-a)/86400000);
}
function normalizeEvidenceUrl(value){
 let text=String(value||'').trim();
 if(!text)return '';
 if(!/^https?:\/\//i.test(text)&&/^(?:www\.)?(?:1drv\.ms|[^/]*sharepoint\.com)\//i.test(text))text='https://'+text.replace(/^www\./i,'');
 let url;try{url=new URL(text);}catch{throw new Error('Pega un enlace válido de OneDrive o SharePoint.');}
 if(url.protocol!=='https:')throw new Error('El enlace de evidencias debe comenzar con https://');
 return url.href;
}
function safeEvidenceUrl(value){try{return normalizeEvidenceUrl(value);}catch{return '';}}
function evidenceButton(url,label){const safe=safeEvidenceUrl(url);return safe?`<a class="button secondary sudmar-evidence-button" href="${esc(safe)}" target="_blank" rel="noopener noreferrer">📁 ${esc(label)}</a>`:'';}

async function supabaseGet(path){
 const base=config.supabase?.url?.replace(/\/$/,'');const key=config.supabase?.publishableKey;
 if(!base||!key)throw new Error('Supabase no está configurado.');
 const response=await fetch(base+path,{cache:'no-store',headers:{apikey:key,Authorization:`Bearer ${key}`,Accept:'application/json'}});
 if(!response.ok)throw new Error('No se pudo consultar la información complementaria.');
 return response.json();
}

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
 const ids=['newTicketwhat','newTicketwhere','newTicketcondition','newTicketrequired','ticketEditwhat','ticketEditwhere','ticketEditcondition','ticketEditrequired','ticketEditTechnicalFindings','ticketEditWorkPerformed','ticketEditFinalCondition'];
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

function ensureTicketResolutionField(prefix,value=''){
 const due=$(prefix+'dueAt');if(!due||$(prefix+'ResolvedAt'))return;
 const wrapper=document.createElement('div');wrapper.className='field sudmar-resolution-field';
 wrapper.innerHTML=`<label>Fecha de resolución real<input type="date" id="${prefix}ResolvedAt" value="${esc(value)}"></label><span class="sudmar-field-note" id="${prefix}ResolutionNote">Se registra cuando el ticket queda CONCLUIDO.</span><strong class="sudmar-duration" id="${prefix}ResolutionDuration"></strong>`;
 due.closest('.field')?.insertAdjacentElement('afterend',wrapper);
 syncTicketResolutionField(prefix,false);
}
function syncTicketResolutionField(prefix,fromStatusChange=false){
 const status=$(prefix+'status')?.value||'',input=$(prefix+'ResolvedAt');if(!input)return;
 const concluded=status==='CONCLUIDO';input.readOnly=!concluded;
 if(fromStatusChange){if(concluded&&!input.value)input.value=todayLocal();if(!concluded)input.value='';}
 const note=$(prefix+'ResolutionNote');if(note)note.textContent=concluded?'Fecha en la que realmente quedó solucionado. Puedes corregirla.':'Disponible cuando el estado sea CONCLUIDO.';
 updateTicketDuration(prefix);
}
function updateTicketDuration(prefix){
 const from=$(prefix+'openedAt')?.value||'',to=$(prefix+'ResolvedAt')?.value||'',target=$(prefix+'ResolutionDuration');if(!target)return;
 const days=daysBetween(from,to);target.textContent=days===null?'':days===0?'Tiempo real: resuelto el mismo día':`Tiempo real de resolución: ${days} día${days===1?'':'s'}`;
}

function ensureActivityOperationalFields(prefix,values={}){
 const due=$(prefix+'dueAt');if(!due)return;
 if(!$(prefix+'CompletedAt')){
  const wrapper=document.createElement('div');wrapper.className='field sudmar-resolution-field';
  wrapper.innerHTML=`<label>Fecha de realización real<input type="date" id="${prefix}CompletedAt" value="${esc(dateOnly(values.completedAt))}"></label><span class="sudmar-field-note" id="${prefix}CompletedNote">Se habilita al cerrar la actividad.</span>`;
  due.closest('.field')?.insertAdjacentElement('afterend',wrapper);
 }
 if(!$(prefix+'EvidenceUrl')){
  const completed=$(prefix+'CompletedAt');const wrapper=document.createElement('div');wrapper.className='field full-width sudmar-evidence-field';
  wrapper.innerHTML=`<label>Carpeta de evidencias / OneDrive<input type="url" id="${prefix}EvidenceUrl" value="${esc(values.evidenceUrl||'')}" placeholder="https://1drv.ms/... o enlace de SharePoint" autocomplete="off"></label><span class="sudmar-field-note">Pega el enlace de la carpeta de fotos, videos o documentos de esta actividad.</span><div id="${prefix}EvidenceOpen"></div>`;
  completed?.closest('.field')?.insertAdjacentElement('afterend',wrapper);
 }
 updateActivityEvidenceButton(prefix);
 syncActivityCompletionField(prefix,false);
}
async function syncActivityCompletionField(prefix,fromStatusChange=false){
 const status=$(prefix+'status')?.value||'',input=$(prefix+'CompletedAt');if(!input)return;
 const completed=status==='COMPLETADA',cancelled=status==='CANCELADA';
 input.readOnly=!completed;
 if(fromStatusChange){if(completed&&!input.value)input.value=todayLocal();if(!completed)input.value='';}
 const note=$(prefix+'CompletedNote');if(note)note.textContent=completed?'Fecha real del trabajo terminado; puedes corregirla.':cancelled?'Actividad cancelada: no se contabiliza como realizada.':'Se habilita únicamente al seleccionar COMPLETADA.';
 let cancelNote=$(prefix+'CancelledNote');
 if(!cancelNote){cancelNote=document.createElement('span');cancelNote.id=prefix+'CancelledNote';cancelNote.className='sudmar-field-note';input.closest('.field')?.append(cancelNote);}
 cancelNote.hidden=!cancelled;if(cancelled)cancelNote.textContent='La fecha de cancelación se registra automáticamente al guardar.';
}
function updateActivityEvidenceButton(prefix){
 const input=$(prefix+'EvidenceUrl'),target=$(prefix+'EvidenceOpen');if(!input||!target)return;
 const safe=safeEvidenceUrl(input.value);target.innerHTML=safe?evidenceButton(safe,'Abrir evidencias'):'';
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
 const noteText=simple?`Captura simplificada para ${area}: solo se requiere describir qué se necesita realizar.`:area?`Captura técnica completa para ${area}.`:'Captura técnica completa para áreas operativas.';
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
 if(simple&&!note&&required?.closest('.field')){
  note=document.createElement('p');note.id='ticketEditCaptureModeNote';note.className='definition-note full-width';required.closest('.field').insertAdjacentElement('afterend',note);
 }
 if(note){note.hidden=!simple;if(simple)note.textContent='Este ticket usa captura simplificada: solo se requiere describir qué se necesita realizar.';}
 const summary=$('ticketEditsummary');
 if(simple&&summary){const summaryText=required?.value?.trim()||summary.textContent;if(summaryText&&summary.textContent!==summaryText)summary.textContent=summaryText;}
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
 ensureTicketResolutionField('newTicket','');
 applyNewTicketCaptureMode();attachRewriteButtons(form);autoSuggestTitle('newTicket');
}
function enhanceNewTask(){
 const form=$('newTaskForm');if(!form||!$('newTaskDialog')?.open)return;
 ensureActivityOperationalFields('newTask',{});
}
async function loadTicketOperationalExtras(ticketId){
 const save=document.querySelector('#detailContent [data-action="save-ticket-update"]');if(!ticketId||!save||save.dataset.operationalExtras==='loading'||save.dataset.operationalExtras==='loaded')return;
 save.dataset.operationalExtras='loading';
 try{
  const [tickets,tasks]=await Promise.all([
   supabaseGet(`/rest/v1/tickets?select=id,folio,opened_at,due_at,resolved_at,folder_url&id=eq.${encodeURIComponent(ticketId)}&limit=1`),
   supabaseGet(`/rest/v1/tasks?select=id,task_code,title,task_type,evidence_url&ticket_id=eq.${encodeURIComponent(ticketId)}&order=created_at.asc`)
  ]);
  const ticket=tickets?.[0];
  if(ticket){
   const input=$('ticketEditResolvedAt');if(input)input.value=dateOnly(ticket.resolved_at);
   syncTicketResolutionField('ticketEdit',false);
   renderTicketEvidenceSection(ticket,tasks||[]);
  }
  save.dataset.operationalExtras='loaded';
 }catch{save.dataset.operationalExtras='error';}
}
function renderTicketEvidenceSection(ticket,tasks){
 const existing=$('ticketEvidenceSection');if(existing)existing.remove();
 const links=[];
 if(ticket.folder_url&&safeEvidenceUrl(ticket.folder_url))links.push(evidenceButton(ticket.folder_url,'Carpeta general del ticket'));
 for(const task of tasks){if(task.evidence_url&&safeEvidenceUrl(task.evidence_url))links.push(evidenceButton(task.evidence_url,task.task_type||task.title||task.task_code||'Evidencias de actividad'));}
 const activities=[...document.querySelectorAll('#detailContent .detail-section')].find(section=>section.querySelector('h3')?.textContent?.startsWith('Actividades del ticket'));
 if(!activities)return;
 const section=document.createElement('section');section.id='ticketEvidenceSection';section.className='detail-section sudmar-ticket-evidence';
 section.innerHTML=`<h3>📎 Evidencias del servicio</h3>${links.length?`<div class="sudmar-evidence-links">${links.join('')}</div>`:'<p class="definition-note">Aún no hay carpetas de evidencias vinculadas a las actividades de este ticket.</p>'}`;
 activities.insertAdjacentElement('afterend',section);
}
function enhanceTicketDetail(){
 const folio=$('ticketEditfolio');if(!folio||!$('detailDialog')?.open)return;
 if(!$('ticketEditTitleField')){
  const current=document.querySelector('#detailContent .detail-heading-title h3')?.textContent?.trim()||'';
  folio.closest('.field')?.insertAdjacentHTML('afterend',titleFieldHtml('ticketEdit',current));
  const input=$('ticketEditTitleInput');if(input)input.dataset.userEdited='1';
 }
 ensureTicketResolutionField('ticketEdit','');
 applyTicketEditCaptureMode();attachRewriteButtons($('detailContent'));
 const save=document.querySelector('#detailContent [data-action="save-ticket-update"]');if(save)loadTicketOperationalExtras(save.dataset.id);
}
async function enhanceActivityDetail(){
 const status=$('taskEditstatus'),save=document.querySelector('#detailContent [data-action="save-task-update"]');if(!status||!save||!$('detailDialog')?.open)return;
 ensureActivityOperationalFields('taskEdit',{});
 if(save.dataset.operationalExtras==='loading'||save.dataset.operationalExtras==='loaded')return;
 save.dataset.operationalExtras='loading';
 try{
  const rows=await supabaseGet(`/rest/v1/tasks?select=id,completed_at,evidence_url&id=eq.${encodeURIComponent(save.dataset.id)}&limit=1`);const task=rows?.[0];
  if(task){$('taskEditCompletedAt').value=dateOnly(task.completed_at);$('taskEditEvidenceUrl').value=task.evidence_url||'';updateActivityEvidenceButton('taskEdit');await syncActivityCompletionField('taskEdit',false);}
  save.dataset.operationalExtras='loaded';
 }catch{save.dataset.operationalExtras='error';}
}
function enhanceDetail(){enhanceTicketDetail();enhanceActivityDetail();}

async function syncNewTicketOwner(){
 if(!personnel.length)await peoplePromise;
 const owner=$('newTicketowner')?.value||'';const person=getPerson(owner);const area=$('newTicketarea');
 if(area&&person){const preferred=person.area||person.operationalAreas?.[0]||'';if([...area.options||[]].some(option=>option.value===preferred))area.value=preferred;}
 else if(area&&!owner)area.value='';
 applyNewTicketCaptureMode();
}

const originalTicketBody=repository.ticketBody.bind(repository);
repository.ticketBody=async function(payload,creating=false){
 const body=await originalTicketBody(payload,creating);
 if(payload.title!==undefined){const title=normalizeTitle(payload.title);if(title)body.title=title.slice(0,180);}
 if(payload.resolvedAt!==undefined)body.resolved_at=payload.resolvedAt||null;
 return body;
};
const originalCreateTicket=repository.createTicket.bind(repository);
repository.createTicket=async function(payload){
 const title=normalizeTitle($('newTicketTitleInput')?.value),resolvedAt=$('newTicketResolvedAt')?.value||'';
 return originalCreateTicket({...payload,...(title?{title}:{}),resolvedAt});
};
const originalUpdateTicket=repository.updateTicket.bind(repository);
repository.updateTicket=async function(id,changes){
 const title=normalizeTitle($('ticketEditTitleInput')?.value),resolvedAt=$('ticketEditResolvedAt')?.value||'';
 return originalUpdateTicket(id,{...changes,...(title?{title}:{}),resolvedAt});
};
const originalCreateTask=repository.createTask.bind(repository);
repository.createTask=async function(payload){
 const evidenceUrl=normalizeEvidenceUrl($('newTaskEvidenceUrl')?.value||''),completedAt=$('newTaskCompletedAt')?.value||'';
 return originalCreateTask({...payload,evidenceUrl,completedAt});
};
const originalUpdateTask=repository.updateTask.bind(repository);
repository.updateTask=async function(id,changes,expectedUpdatedAt){
 const evidenceUrl=normalizeEvidenceUrl($('taskEditEvidenceUrl')?.value||''),completedAt=$('taskEditCompletedAt')?.value||'';
 return originalUpdateTask(id,{...changes,evidenceUrl,completedAt},expectedUpdatedAt);
};

ensureRewriteDialog();
function queueNewTicketEnhancement(){if(newTicketEnhanceQueued)return;newTicketEnhanceQueued=true;queueMicrotask(()=>{newTicketEnhanceQueued=false;enhanceNewTicket();});}
function queueNewTaskEnhancement(){if(newTaskEnhanceQueued)return;newTaskEnhanceQueued=true;queueMicrotask(()=>{newTaskEnhanceQueued=false;enhanceNewTask();});}
function queueDetailEnhancement(){if(detailEnhanceQueued)return;detailEnhanceQueued=true;queueMicrotask(()=>{detailEnhanceQueued=false;enhanceDetail();});}

document.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.action==='new-ticket')queueNewTicketEnhancement();
 if(button.dataset.action==='new-task')queueNewTaskEnhancement();
 if(button.dataset.action==='ticket'||button.dataset.action==='task')queueDetailEnhancement();
 if(button.dataset.sudmarRewrite){const target=$(button.dataset.sudmarRewrite);if(target)openRewrite(target);}
 if(button.dataset.sudmarRewriteClose!==undefined)$('sudmarRewriteDialog')?.close();
 if(button.dataset.sudmarRewriteMode){await generateRewrite(button.dataset.sudmarRewriteMode,button);}
 if(button.id==='sudmarRewriteAccept'&&rewriteTarget){rewriteTarget.value=$('sudmarRewriteProposal').value;rewriteTarget.dispatchEvent(new Event('input',{bubbles:true}));$('sudmarRewriteDialog').close();}
 if(button.dataset.sudmarTitleSuggest){const prefix=button.dataset.sudmarTitleSuggest;button.disabled=true;try{await generateTitleProposal(prefix,true);}finally{button.disabled=false;}}
 if(button.dataset.sudmarTitleUse){const prefix=button.dataset.sudmarTitleUse,input=$(prefix+'TitleInput'),proposal=$(prefix+'TitleProposal');const text=proposal?.querySelector('span')?.textContent?.trim();if(input&&text){input.value=text;input.dataset.userEdited='1';proposal.hidden=true;}}
});

document.addEventListener('change',event=>{
 if(event.target.id==='newTicketowner')syncNewTicketOwner();
 if(event.target.id==='newTicketarea')applyNewTicketCaptureMode();
 if(event.target.id==='ticketEditowner'||event.target.id==='ticketEditarea')queueDetailEnhancement();
 if(event.target.id==='newTicketstatus')syncTicketResolutionField('newTicket',true);
 if(event.target.id==='ticketEditstatus')syncTicketResolutionField('ticketEdit',true);
 if(event.target.id==='newTaskstatus')syncActivityCompletionField('newTask',true);
 if(event.target.id==='taskEditstatus')syncActivityCompletionField('taskEdit',true);
});

document.addEventListener('input',event=>{
 if(event.target.id==='newTicketTitleInput'||event.target.id==='ticketEditTitleInput')event.target.dataset.userEdited='1';
 if(['newTicketwhat','newTicketwhere','newTicketcondition','newTicketrequired'].includes(event.target.id)){updateSimpleSummary();autoSuggestTitle('newTicket');}
 if(['newTicketopenedAt','newTicketResolvedAt','ticketEditopenedAt','ticketEditResolvedAt'].includes(event.target.id))updateTicketDuration(event.target.id.startsWith('newTicket')?'newTicket':'ticketEdit');
 if(event.target.id==='newTaskEvidenceUrl')updateActivityEvidenceButton('newTask');
 if(event.target.id==='taskEditEvidenceUrl')updateActivityEvidenceButton('taskEdit');
});

const dialogObserver=new MutationObserver(()=>{
 if($('newTicketDialog')?.open)queueNewTicketEnhancement();
 if($('newTaskDialog')?.open)queueNewTaskEnhancement();
 if($('detailDialog')?.open)queueDetailEnhancement();
});
dialogObserver.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});

const detailContent=$('detailContent');
if(detailContent){const detailObserver=new MutationObserver(()=>{if($('detailDialog')?.open)queueDetailEnhancement();});detailObserver.observe(detailContent,{childList:true});}
