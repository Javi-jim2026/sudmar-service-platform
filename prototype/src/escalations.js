import {config} from './config.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=config.supabase.url+'/rest/v1/';
const headers={'apikey':config.supabase.publishableKey,'Authorization':'Bearer '+config.supabase.publishableKey,'Content-Type':'application/json'};
const active=x=>!['atendido','resuelto'].includes(x.status);
let records=[],loaded=false,currentTicket=null,clock=null,busy=false,lastRefresh=0;
async function request(path,options={}){
 const r=await fetch(api+path,{...options,headers:{...headers,...options.headers}});
 if(!r.ok){let msg=await r.text();throw Error('Supabase: '+r.status+' '+msg.slice(0,180));}
 return r.status===204?null:await r.json();
}
async function refresh(){
 const list=await request('ticket_escalations?select=*&order=created_at.desc&limit=5000');
 records=list;loaded=true;lastRefresh=Date.now();updateDisplay();
}
const forTicket=id=>records.filter(x=>x.ticket_id===id);
const stats=id=>{const a=forTicket(id);return {all:a,open:a.filter(active),exec:a.filter(x=>active(x)&&x.level==='ejecutivo')};};
const elapsed=date=>{const seconds=Math.max(0,Math.floor((Date.now()-new Date(date).getTime())/1000));const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':');};
function ticketId(){return document.querySelector('#detailContent [data-action="save-ticket-update"]')?.dataset.id||null;}
function banner(){
 const id=ticketId();if(!id)return;
 currentTicket=id;
 const root=document.getElementById('detailContent'),heading=root?.querySelector('.detail-heading-title'),holder=root?.querySelector('.ticket-header-summary')||heading;
 if(!holder)return;
 const s=stats(id);
 const signature=JSON.stringify(s.all.map(x=>[x.id,x.status,x.updated_at]));
 root.classList.toggle('esc-ticket-critical',s.exec.length>0);
 root.classList.toggle('esc-ticket-operational',s.exec.length===0&&s.open.length>0);
 let panel=root.querySelector('#escalationTicketPanel');
 if(!panel){panel=document.createElement('section');panel.id='escalationTicketPanel';panel.className='esc-panel';heading?.insertAdjacentElement('afterend',panel);}
 if(panel.dataset.signature===signature)return;
 panel.dataset.signature=signature;
 panel.innerHTML='<div class="esc-panel-header"><strong>🚨 Control de escalamientos</strong><button type="button" class="button secondary" data-esc="create" data-ticket="'+esc(id)+'">+ Escalamiento</button></div>'+
 (s.exec.length?'<div class="esc-critical-banner"><span class="esc-beacon" aria-hidden="true"></span><strong>ALERTA EJECUTIVA ACTIVA</strong><span class="esc-clock" data-start="'+esc(s.exec[0].created_at)+'">'+elapsed(s.exec[0].created_at)+'</span></div>':s.open.length?'<div class="esc-operational-banner">⚠ Escalamiento operativo activo</div>':'')+
 '<div class="esc-counts">'+s.all.length+' alertas históricas · '+s.open.length+' activas'+(s.all.length>1?' · Reincidencia '+(s.all.length-1):'')+'</div>'+
 (s.all.length?'<details><summary>Historial de escalamientos ('+s.all.length+')</summary><div class="esc-history">'+s.all.map(x=>'<article><div><strong>'+esc(x.level==='ejecutivo'?'🔴 Ejecutivo':'🟠 Operativo')+'</strong> · '+esc(x.reason)+' · <b>'+esc(x.status)+'</b></div><small>'+new Date(x.created_at).toLocaleString('es-MX')+' · '+esc(x.raised_by)+' · Responsable: '+esc(x.assigned_to)+'</small><p>'+esc(x.action_required)+'</p><div class="esc-history-actions">'+(active(x)?'<button type="button" class="button secondary" data-esc="accept" data-id="'+esc(x.id)+'">Tomar atención</button><button type="button" class="button secondary" data-esc="follow" data-id="'+esc(x.id)+'">Registrar seguimiento</button><button type="button" class="button secondary" data-esc="close" data-id="'+esc(x.id)+'">Marcar atendido</button>':'')+'<button type="button" class="button secondary" data-esc="events" data-id="'+esc(x.id)+'">Ver bitácora</button></div></article>').join('')+'</div></details>':'<p class="esc-muted">Sin escalamientos registrados.</p>');
}
function ticketsList(){
 const root=document.getElementById('content');
 if(!root||!document.querySelector('[data-action="ticket"]')||document.querySelector('#ticketEditfolio'))return;
 const ticketList=root.querySelector('.list-toolbar');
 if(ticketList&&!ticketList.querySelector('#escTicketFilter')){
  const label=document.createElement('label');label.className='esc-filter';label.innerHTML='Escalamientos <select id="escTicketFilter"><option value="all">Todos</option><option value="active">Con escalamiento activo</option><option value="executive">Ejecutivos activos</option><option value="operative">Operativos activos</option><option value="history">Con historial</option><option value="repeat">Reincidentes (2+)</option><option value="none">Sin escalamientos</option></select>';ticketList.append(label);
  label.querySelector('select').value=sessionStorage.getItem('esc.filter')||'all';
 }
 const mode=root.querySelector('#escTicketFilter')?.value||'all';
 const shouldShow=s=>mode==='all'||(mode==='active'&&s.open.length>0)||(mode==='executive'&&s.exec.length>0)||(mode==='operative'&&s.open.some(x=>x.level==='operativo'))||(mode==='history'&&s.all.length>0)||(mode==='repeat'&&s.all.length>=2)||(mode==='none'&&s.all.length===0);
 root.querySelectorAll('.ticket-table tbody tr,.mobile-ticket-list .mobile-ticket').forEach(row=>{
  const id=row.querySelector('[data-action="ticket"]')?.dataset.id||row.dataset.id;
  if(!id)return;
  const s=stats(id);
  row.classList.toggle('esc-row-critical',s.exec.length>0);
  row.classList.toggle('esc-row-operational',s.exec.length===0&&s.open.length>0);
  const hide=!shouldShow(s);if(row.hidden!==hide)row.hidden=hide;
  let mark=row.querySelector('.esc-row-marker');
  if(s.all.length){if(!mark){mark=document.createElement('span');mark.className='esc-row-marker';(row.querySelector('.ticket-title .folio,.mobile-ticket-top .folio')||row.querySelector('td')||row).append(mark);}const label=' ⚑ '+s.all.length;if(mark.textContent!==label)mark.textContent=label;mark.title=s.open.length+' alertas activas · '+s.all.length+' históricas';}
  else mark?.remove();
 });
 let note=root.querySelector('#escFilterNotice');
 if(ticketList&&!note){note=document.createElement('small');note.id='escFilterNotice';note.className='esc-muted';ticketList.append(note);}
 if(note){const msg=mode==='all'?'':'Filtro aplicado a tickets cargados en esta página; no modifica los demás filtros ni el total del listado.';if(note.textContent!==msg)note.textContent=msg;}
}
function updateDisplay(){if(document.getElementById('detailDialog')?.open)banner();if(location.search.includes('view=tickets'))ticketsList();}
function tick(){document.querySelectorAll('.esc-clock[data-start]').forEach(el=>el.textContent=elapsed(el.dataset.start));}
function dialog(html){const d=document.createElement('dialog');d.className='esc-dialog';d.innerHTML=html;document.body.append(d);d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();return d;}
function create(id){
 const folio=document.querySelector('#detailTitle')?.textContent||'Ticket';
 const client=document.querySelector('#ticketEditclient')?.value||[...document.querySelectorAll('.ticket-header-fact')].find(x=>/cliente/i.test(x.textContent))?.querySelector('strong')?.textContent||'Cliente en ticket';
 const company=document.querySelector('#ticketEditbusinessUnit')?.value||'';
 const existing=stats(id).open;
 const registrars=['Saúl González','Rodolfo Martínez','Javier Jiménez','Dulce Flores','Enrique González'];
 const assignees=['Javier Jiménez','Daniel Hernández','Enrique González'];
 const nameOptions=names=>names.map(name=>'<option value="'+esc(name)+'">'+esc(name)+'</option>').join('');
 const levelHelp='<div class="esc-level-help" id="escLevelHelp" hidden><p><strong>🟠 Operativo · Atención prioritaria:</strong> situación que requiere coordinación adicional o desbloqueo dentro del equipo operativo, antes de convertirse en una crisis. Ejemplos: refacción urgente, programación en riesgo o impedimento para continuar un servicio.</p><p><strong>🔴 Ejecutivo · Atención crítica inmediata:</strong> situación excepcional con impacto grave para un cliente, un compromiso o el negocio. Ejemplos: cliente muy inconforme, amenaza de cancelación, intervención extraordinaria de dirección o generador crítico fuera de operación.</p><small>El nivel se determina por el impacto y la urgencia, no por el puesto de quien registra. Es independiente del SLA técnico.</small></div>';
 const d=dialog('<form class="esc-form"><h2>Registrar escalamiento</h2><p><b>'+esc(folio)+'</b> · '+esc(client)+' · '+esc(company)+'</p>'+(existing.length?'<p class="esc-warning">⚠ Este ticket ya tiene '+existing.length+' escalamiento(s) activo(s). Actualiza el existente si es la misma situación.</p>':'')+'<div class="esc-level-field"><div class="esc-level-heading"><span>Nivel de escalamiento</span><button type="button" class="esc-help-toggle" aria-label="Información sobre niveles de escalamiento" aria-expanded="false" aria-controls="escLevelHelp" title="¿Qué significa cada nivel?">ⓘ</button></div><select name="level" aria-label="Nivel de escalamiento"><option value="ejecutivo">Ejecutivo — Atención crítica inmediata</option><option value="operativo">Operativo — Atención prioritaria</option></select>'+levelHelp+'</div><label>Motivo<select name="reason"><option value="cliente">Cliente inconforme</option><option value="sin_respuesta">Falta de respuesta</option><option value="incumplimiento">Incumplimiento</option><option value="paro">Riesgo de paro</option><option value="direccion">Solicitud de dirección</option><option value="otro">Otro</option></select></label><label>Descripción<textarea name="description" rows="2" maxlength="3000"></textarea></label><label>Acción requerida<textarea name="action_required" required minlength="5" maxlength="3000" rows="3"></textarea></label><label>Registrado por<select name="raised_by" required><option value="">Seleccionar persona</option>'+nameOptions(registrars)+'</select></label><label>Asignado a<select name="assigned_to" required><option value="">Seleccionar responsable</option>'+nameOptions(assignees)+'</select></label><label>Compromiso de respuesta<input type="datetime-local" name="due"></label><p class="esc-error" role="alert"></p><div class="esc-actions"><button type="button" class="button secondary" data-esc-dismiss>Cancelar</button><button class="button primary" type="submit">Guardar escalamiento</button></div></form>');
 d.querySelector('[data-esc-dismiss]').onclick=()=>d.close();
 const help=d.querySelector('#escLevelHelp'),toggle=d.querySelector('.esc-help-toggle');
 const closeHelp=()=>{help.hidden=true;toggle.setAttribute('aria-expanded','false');};
 toggle.addEventListener('click',()=>{help.hidden=!help.hidden;toggle.setAttribute('aria-expanded',String(!help.hidden));});
 d.addEventListener('click',ev=>{if(!help.hidden&&!ev.target.closest('.esc-level-help,.esc-help-toggle'))closeHelp();});
 d.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!help.hidden){ev.preventDefault();ev.stopImmediatePropagation();closeHelp();toggle.focus();}},true);
 d.querySelector('form').onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget),submit=d.querySelector('[type="submit"]');submit.disabled=true;
 try{
  const inserted=await request('ticket_escalations?select=*',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({ticket_id:id,level:f.get('level'),reason:f.get('reason'),description:String(f.get('description')).trim(),action_required:String(f.get('action_required')).trim(),raised_by:String(f.get('raised_by')).trim(),assigned_to:String(f.get('assigned_to')).trim(),response_due_at:f.get('due')?new Date(f.get('due')).toISOString():null})});
  await event(inserted[0].id,'creado',String(f.get('raised_by')),'Alerta registrada');
  d.close();await refresh();
 }catch(err){d.querySelector('.esc-error').textContent=err.message;submit.disabled=false;}
 };
}
async function event(id,type,actor,note){await request('ticket_escalation_events',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({escalation_id:id,event_type:type,actor,note})});}
async function process(id,action){
 const x=records.find(y=>y.id===id);if(!x)return;
 if(action==='events'){
  try{const list=await request('ticket_escalation_events?escalation_id=eq.'+encodeURIComponent(id)+'&select=*&order=occurred_at.asc');const d=dialog('<div class="esc-form"><h2>Bitácora de escalamiento</h2>'+list.map(y=>'<p><b>'+esc(y.event_type)+'</b> · '+esc(y.actor)+'<br><small>'+new Date(y.occurred_at).toLocaleString('es-MX')+'</small><br>'+esc(y.note)+'</p>').join('')+'<button class="button secondary" data-esc-dismiss>Cerrar</button></div>');d.querySelector('[data-esc-dismiss]').onclick=()=>d.close();}catch(e){alert(e.message);}return;
 }
 const label=action==='accept'?'Tomar atención':action==='follow'?'Registrar seguimiento':'Marcar atendido';
 const d=dialog('<form class="esc-form"><h2>'+label+'</h2><p>'+esc(x.action_required)+'</p><label>Nombre de quien registra<input name="actor" required maxlength="120" value="'+esc(action==='accept'?x.assigned_to:'')+'"></label><label>Acción realizada / observaciones<textarea name="note" rows="3" required minlength="5" maxlength="3000"></textarea></label><p class="esc-error" role="alert"></p><div class="esc-actions"><button type="button" class="button secondary" data-esc-dismiss>Cancelar</button><button type="submit" class="button primary">Guardar</button></div></form>');d.querySelector('[data-esc-dismiss]').onclick=()=>d.close();
 d.querySelector('form').onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget),actor=String(f.get('actor')).trim(),note=String(f.get('note')).trim(),button=d.querySelector('[type="submit"]');button.disabled=true;
 try{
  const now=new Date().toISOString(),changes=action==='accept'?{status:'en_atencion',accepted_at:x.accepted_at||now,first_response_at:x.first_response_at||now}:action==='close'?{status:'atendido',first_response_at:x.first_response_at||now,resolved_at:now,resolution_note:note}:{first_response_at:x.first_response_at||now,status:'en_atencion'};
  await request('ticket_escalations?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({...changes,updated_at:now})});
  await event(id,action==='accept'?'aceptado':action==='close'?'atendido':'seguimiento',actor,note);
  d.close();await refresh();
 }catch(err){d.querySelector('.esc-error').textContent=err.message;button.disabled=false;}
 };
}
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-esc]');if(!b)return;ev.preventDefault();if(b.dataset.esc==='create')create(b.dataset.ticket);else process(b.dataset.id,b.dataset.esc);});
document.addEventListener('change',ev=>{if(ev.target.id==='escTicketFilter'){sessionStorage.setItem('esc.filter',ev.target.value);ticketsList();}});
let scheduled=false;
const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;updateDisplay();});});
observer.observe(document.getElementById('detailContent')||document.body,{childList:true,subtree:true});
const listObserver=new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;updateDisplay();});});
listObserver.observe(document.getElementById('content')||document.body,{childList:true,subtree:true});
setInterval(tick,1000);
setInterval(()=>{if(!document.hidden)refresh().catch(console.warn);},30000);
refresh().catch(err=>console.warn('No se pudieron cargar escalamientos',err));
