import {repository} from './repository.js';
import {config} from './config.js';
/* Operations KPI prototype. Until staff authentication is installed,
   peer reviews, daily journals and incidents stay on THIS browser only.
   Never claim these are verified attendance or protected evaluations. */
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names=['Javier Jimenez','Daniel Hernandez','Enrique Gonzalez','Hernan Reyes'];
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:config.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const key='sudmar-operations-pilot-v1';
const dateParts=s=>new Date(s+'T12:00:00');
const localDay=value=>new Intl.DateTimeFormat('en-CA',{timeZone:config.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const weekStart=s=>{const d=dateParts(s||today());d.setDate(d.getDate()-((d.getDay()+6)%7));return iso(d);};
const plusDays=(s,n)=>{const d=dateParts(s);d.setDate(d.getDate()+n);return iso(d);};
const range=(s)=>[s,plusDays(s,6)];
const num=(value)=>Number(value)||0;
const unique=arr=>[...new Set(arr.filter(Boolean))];
function getLocal(){try{const v=JSON.parse(localStorage.getItem(key)||'{}');return {reports:v.reports||{},reviews:v.reviews||{},events:v.events||[],absences:v.absences||{}};}catch{return {reports:{},reviews:{},events:[],absences:{}};}}
function setLocal(v){try{localStorage.setItem(key,JSON.stringify(v));return true;}catch{alert('Este navegador no permitió guardar el registro local. Comprueba el espacio disponible.');return false;}}
const storageKey=(person,date)=>person+'|'+date;
const palette={
 'REGISTRADO':['#64748b','#f1f5f9'],'POR INICIAR':['#64748b','#f1f5f9'],'PROGRAMADA':['#2563eb','#eff6ff'],'PROGRAMADO':['#2563eb','#eff6ff'],
 'EN EJECUCIÓN':['#7c3aed','#f5f3ff'],'EN ESPERA':['#a16207','#fef9c3'],'BLOQUEADO':['#b91c1c','#fef2f2'],'BLOQUEADA':['#b91c1c','#fef2f2'],
 'PENDIENTE DE VALIDACIÓN':['#0891b2','#ecfeff'],'CONCLUIDO':['#15803d','#f0fdf4'],'COMPLETADA':['#15803d','#f0fdf4'],'CANCELADO':['#475569','#f1f5f9'],'CANCELADA':['#475569','#f1f5f9'],
 '1':['#b91c1c','#fef2f2'],'2':['#c2410c','#fff7ed'],'3':['#0369a1','#f0f9ff'],'4':['#475569','#f1f5f9']
};
function paintOption(value,priority=false){const x=palette[value]||['#64748b','#f1f5f9'];return '<span class="ops-color-dot" style="background:'+x[0]+'"></span><span>'+esc(priority?'SLA-0'+value:value)+'</span>';}
let popup=null;
function closePopup(){popup?.remove();popup=null;}
function attachPickers(root=document){
 for(const id of ['newTicketstatus','ticketEditstatus','newTaskstatus','taskEditstatus','newTicketpriority','ticketEditpriority','newTaskpriority','taskEditpriority']){
  const select=root.querySelector('#'+id);
  if(!select||select.dataset.opsPicker==='1')continue;
  select.dataset.opsPicker='1';select.classList.add('ops-original-select');
  const priority=id.endsWith('priority'),control=document.createElement('button');
  control.type='button';control.className='ops-picker';control.setAttribute('aria-label',priority?'Seleccionar SLA técnico':'Seleccionar estado');
  control.setAttribute('aria-haspopup','listbox');control.setAttribute('aria-expanded','false');
  const refresh=()=>{const v=select.value,p=palette[v]||['#64748b','#f1f5f9'];control.style.setProperty('--status-color',p[0]);control.style.setProperty('--status-bg',p[1]);control.innerHTML=paintOption(v,priority)+'<span aria-hidden="true" class="ops-picker-arrow">▾</span>';};
  refresh();select.addEventListener('change',refresh);
  select.insertAdjacentElement('afterend',control);
  control.addEventListener('click',()=>{
   if(popup?.dataset.for===id){closePopup();return;}closePopup();
   const panel=document.createElement('div');panel.className='ops-picker-popup';panel.dataset.for=id;panel.setAttribute('role','listbox');panel.setAttribute('aria-label',control.getAttribute('aria-label'));
   for(const option of [...select.options]){
    if(!option.value||option.disabled)continue;
    const b=document.createElement('button');b.type='button';b.className='ops-picker-option';b.setAttribute('role','option');b.setAttribute('aria-selected',String(option.selected));const p=palette[option.value]||['#64748b','#f1f5f9'];
    b.style.setProperty('--status-color',p[0]);b.style.setProperty('--status-bg',p[1]);
    b.innerHTML=paintOption(option.value,priority);b.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));closePopup();control.focus();});panel.append(b);
   }
   const r=control.getBoundingClientRect();panel.style.position='fixed';panel.style.top=Math.min(r.bottom+4,innerHeight-300)+'px';panel.style.left=Math.max(8,Math.min(r.left,innerWidth-300))+'px';panel.style.width=Math.max(220,r.width)+'px';(control.closest('dialog')||document.body).append(panel);popup=panel;control.setAttribute('aria-expanded','true');
  });
 }
}
document.addEventListener('click',event=>{if(popup&&!event.target.closest('.ops-picker-popup,.ops-picker'))closePopup();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closePopup();});
document.addEventListener('scroll',()=>closePopup(),true);
function ensurePickers(){
 for(const id of ['newTicketDialog','newTaskDialog','detailDialog']){const root=$(id);if(root?.open)attachPickers(root);}
}
const pickObserver=new MutationObserver(ensurePickers);
for(const id of ['newTicketDialog','newTaskDialog','detailDialog']){const root=$(id);if(root)pickObserver.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});}
let currentView='',cached=null,lastFetched=0,selectedPerson='Javier Jimenez',selectedDate=today(),draft=[],reviewWeek=weekStart(today());
async function data(force=false){if(!force&&cached&&Date.now()-lastFetched<30000)return cached;const [d,p]=await Promise.all([repository.loadSupabase(),repository.personnel()]);cached={tickets:d.tickets,tasks:d.tasks,people:p.filter(x=>names.includes(x.name))};lastFetched=Date.now();return cached;}
function peopleOptions(selected){return names.map(n=>'<option value="'+esc(n)+'" '+(n===selected?'selected':'')+'>'+esc(n)+'</option>').join('');}
const completed=t=>t.status==='COMPLETADA'||(t.statusGroup==='CERRADA'&&!t.isCancelled);
const cancelled=t=>t.status==='CANCELADA'||t.isCancelled;
function taskWeek(tasks,person,start){const [a,b]=range(start);return tasks.filter(t=>t.owner===person&&t.startAt<=b&&((t.completedAt||t.dueAt||b)>=a||!completed(t)&&!cancelled(t)));}
function entriesInWeek(store,person,start){const [a,b]=range(start);return Object.entries(store.reports).filter(([k,r])=>k.startsWith(person+'|')&&r.date>=a&&r.date<=b);}
function absent(store,person,date){return store.absences[storageKey(person,date)]||'';}
function compliance(store,person,start){const dates=Array.from({length:7},(_,i)=>plusDays(start,i)).filter((d,i)=>i<5&&d<today()&&!absent(store,person,d));const done=dates.filter(d=>Boolean(store.reports[storageKey(person,d)]));const late=done.filter(d=>localDay(store.reports[storageKey(person,d)].submittedAt)>d).length;return {required:dates.length,done:done.length,late,missed:dates.length-done.length};}
function totals(store,person,start,tasks){
 const active=taskWeek(tasks,person,start);
 const docs=entriesInWeek(store,person,start).flatMap(([,r])=>r.items||[]);
 const idle=docs.reduce((v,x)=>v+num(x.wait),0)+store.events.filter(x=>x.person===person&&x.date>=start&&x.date<=plusDays(start,6)).reduce((v,x)=>v+num(x.minutes),0);
 const work=docs.reduce((v,x)=>v+num(x.minutes),0);
 const finished=active.filter(t=>completed(t)&&t.completedAt>=start&&t.completedAt<=plusDays(start,6)).length;
 const overdue=active.filter(t=>t.dueAt&&t.dueAt<today()&&!completed(t)&&!cancelled(t)).length;
 return {assigned:active.length,finished,overdue,working:active.filter(t=>!completed(t)&&!cancelled(t)).length,work,idle,docs:compliance(store,person,start),tasks:active};
}
function metric(value,label,tone=''){return '<article class="ops-metric '+esc(tone)+'"><strong>'+esc(value)+'</strong><span>'+esc(label)+'</span></article>';}
function shortTask(t){return '<div class="ops-task-line"><span><b>#'+esc(t.ticketFolio)+'</b> · '+esc(t.taskType||t.title)+'<small>'+esc(t.owner)+' · '+esc(t.dueAt||'Sin fecha objetivo')+'</small></span><span class="ops-small-pill" style="--status-color:'+(palette[t.status]?.[0]||'#64748b')+';--status-bg:'+(palette[t.status]?.[1]||'#f1f5f9')+'">'+esc(t.status)+'</span></div>';}
function panelBanner(){return '<p class="ops-demo-notice">🧪 Etapa de desarrollo: reportes, incidencias y evaluaciones se guardan <b>solo en este navegador</b>. La selección de nombre no verifica identidad. No usar estas calificaciones para sanciones ni control oficial de asistencia.</p>';}
function buttonNav(label,view){return '<button type="button" data-ops-view="'+view+'" class="ops-nav-button" '+(view===currentView?'aria-current="page"':'')+'><span>▣</span> '+label+'</button>';}
function installNav(){for(const id of ['desktopNav','mobileNav']){const node=$(id);if(!node||node.querySelector('[data-ops-view="kpis"]'))continue;node.insertAdjacentHTML('beforeend',buttonNav('KPI Operaciones','kpis')+buttonNav('Mi jornada','daily')+buttonNav('Evaluación semanal','review'));}}
let navLock=false;const navObserver=new MutationObserver(()=>{if(navLock)return;navLock=true;installNav();navLock=false;});
for(const id of ['desktopNav','mobileNav']){if($(id))navObserver.observe($(id),{childList:true});}installNav();
document.addEventListener('click',ev=>{if(ev.target.closest('[data-action="navigate"]'))currentView='';},true);
async function openView(view){currentView=view;installNav();$('pageTitle').textContent={kpis:'KPI de Operaciones',daily:'Mi jornada',review:'Evaluación semanal 360°'}[view];$('pageSubtitle').textContent='Desempeño, seguimiento y registros individuales · piloto de desarrollo';$('breadcrumbTitle').textContent='Operaciones';document.querySelectorAll('[data-ops-view]').forEach(b=>b.classList.toggle('active',b.dataset.opsView===view));$('content').innerHTML='<div class="ops-loading">Consultando actividades y tickets…</div>';try{const d=await data();if(currentView!==view)return;if(view==='kpis')renderKpis(d);if(view==='daily')renderDaily(d);if(view==='review')renderReview(d);}catch(e){$('content').innerHTML='<p class="form-error">No se pudieron cargar los datos operativos: '+esc(e.message)+'</p>';}}
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-ops-view]');if(b)openView(b.dataset.opsView);});
function renderKpis(d){
 const store=getLocal(),week=reviewWeek,rows=names.map(name=>({name,...totals(store,name,week,d.tasks)}));
 const person=selectedPerson,detail=rows.find(x=>x.name===person)||rows[0];
 const all=rows.reduce((acc,r)=>{for(const f of ['assigned','finished','overdue','work','idle'])acc[f]+=r[f];acc.missed+=r.docs.missed;return acc;},{assigned:0,finished:0,overdue:0,work:0,idle:0,missed:0});
 $('content').innerHTML='<section class="ops-main">'+panelBanner()+'<div class="ops-head"><div><h2>Indicadores semanales</h2><p>Semana del '+esc(week)+' al '+esc(plusDays(week,6))+'</p></div><label>Semana <input id="opsWeek" type="date" value="'+esc(week)+'"></label></div><div class="ops-metrics">'+metric(all.assigned,'Actividades en seguimiento')+metric(all.finished,'Terminadas','good')+metric(all.overdue,'Vencidas','bad')+metric((all.idle/60).toFixed(1)+' h','Espera/incidencias','warn')+metric(all.missed,'Reportes no entregados','bad')+'</div><div class="ops-card"><h3>Desempeño por integrante</h3><div class="ops-scroll"><table class="ops-table"><thead><tr><th>Personal</th><th>Asignadas</th><th>Terminadas</th><th>Vencidas</th><th>Horas registradas</th><th>Sin reporte</th></tr></thead><tbody>'+rows.map(r=>'<tr><td><button type="button" data-ops-person="'+esc(r.name)+'"><b>'+esc(r.name)+'</b></button></td><td>'+r.assigned+'</td><td>'+r.finished+'</td><td>'+r.overdue+'</td><td>'+(r.work/60).toFixed(1)+'</td><td class="'+(r.docs.missed?'ops-negative':'')+'">'+r.docs.missed+'</td></tr>').join('')+'</tbody></table></div><p class="ops-footnote">Las asignaciones incluyen actividades en seguimiento durante la semana. Las horas proceden únicamente de reportes locales. Sin reporte no implica ausencia física.</p></div><div class="ops-card"><h3>Detalle individual</h3><label>Seleccionar persona <select id="opsKpiPerson">'+peopleOptions(person)+'</select></label><div class="ops-metrics">'+metric(detail.assigned,'Actividades asignadas')+metric(detail.finished,'Terminadas','good')+metric(detail.working,'En curso')+metric(detail.docs.missed,'Incumplimientos de reporte','bad')+metric(detail.docs.late,'Entregas tardías','warn')+'</div><h4>Actividades vinculadas</h4>'+(detail.tasks.map(shortTask).join('')||'<p class="ops-footnote">Sin actividades vinculadas para el periodo.</p>')+'</div></section>';
 $('opsWeek').addEventListener('change',ev=>{reviewWeek=weekStart(ev.target.value||today());renderKpis(d);});$('opsKpiPerson').addEventListener('change',ev=>{selectedPerson=ev.target.value;renderKpis(d);});
 $('content').querySelectorAll('[data-ops-person]').forEach(b=>b.addEventListener('click',()=>{selectedPerson=b.dataset.opsPerson;renderKpis(d);}));
}
function loadDraft(){draft=(getLocal().reports[storageKey(selectedPerson,selectedDate)]?.items||[]).map(x=>({...x}));}
function reportTaskOptions(d){const tasks=d.tasks.filter(t=>t.owner===selectedPerson).sort((a,b)=>String(b.startAt).localeCompare(a.startAt));return '<option value="">Trabajo interno / sin actividad vinculada</option>'+tasks.map(t=>'<option value="'+esc(t.id)+'">'+esc('#'+t.ticketFolio+' · '+(t.taskType||t.title))+'</option>').join('');}
const categories=['Servicio en campo','Diagnóstico / reparación','Almacén y refacciones','Trabajo en taller','Coordinación y seguimiento','Documentación y reportes','Capacitación / apoyo','Sin actividad asignada'];
const reasons=['','Refacciones / materiales','Cliente / acceso','Autorización / información','Falta de herramientas','Reasignación de prioridad','Falta de conocimientos','Error / retrabajo','Inasistencia / personal','Otro'];
function choices(values,selected){return values.map(v=>'<option value="'+esc(v)+'" '+(v===selected?'selected':'')+'>'+esc(v||'Sin espera')+'</option>').join('');}
function renderDaily(d){
 const report=getLocal().reports[storageKey(selectedPerson,selectedDate)];
 $('content').innerHTML='<section class="ops-main">'+panelBanner()+'<div class="ops-head"><div><h2>Mi jornada</h2><p>Agrega registros breves por actividad y entrega un solo reporte al final del turno.</p></div></div><div class="ops-card"><div class="ops-form-grid"><label>Personal<select id="opsDailyPerson">'+peopleOptions(selectedPerson)+'</select></label><label>Fecha de jornada<input id="opsDailyDate" type="date" value="'+esc(selectedDate)+'" max="'+today()+'"></label></div><p class="ops-footnote">'+(report?'✅ Reporte enviado anteriormente. Puedes corregirlo en este navegador; la fecha original de envío permanecerá visible.':'Pendiente de entregar al final del turno.')+'</p><form id="opsEntryForm"><div class="ops-form-grid"><label>Actividad asignada<select id="opsEntryTask">'+reportTaskOptions(d)+'</select></label><label>Tipo de trabajo<select id="opsEntryCategory">'+choices(categories,'Servicio en campo')+'</select></label></div><label>¿Qué hiciste? (1–2 renglones)<textarea id="opsEntrySummary" rows="2" required minlength="5" maxlength="700" placeholder="Ej. Inspeccioné conexiones, realicé diagnóstico y pruebas de arranque."></textarea></label><div class="ops-form-grid"><label>Tiempo de trabajo (minutos)<input id="opsEntryMinutes" type="number" min="0" max="1440" step="15" value="60" required></label><label>Tiempo de espera (minutos)<input id="opsEntryWait" type="number" min="0" max="1440" step="15" value="0" required></label></div><div class="ops-form-grid"><label>Motivo de espera<select id="opsEntryReason">'+choices(reasons,'')+'</select></label><label>¿Qué quedó pendiente?<input id="opsEntryPending" maxlength="300" placeholder="Opcional"></label></div><button class="button secondary" type="submit">+ Agregar trabajo del día</button></form></div><div class="ops-card"><h3>Registros de la jornada ('+draft.length+')</h3><div id="opsDraftList">'+(draft.map((x,i)=>'<div class="ops-task-line"><span><b>'+esc(x.category)+'</b><small>'+esc(x.summary)+'</small><small>'+num(x.minutes)+' min trabajo · '+num(x.wait)+' min espera</small></span><button type="button" class="button secondary" data-remove-entry="'+i+'">Quitar</button></div>').join('')||'<p class="ops-footnote">Todavía no agregas registros.</p>')+'</div><p><b>Tiempo documentado: '+(draft.reduce((n,x)=>n+num(x.minutes)+num(x.wait),0)/60).toFixed(1)+' h</b></p><button type="button" id="opsSubmitDaily" class="button primary" '+(!draft.length?'disabled':'')+'>✓ Entregar reporte diario</button><p id="opsDailyResult" role="status"></p></div></section>';
 $('opsDailyPerson').addEventListener('change',ev=>{selectedPerson=ev.target.value;loadDraft();renderDaily(d);});
 $('opsDailyDate').addEventListener('change',ev=>{selectedDate=ev.target.value||today();loadDraft();renderDaily(d);});
 $('opsEntryForm').addEventListener('submit',ev=>{ev.preventDefault();const minutes=num($('opsEntryMinutes').value),wait=num($('opsEntryWait').value),summary=$('opsEntrySummary').value.trim(),reason=$('opsEntryReason').value;
 if(!summary||minutes+wait>1440){alert('Captura qué se hizo y revisa que el tiempo no supere 24 horas.');return;}if(wait>0&&!reason){alert('Selecciona el motivo del tiempo de espera.');return;}
 const task=d.tasks.find(t=>t.id===$('opsEntryTask').value);
 draft.push({taskId:task?.id||null,ticketFolio:task?.ticketFolio||'',category:$('opsEntryCategory').value,summary,minutes,wait,reason,pending:$('opsEntryPending').value.trim()});renderDaily(d);});
 $('content').querySelectorAll('[data-remove-entry]').forEach(b=>b.addEventListener('click',()=>{draft.splice(Number(b.dataset.removeEntry),1);renderDaily(d);}));
 $('opsSubmitDaily').addEventListener('click',()=>{const total=draft.reduce((n,x)=>n+num(x.minutes)+num(x.wait),0);if(total>1440){alert('El tiempo declarado excede las 24 horas.');return;}const v=getLocal(),k=storageKey(selectedPerson,selectedDate),old=v.reports[k];v.reports[k]={person:selectedPerson,date:selectedDate,items:draft,submittedAt:old?.submittedAt||new Date().toISOString(),lastEditedAt:new Date().toISOString()};if(setLocal(v)){renderDaily(d);$('opsDailyResult').textContent='✅ Reporte guardado en este navegador.';}});
}
const reviewCriteria=['Asistencia y puntualidad','Disposición para el trabajo','Cumplimiento de instrucciones','Responsabilidad y organización','Calidad y seguridad','Comunicación y equipo','Reportes y evidencias'];
let reviewPerson='Javier Jimenez',reviewSubject='Javier Jimenez',reviewStep='preview';
function weeklySummary(d,person,start){const st=getLocal(),m=totals(st,person,start,d.tasks);return '<div class="ops-metrics">'+metric(m.assigned,'Asignadas')+metric(m.finished,'Completadas','good')+metric(m.overdue,'Vencidas','bad')+metric(m.docs.done+'/'+m.docs.required,'Reportes entregados')+metric((m.idle/60).toFixed(1)+' h','Espera reportada','warn')+'</div><h4>Trabajos de la semana</h4>'+(m.tasks.map(shortTask).join('')||'<p class="ops-footnote">No existen actividades vinculadas esta semana.</p>');}
function renderReview(d){
 const week=reviewWeek;
 const self=reviewSubject===reviewPerson,stored=getLocal().reviews[week+'|'+reviewPerson+'|'+reviewSubject];
 $('content').innerHTML='<section class="ops-main">'+panelBanner()+'<div class="ops-head"><div><h2>Evaluación semanal 360°</h2><p>Primero revisa tu actividad real; después califica con controles rápidos.</p></div><label>Semana <input id="opsReviewWeek" type="date" value="'+esc(week)+'"></label></div><div class="ops-card"><div class="ops-form-grid"><label>¿Quién evalúa?<select id="opsReviewPerson">'+peopleOptions(reviewPerson)+'</select></label><label>¿A quién evalúa?<select id="opsReviewSubject">'+peopleOptions(reviewSubject)+'</select></label></div><p class="ops-footnote">'+(self?'Autoevaluación':'Evaluación entre compañeros · usa «Sin información» cuando no trabajaron juntos.')+'</p></div><div class="ops-card"><h3>📋 Antes de evaluar: resumen de '+esc(reviewSubject)+'</h3>'+weeklySummary(d,reviewSubject,week)+'<button type="button" class="button primary" id="opsStartReview">Continuar con evaluación</button></div>'+(reviewStep==='form'?'<form id="opsReviewForm" class="ops-card"><h3>'+ (self?'Mi autoevaluación':'Evaluación de compañero') +'</h3><p class="ops-footnote">1 = Necesita mejorar, 10 = Excelente. «Sin información» no afecta el promedio.</p>'+reviewCriteria.map((name,i)=>'<label class="ops-rate">'+esc(name)+'<select name="r'+i+'"><option value="">Sin información</option>'+Array.from({length:10},(_,k)=>k+1).map(k=>'<option value="'+k+'" '+(stored?.ratings?.[i]===k?'selected':'')+'>'+k+'/10</option>').join('')+'</select></label>').join('')+'<label>Motivo breve (solo cuando sea necesario)<input name="reason" maxlength="300" value="'+esc(stored?.reason||'')+'" placeholder="Opcional; describir hechos concretos"></label><button class="button primary" type="submit">Guardar evaluación de prueba</button><p id="opsReviewResult" role="status"></p></form>':'')+'</section>';
 $('opsReviewWeek').addEventListener('change',ev=>{reviewWeek=weekStart(ev.target.value||today());reviewStep='preview';renderReview(d);});
 $('opsReviewPerson').addEventListener('change',ev=>{reviewPerson=ev.target.value;reviewSubject=reviewPerson;reviewStep='preview';renderReview(d);});
 $('opsReviewSubject').addEventListener('change',ev=>{reviewSubject=ev.target.value;reviewStep='preview';renderReview(d);});
 $('opsStartReview').addEventListener('click',()=>{reviewStep='form';renderReview(d);$('opsReviewForm')?.scrollIntoView({behavior:'smooth',block:'nearest'});});
 $('opsReviewForm')?.addEventListener('submit',ev=>{ev.preventDefault();const fd=new FormData(ev.currentTarget),ratings=reviewCriteria.map((_,i)=>fd.get('r'+i)?Number(fd.get('r'+i)):null);if(!ratings.some(v=>v!==null)){$('opsReviewResult').textContent='Califica al menos un criterio.';return;}if(ratings.some(v=>v!==null&&v<=5)&&!String(fd.get('reason')||'').trim()){$('opsReviewResult').textContent='Agrega una causa breve cuando califiques 5 o menos.';return;}const v=getLocal();v.reviews[reviewWeek+'|'+reviewPerson+'|'+reviewSubject]={week:reviewWeek,reviewer:reviewPerson,subject:reviewSubject,ratings,reason:String(fd.get('reason')||'').trim(),savedAt:new Date().toISOString()};if(setLocal(v)){$('opsReviewResult').textContent='✅ Evaluación de prueba guardada solo en este navegador.';}});
}
function attachActivityEvents(){
 const root=$('detailContent'),save=root?.querySelector('[data-action="save-task-update"]');
 if(!save||root.querySelector('[data-ops-incident]'))return;
 const b=document.createElement('button');b.type='button';b.className='button secondary ops-incident-button';b.dataset.opsIncident=save.dataset.id;b.textContent='⚠ Registrar bloqueo / incidencia';
 save.insertAdjacentElement('afterend',b);
 const taskId=save.dataset.id,v=getLocal(),events=v.events.filter(x=>x.taskId===taskId);
 if(events.length){const list=document.createElement('section');list.className='ops-activity-events';list.innerHTML='<h4>Incidencias registradas (piloto)</h4>'+events.map(x=>'<p><b>'+esc(x.date)+' · '+esc(x.type)+'</b> · '+esc(x.reason)+' · '+num(x.minutes)+' min</p>').join('');b.insertAdjacentElement('afterend',list);}
}
const activityObserver=new MutationObserver(attachActivityEvents);if($('detailContent'))activityObserver.observe($('detailContent'),{childList:true});
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-ops-incident]');if(!b)return;const dlg=document.createElement('dialog');dlg.className='ops-event-dialog';dlg.innerHTML='<form id="opsEventForm"><h2>Registrar seguimiento o incidencia</h2><p class="ops-footnote">Registro piloto vinculado a la actividad; no determina automáticamente responsabilidades.</p><label>Persona que registra<select name="person">'+peopleOptions(selectedPerson)+'</select></label><label>Tipo<select name="type">'+choices(['BLOQUEO','RETRABAJO','DAÑO','EXTRAVÍO','INCUMPLIMIENTO','REANUDACIÓN','SEGUIMIENTO'],'BLOQUEO')+'</select></label><label>¿Qué ocurrió?<textarea name="reason" rows="2" required minlength="5" maxlength="700"></textarea></label><label>Tiempo perdido (minutos)<input type="number" name="minutes" value="0" min="0" max="1440"></label><div class="ops-dialog-actions"><button type="button" class="button secondary" id="opsCancelEvent">Cancelar</button><button type="submit" class="button primary">Guardar registro</button></div></form>';document.body.append(dlg);dlg.showModal();$('opsCancelEvent').onclick=()=>dlg.close();dlg.addEventListener('close',()=>dlg.remove());$('opsEventForm').addEventListener('submit',e=>{e.preventDefault();const form=new FormData(e.currentTarget),v=getLocal();v.events.push({taskId:b.dataset.opsIncident,person:String(form.get('person')),type:String(form.get('type')),reason:String(form.get('reason')).trim(),minutes:num(form.get('minutes')),date:today(),createdAt:new Date().toISOString()});if(setLocal(v)){dlg.close();attachActivityEvents();alert('Registro de prueba guardado. Cierra y vuelve a abrir la actividad para verlo.');}});});
