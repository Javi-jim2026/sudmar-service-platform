import {activityCategories, checklistProgress, validateChecklist, validateActivity, MAX_WORK_ITEMS} from './checklist.js';
import {config} from './config.js';
import {repository} from './repository.js';
import {icon} from './icons.js';
import {normalized, clean, blankFilters, isKnownStatus, isClosed, isActive, isOverdue, taskComplete, taskClosed, taskCategory, validSerial, unique, filterTickets, linkedTasks, metrics, countsBy, equipmentGroups, safeEvidenceUrl, toCsv} from './core.js';

const $=id=>document.getElementById(id);
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=value=>new Intl.NumberFormat('es-MX').format(value);
const fmt=(value,full=false)=>value ? new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',...(full?{year:'numeric'}:{})}).format(new Date(value.slice(0,10)+'T12:00:00')) : 'Sin fecha';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:config.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const views={dashboard:{label:'Resumen',icon:'grid',title:'Centro de operaciones',subtitle:'La información de tu operación, en un solo lugar.'},tickets:{label:'Tickets',icon:'ticket',title:'Control de tickets',subtitle:'Consulta, filtra y sigue cada solicitud de servicio.'},tasks:{label:'Actividades',icon:'tasks',title:'Actividades de los tickets',subtitle:'Cada actividad ligada a un ticket, con responsable, estado y fecha compromiso.'},calendar:{label:'Calendario',icon:'calendar',title:'Calendario operativo',subtitle:'Planea aperturas de tickets y actividades por fecha, responsable y duración.'},team:{label:'Personal',icon:'users',title:'Personal y responsabilidades',subtitle:'Carga de trabajo, áreas, cargos y capacidad de atención en campo.'},equipment:{label:'Equipos',icon:'engine',title:'Equipos y servicios',subtitle:'Consulta los servicios registrados para cada número de serie.'},clients:{label:'Clientes',icon:'users',title:'Clientes y contactos',subtitle:'La operación por cliente y el directorio del Excel.'}};
const filterLabels={q:'Búsqueda',folio:'Folio',priority:'Nivel de atención',client:'Cliente',businessUnit:'Unidad de negocio',area:'Área',stage:'Etapa',owner:'Responsable del ticket',status:'Estado',model:'Modelo',serial:'Serie',from:'Desde',to:'Hasta',overdue:'Fuera de plazo',activeOnly:'Tickets activos'};
const statusStyle={
  abierto:{label:'Abierto',tone:'blue',color:'#2f80ed'},
  cerrado:{label:'Cerrado',tone:'green',color:'#16835f'},
  'en espera':{label:'En espera',tone:'amber',color:'#d68a00'},
  cobranza:{label:'Cobranza',tone:'purple',color:'#7c5ce7'},
  inactivo:{label:'Inactivo',tone:'slate',color:'#7b8794'},
  consigna:{label:'Consigna',tone:'cyan',color:'#0b9fa8'},
  cancelado:{label:'Cancelado',tone:'slate',color:'#7b8794'},
  cancelada:{label:'Cancelada',tone:'slate',color:'#7b8794'},
  nueva:{label:'Nueva',tone:'cyan',color:'#1597a5'},
  asignada:{label:'Asignada',tone:'blue',color:'#2f80ed'},
  aceptada:{label:'Aceptada',tone:'indigo',color:'#4f63d8'},
  'en proceso':{label:'En proceso',tone:'purple',color:'#7c5ce7'},
  pausada:{label:'Pausada',tone:'amber',color:'#d68a00'},
  'esperando info':{label:'Esperando info',tone:'orange',color:'#e1762d'},
  bloqueada:{label:'Bloqueada',tone:'red',color:'#c74444'},
  'pendiente validacion':{label:'Pendiente validación',tone:'cyan',color:'#0b9fa8'},
  'pendiente validación':{label:'Pendiente validación',tone:'cyan',color:'#0b9fa8'},
  aprobada:{label:'Aprobada',tone:'green',color:'#16835f'},
  aprobado:{label:'Aprobado',tone:'green',color:'#16835f'},
  concluida:{label:'Concluida',tone:'green',color:'#16835f'},
  concluido:{label:'Concluido',tone:'green',color:'#16835f'}
};
const state={data:null,personnel:[],view:'dashboard',filters:blankFilters(),page:1,taskStatus:'all',taskOwner:'',taskCategory:'',calendarMonth:today.slice(0,7),calendarOwner:'',calendarClient:'',calendarKind:'all',calendarActivityStatus:'pending',clientTab:'operations',contactQuery:'',references:null,referenceError:false};
let installEvent=null,toastTimer,searchTimer;
const statusInfo=t=>statusStyle[normalized(t.status)]||{label:'Sin clasificar',tone:'red',color:'#d78883'};
const badge=t=>`<span class="badge ${statusInfo(t).tone}" title="Estado del ticket: ${e(t.status||'Sin registrar')}">${statusInfo(t).label}</span>`;
const priority=t=>`<span class="priority p${['1','2','3','4'].includes(t.priority)?t.priority:'0'}"><i></i>${t.priority?`Nivel ${e(t.priority)}`:'Sin nivel'}</span>`;
const owner=name=>`<span class="avatar-owner"><span class="avatar">${e(clean(name).split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('')||'—')}</span><span class="owner-name">${e(name||'Sin asignar')}</span></span>`;
const sortRecent=items=>[...items].sort((a,b)=>(b.openedAt||'').localeCompare(a.openedAt||'')||b.folio.localeCompare(a.folio,'es',{numeric:true}));
const filtered=()=>filterTickets(state.data.tickets,state.filters,today);
const tasksInScope=()=>linkedTasks(filtered(),state.data.tasks);
const taskCategoryLabel=value=>({COMPRA:'Compras',COBRANZA:'Cobranza',FACTURACION:'Facturación',COTIZACION:'Cotización',CAMPO:'Campo / servicio',SEGUIMIENTO:'Seguimiento',OVERDUE:'Vencida'})[value]||value||'Seguimiento';
const activityType=task=>clean(task.taskType)||taskCategoryLabel(taskCategory(task));
const activityTypeTone=task=>{
 const type=normalized(activityType(task));
 if(type.includes('reparacion')) return 'indigo';
 if(type.includes('diagnostico')) return 'cyan';
 if(type.includes('mantenimiento')) return 'green';
 if(type.includes('instalacion')) return 'blue';
 if(type.includes('prueba')) return 'purple';
 if(type.includes('visita')) return 'cyan';
 if(type.includes('compra')) return 'amber';
 if(type.includes('cotizacion')) return 'blue';
 if(type.includes('facturacion')) return 'blue';
 if(type.includes('cobranza')) return 'purple';
 if(type.includes('reporte')) return 'slate';
 if(type.includes('administr')) return 'slate';
 return 'slate';
};
const activityOutcomeTone=value=>{
 const v=normalized(value);
 if(v==='realizada') return 'green';
 if(v.includes('cliente')) return 'slate';
 if(v.includes('tecnico')||v.includes('no realizada')) return 'red';
 if(v.includes('reprogramada')) return 'amber';
 return 'slate';
};
const activityStatusTone=task=>{
 if(taskComplete(task)) return 'green';
 if(['cancelada','cancelado'].includes(normalized(task.status))) return 'slate';
 if(task.dueAt&&task.dueAt<today) return 'red';
 if(normalized(task.status)==='bloqueada') return 'red';
 if(normalized(task.status)==='en proceso') return 'purple';
 if(normalized(task.status)==='en espera') return 'amber';
 return 'blue';
};
const currentTasks=()=>tasksInScope().filter(t=>{
 const complete=taskComplete(t),closed=taskClosed(t);
 const ownerMatch=!state.taskOwner||normalized(t.owner)===normalized(state.taskOwner);
 const statusMatch=state.taskStatus==='all'
   ||(state.taskStatus==='pending'&&!closed)
   ||(state.taskStatus==='complete'&&complete)
   ||(state.taskStatus==='cancelled'&&['cancelada','cancelado'].includes(normalized(t.status)));
 let typeMatch=true;
 if(state.taskCategory==='OVERDUE') typeMatch=!closed&&Boolean(t.dueAt)&&t.dueAt<today;
 else if(state.taskCategory==='BLOCKED') typeMatch=normalized(t.status)==='bloqueada';
 else if(state.taskCategory==='WAITING') typeMatch=normalized(t.status)==='en espera';
 else if(state.taskCategory==='FIELD') typeMatch=['diagnostico','reparacion','mantenimiento','instalacion','pruebas','visita'].some(x=>normalized(activityType(t)).includes(x));
 else if(state.taskCategory) typeMatch=normalized(activityType(t))===normalized(state.taskCategory);
 return ownerMatch&&statusMatch&&typeMatch;
});

function hydrateIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));root.querySelectorAll('[data-icon-before]').forEach(el=>{el.insertAdjacentHTML('afterbegin',icon(el.dataset.iconBefore));delete el.dataset.iconBefore;});}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3800);}
function readLocation(){const params=new URLSearchParams(location.search);state.view=views[params.get('view')]?params.get('view'):'dashboard';const defaults=blankFilters();for(const key of Object.keys(defaults)){if(params.has(key))defaults[key]=typeof defaults[key]==='boolean'?params.get(key)==='1':params.get(key);}if(!['openedAt','dueAt','closedAt'].includes(defaults.dateField))defaults.dateField='openedAt';for(const key of ['from','to'])if(defaults[key]&&!/^\d{4}-\d{2}-\d{2}$/.test(defaults[key]))defaults[key]='';state.filters=defaults;state.page=1;}
function writeLocation(){try{const params=new URLSearchParams();if(state.view!=='dashboard')params.set('view',state.view);const defaults=blankFilters();for(const[key,value]of Object.entries(state.filters))if(value&&value!==defaults[key])params.set(key,typeof value==='boolean'?'1':value);history.replaceState(null,'',location.pathname+(params.size?'?'+params.toString():'')+location.hash);}catch{/* A standalone downloaded preview may restrict history. */}}
function navigate(view){if(!views[view])return;state.view=view;state.page=1;render();window.scrollTo({top:0,behavior:'instant'});}

function renderNav(){for(const id of ['desktopNav','mobileNav']){$(id).innerHTML=Object.entries(views).map(([key,v])=>`<button class="${id==='desktopNav'?'nav-button ':''}${key===state.view?'active':''}" data-action="navigate" data-view="${key}" ${key===state.view?'aria-current="page"':''} aria-label="${v.label}">${icon(v.icon)}<span>${v.label}</span>${id==='desktopNav'&&key==='tickets'?`<small class="nav-count">${n(state.data.tickets.length)}</small>`:''}</button>`).join('');}}
function activeFilters(){return Object.entries(state.filters).filter(([key,value])=>key!=='dateField'&&Boolean(value));}
function renderFilterChips(){const active=activeFilters();$('filterCount').textContent=active.length;$('filterCount').hidden=!active.length;$('filterChips').innerHTML=active.map(([key,value])=>`<button class="filter-chip" data-action="remove-filter" data-key="${key}" aria-label="Quitar filtro ${e(filterLabels[key])}"><span>${e(filterLabels[key])}${typeof value==='boolean'?'':': '+e(value==='__EMPTY__'?'Sin registrar':value)}</span>${icon('close')}</button>`).join('')+(active.length?'<button class="clear-chips" data-action="clear">Limpiar todo</button>':'');}
function options(values,selected,placeholder='Todos'){return `<option value="">${e(placeholder)}</option>`+values.map(value=>`<option value="${e(value)}" ${value===selected?'selected':''}>${e(value||'Sin registrar')}</option>`).join('');}
function openFilters(){const f=state.filters;const selects=['priority','client','businessUnit','area','stage','owner','status','model','serial'];$('filterFields').innerHTML=`<label class="field">Folio del ticket<input name="folio" value="${e(f.folio)}" inputmode="numeric" placeholder="Ej. 2650"></label>`+selects.map(key=>{const values=unique(state.data.tickets.map(t=>t[key]));return `<label class="field">${filterLabels[key]}<select name="${key}">${options(values,f[key])}${state.data.tickets.some(t=>!t[key])?`<option value="__EMPTY__" ${f[key]==='__EMPTY__'?'selected':''}>Sin registrar</option>`:''}</select></label>`;}).join('')+`<label class="field full-width">Filtrar fechas por<select name="dateField"><option value="openedAt" ${f.dateField==='openedAt'?'selected':''}>Inicio del ticket</option><option value="dueAt" ${f.dateField==='dueAt'?'selected':''}>Meta de cierre</option><option value="closedAt" ${f.dateField==='closedAt'?'selected':''}>Cierre real</option></select></label><label class="field">Desde<input type="date" name="from" value="${e(f.from)}"></label><label class="field">Hasta<input type="date" name="to" value="${e(f.to)}"></label><label class="checkbox-field"><input type="checkbox" name="overdue" ${f.overdue?'checked':''}> Solo fuera de plazo</label><label class="checkbox-field"><input type="checkbox" name="activeOnly" ${f.activeOnly?'checked':''}> Solo tickets activos</label><p class="definition-note full-width">El periodo filtra las fechas registradas. El estado y el área corresponden al último Excel; no se reconstruyen estados históricos.</p>`;$('filterError').textContent='';$('filtersDialog').showModal();}
function applyFormFilters(close=true){const form=new FormData($('filterForm'));const next={...state.filters};for(const key of Object.keys(next)){if(key==='q')continue;next[key]=typeof next[key]==='boolean'?form.has(key):clean(form.get(key));}if(next.from&&next.to&&next.from>next.to){$('filterError').textContent='La fecha inicial debe ser anterior o igual a la fecha final.';return false;}state.filters=next;state.page=1;if(close)$('filtersDialog').close();render();return true;}
function clearFilters(){state.filters=blankFilters();state.taskOwner='';state.taskStatus='all';state.taskCategory='';state.contactQuery='';state.page=1;$('globalSearch').value='';$('filtersDialog').close();render();}
function setFilter(key,value,view='tickets'){state.filters[key]=value;if(key==='status'){state.filters.activeOnly=false;state.filters.overdue=false;}navigate(view);}

function kpis(tickets){const m=metrics(tickets,state.data.tasks,today);const scopedTasks=tasksInScope();const pendingTasks=scopedTasks.filter(t=>!taskClosed(t)).length;const cards=[['total','Tickets en la vista',m.total,'ticket',`${n(m.closed)} cerrados`],['active','Tickets activos',m.active,'bolt',`${n(m.priority1)} con nivel de atención 1`],['overdue','Fuera de plazo',m.overdue,'clock','Meta de cierre anterior a hoy'],['tasks','Actividades pendientes',pendingTasks,'tasks',`De ${n(scopedTasks.length)} actividades en alcance`]];return `<div class="overview-label"><h2>Tu operación en cifras</h2><span>Indicadores de la vista actual</span></div><div class="kpi-grid">${cards.map(([key,label,value,ico,note])=>`<button class="kpi-card" data-action="kpi" data-key="${key}" aria-label="${label}: ${value}"><span class="kpi-top"><span class="kpi-label">${label}</span><span class="kpi-icon">${icon(ico)}</span></span><strong class="kpi-number" data-metric="${key}">${n(value)}</strong><span class="kpi-bottom"><span>${e(note)}</span>${icon('arrow')}</span></button>`).join('')}</div>`;}
function statusPanel(tickets){const groups=countsBy(tickets,'status'),total=tickets.length;const areas=countsBy(tickets,'area');return `<section class="panel"><div class="panel-header"><div><h2>Estado de la operación</h2><p>Distribución de los tickets seleccionados</p></div><span class="number-badge">${n(total)} tickets</span></div><div class="panel-body">${total?`<div class="stacked-bar">${groups.map(g=>`<button style="flex:${g.count};--bar-color:${statusInfo({status:g.name}).color}" data-action="filter" data-key="status" data-value="${e(g.name)}" aria-label="${e(g.name)}: ${g.count} tickets"></button>`).join('')}</div><div class="status-list">${groups.map(g=>`<button class="status-row" data-action="filter" data-key="status" data-value="${e(g.name)}" style="--bar-color:${statusInfo({status:g.name}).color}"><span class="color-dot"></span><span>${statusInfo({status:g.name}).label}</span><strong>${n(g.count)}</strong></button>`).join('')}</div><div class="section-divider"></div><div class="area-metrics">${areas.map(g=>`<button class="area-metric" data-action="filter" data-key="area" data-value="${e(g.name)}"><span>${e(g.name)}</span><strong>${n(g.count)}</strong><div class="area-track"><i style="width:${g.count/total*100}%"></i></div></button>`).join('')}</div>`:'<p class="empty-chart">Sin tickets para estos filtros.</p>'}</div></section>`;}
function trendPanel(tickets){const anchor=state.filters.to||today;const end=new Date(anchor.slice(0,7)+'-15T12:00:00');const months=Array.from({length:6},(_,i)=>{const d=new Date(end);d.setMonth(d.getMonth()-(5-i));const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');return {key,label:new Intl.DateTimeFormat('es-MX',{month:'short'}).format(d),year:d.getFullYear(),count:tickets.filter(t=>t[state.filters.dateField]?.startsWith(key)).length};});const max=Math.max(1,...months.map(m=>m.count));const labels={openedAt:'Tickets por fecha de inicio',dueAt:'Tickets por meta de cierre',closedAt:'Tickets por fecha de cierre'};return `<section class="panel"><div class="panel-header"><div><h2>Actividad por mes</h2><p>${labels[state.filters.dateField]}</p></div>${icon('calendar')}</div><div class="panel-body"><div class="trend-chart">${months.map(m=>`<button class="trend-column" data-action="month" data-value="${m.key}" aria-label="${m.label} ${m.year}: ${m.count} tickets"><span class="trend-value">${n(m.count)}</span><span class="trend-bar" style="height:${Math.max(3,m.count/max*92)}px"></span></button>`).join('')}</div><div class="trend-labels">${months.map(m=>`<span>${e(m.label)}<br>${m.year}</span>`).join('')}</div><p class="trend-footnote">Selecciona un mes para explorar sus tickets.</p></div></section>`;}
function barsPanel(tickets,key,title,subtitle){const groups=countsBy(tickets,key).slice(0,6);const max=Math.max(1,...groups.map(g=>g.count));return `<section class="panel"><div class="panel-header"><div><h2>${title}</h2><p>${subtitle}</p></div><button class="text-action" data-action="filters">Ver filtros ${icon('arrow')}</button></div><div class="panel-body"><div class="bar-list">${groups.map(g=>`<button class="bar-row" data-action="filter" data-key="${key}" data-value="${e(g.name==='Sin registrar'?'__EMPTY__':g.name)}"><span class="bar-row-top"><span>${e(g.name)}</span><strong>${n(g.count)}</strong></span><div class="bar-track"><i style="width:${g.count/max*100}%"></i></div></button>`).join('')||'<p class="empty-chart">No hay registros en esta vista.</p>'}</div></div></section>`;}
function empty(message='Prueba con otro cliente, una búsqueda más corta o un rango de fechas diferente.'){return `<div class="empty-state">${icon('search')}<h2>Sin resultados para esta vista</h2><p>${e(message)}</p><button class="button secondary" data-action="clear">Limpiar filtros</button></div>`;}
function pagination(total){const pages=Math.max(1,Math.ceil(total/config.pageSize));state.page=Math.min(state.page,pages);const first=total?(state.page-1)*config.pageSize+1:0,last=Math.min(state.page*config.pageSize,total);return `<div class="pagination"><span class="pagination-label">${n(first)}–${n(last)} de ${n(total)} registros</span><div class="pagination-controls"><button class="button" data-action="page" data-delta="-1" ${state.page<=1?'disabled':''} aria-label="Página anterior">‹</button><span>${state.page} / ${pages}</span><button class="button" data-action="page" data-delta="1" ${state.page>=pages?'disabled':''} aria-label="Página siguiente">›</button></div></div>`;}
function pageSlice(items){state.page=Math.max(1,Math.min(state.page,Math.max(1,Math.ceil(items.length/config.pageSize))));return items.slice((state.page-1)*config.pageSize,state.page*config.pageSize);}
function renderTickets(tickets,preview=false){const sorted=sortRecent(tickets),list=preview?sorted.slice(0,6):pageSlice(sorted);const modes=[['all','Todos'],['active','Activos'],['wait','En espera'],['collection','Cobranza']];const selected=state.filters.activeOnly?'active':state.filters.status==='EN ESPERA'?'wait':state.filters.status==='COBRANZA'?'collection':'all';const header=preview?`<div class="panel-header"><div><h2>Últimos tickets registrados</h2><p>Abre un ticket para consultar su seguimiento</p></div><button class="text-action" data-action="navigate" data-view="tickets">Ver todos ${icon('arrow')}</button></div>`:`<div class="list-toolbar"><div><h2>${n(tickets.length)} tickets</h2><p>Ordenados por fecha de inicio, del más reciente al anterior</p></div><div class="segments" aria-label="Filtros rápidos de estado">${modes.map(([key,label])=>`<button class="${selected===key?'active':''}" data-action="quick" data-key="${key}">${label}</button>`).join('')}</div></div>`;return `<section class="panel">${header}${list.length?`<div class="table-wrap"><table class="ticket-table"><thead><tr><th>Ticket / equipo</th><th>Cliente</th><th class="priority-column">Atención</th><th>Estado / etapa</th><th class="owner-column">Responsable</th><th>Meta de cierre</th><th><span class="sr-only">Abrir</span></th></tr></thead><tbody>${list.map(t=>`<tr style="--ticket-state-color:${statusInfo(t).color}"><td><button class="ticket-title" data-action="ticket" data-id="${e(t.id)}"><span class="folio">#${e(t.folio)}</span><strong title="${e(t.title)}">${e(t.title||'Sin título')}</strong><small>${e(t.model||'Modelo no registrado')}${t.serial?' · '+e(t.serial):''}</small></button></td><td class="client-cell"><span title="${e(t.client)}">${e(t.client||'Sin cliente')}</span><small>${e(t.businessUnit)}</small></td><td class="priority-column">${priority(t)}</td><td>${badge(t)}<span class="stage-label" title="${e(t.stage)}">${e(t.stage)}</span></td><td class="owner-column">${owner(t.owner)}</td><td class="date-cell ${isOverdue(t,today)?'overdue':''}">${fmt(t.dueAt,true)}</td><td><button class="icon-button" data-action="ticket" data-id="${e(t.id)}" aria-label="Abrir ticket ${e(t.folio)}">${icon('chevron','row-arrow')}</button></td></tr>`).join('')}</tbody></table></div><div class="mobile-ticket-list">${list.map(t=>`<button class="mobile-ticket" style="--ticket-state-color:${statusInfo(t).color}" data-action="ticket" data-id="${e(t.id)}"><span class="mobile-ticket-top"><span class="folio">#${e(t.folio)}</span>${badge(t)}</span><h3>${e(t.title||'Sin título')}</h3><p>${e(t.client||'Sin cliente')} · ${e(t.model||'Sin modelo')}</p><span class="mobile-ticket-bottom">${priority(t)}<span>${e(t.stage||'Sin etapa')}</span>${icon('chevron')}</span></button>`).join('')}</div>`:empty()}${preview?'':pagination(tickets.length)}</section>`;}
function taskRow(task,compact=false){
 const context='Ticket #'+e(task.ticketFolio);
 const type=activityType(task);
 const statusLabel=taskComplete(task)?'COMPLETADA':(task.status||'SIN INICIAR');
 return `<button class="task-row" data-action="task" data-id="${e(task.id)}"><span class="task-check ${taskComplete(task)?'done':''}">${taskComplete(task)?icon('check'):''}</span><span class="task-row-title">${e(task.title||'Actividad sin descripción')}<small><span class="badge ${activityTypeTone(task)}">${e(type)}</span> · ${context}</small>${progressMarkup(task)}</span><span class="badge ${activityStatusTone(task)}">${e(statusLabel)}</span>${owner(task.owner)}${compact?'':`<span class="task-date">${fmt(task.dueAt,true)}</span>${icon('chevron','row-arrow')}`}</button>`;
}
function renderTasks(){
 const list=currentTasks().sort((a,b)=>Number(taskClosed(a))-Number(taskClosed(b))||(a.dueAt||'9999').localeCompare(b.dueAt||'9999')||(b.startAt||'').localeCompare(a.startAt||''));
 const owners=unique([...state.personnel.map(p=>p.name),...tasksInScope().map(t=>t.owner)]);
 const types=unique(tasksInScope().map(activityType));
 const categories=[['','Todos los tipos'],['OVERDUE','Vencidas'],['BLOCKED','Bloqueadas'],['WAITING','En espera'],...types.map(type=>[type,type])];
 return `<div class="view-summary"><span><strong>${n(list.length)}</strong> actividades en el alcance actual</span><div class="local-filters"><label><span class="sr-only">Responsable de actividad</span><select id="taskOwner">${options(owners,state.taskOwner,'Todos los responsables')}</select></label><label><span class="sr-only">Tipo de actividad</span><select id="taskCategory">${categories.map(([value,label])=>`<option value="${e(value)}" ${state.taskCategory===value?'selected':''}>${e(label)}</option>`).join('')}</select></label><label><span class="sr-only">Estado de actividad</span><select id="taskStatus"><option value="all" ${state.taskStatus==='all'?'selected':''}>Todas</option><option value="pending" ${state.taskStatus==='pending'?'selected':''}>Pendientes</option><option value="complete" ${state.taskStatus==='complete'?'selected':''}>Completadas</option><option value="cancelled" ${state.taskStatus==='cancelled'?'selected':''}>Canceladas</option></select></label></div></div><section class="panel"><div class="task-list">${list.length?pageSlice(list).map(t=>taskRow(t)).join(''):empty('No hay actividades que coincidan con los filtros seleccionados.')}</div>${pagination(list.length)}</section><p class="definition-note">Toda actividad pertenece a un ticket. El tipo puede escribirse libremente para adaptarse a la operación.</p>`;
}
function operationalTaskPanel(){
 const pending=tasksInScope().filter(t=>!taskClosed(t));
 const overdue=pending.filter(t=>t.dueAt&&t.dueAt<today).length;
 const blocked=pending.filter(t=>normalized(t.status)==='bloqueada').length;
 const waiting=pending.filter(t=>normalized(t.status)==='en espera').length;
 const repairs=pending.filter(t=>normalized(activityType(t)).includes('reparacion')).length;
 const field=pending.filter(t=>['diagnostico','reparacion','mantenimiento','instalacion','pruebas','visita'].some(x=>normalized(activityType(t)).includes(x))).length;
 const cards=[
  ['OVERDUE','Actividades vencidas',overdue,'Fecha compromiso anterior a hoy'],
  ['BLOCKED','Bloqueadas',blocked,'Requieren destrabe o decisión'],
  ['WAITING','En espera',waiting,'Dependencia externa o pendiente'],
  ['REPARACIÓN','Reparaciones',repairs,'Actividades de reparación pendientes'],
  ['FIELD','Campo / servicio',field,'Diagnóstico, visita, pruebas y servicio']
 ];
 return `<section class="panel task-control-panel"><div class="panel-header"><div><h2>Pendientes críticos</h2><p>Actividades que requieren seguimiento operativo</p></div><button class="text-action" data-action="navigate" data-view="tasks">Ver todas ${icon('arrow')}</button></div><div class="task-control-grid">${cards.map(([key,label,value,note])=>`<button class="task-control-card" data-action="task-category" data-category="${key}"><span><small>${label}</small><strong>${n(value)}</strong></span><p>${note}</p>${icon('arrow')}</button>`).join('')}</div></section>`;
}

const isoParts=iso=>{const [y,m,d]=String(iso||'').slice(0,10).split('-').map(Number);return {y,m,d};};
const isoUtc=iso=>{const {y,m,d}=isoParts(iso);return new Date(Date.UTC(y,m-1,d));};
const isoFromUtc=date=>date.toISOString().slice(0,10);
const addDays=(iso,days)=>{const d=isoUtc(iso);d.setUTCDate(d.getUTCDate()+days);return isoFromUtc(d);};
const daysInclusive=(from,to)=>{
 if(!from)return 0;
 const end=to&&to>=from?to:from;
 return Math.floor((isoUtc(end)-isoUtc(from))/86400000)+1;
};
const shiftMonth=(month,delta)=>{
 const [y,m]=month.split('-').map(Number);
 const d=new Date(Date.UTC(y,m-1+delta,1));
 return d.toISOString().slice(0,7);
};
const monthRange=month=>{
 const [y,m]=month.split('-').map(Number);
 const first=`${month}-01`;
 const last=isoFromUtc(new Date(Date.UTC(y,m,0)));
 return {first,last};
};
const monthLabel=month=>{
 const [y,m]=month.split('-').map(Number);
 return new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,1)));
};
const shortDate=iso=>iso?new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',timeZone:'UTC'}).format(isoUtc(iso)):'';
function calendarActivityTasks(tickets){
 const ticketIds=new Set(tickets.map(t=>t.folio));
 let tasks=state.data.tasks.filter(t=>ticketIds.has(t.ticketFolio));
 if(state.calendarOwner) tasks=tasks.filter(t=>normalized(t.owner)===normalized(state.calendarOwner));
 if(state.calendarClient) tasks=tasks.filter(t=>{
   const ticket=state.data.tickets.find(x=>x.folio===t.ticketFolio);
   return normalized(ticket?.client)===normalized(state.calendarClient);
 });
 if(state.calendarActivityStatus==='pending') tasks=tasks.filter(t=>!taskClosed(t));
 if(state.calendarActivityStatus==='complete') tasks=tasks.filter(taskComplete);
 if(state.calendarActivityStatus==='cancelled') tasks=tasks.filter(t=>['cancelada','cancelado'].includes(normalized(t.status)));
 return tasks;
}
function calendarTicketSet(tickets){
 let list=tickets;
 if(state.calendarOwner) list=list.filter(t=>normalized(t.owner)===normalized(state.calendarOwner));
 if(state.calendarClient) list=list.filter(t=>normalized(t.client)===normalized(state.calendarClient));
 return list;
}
function activityCalendarClass(task){
 if(taskComplete(task)) return 'complete';
 if(['cancelada','cancelado'].includes(normalized(task.status))) return 'cancelled';
 if(normalized(task.status)==='bloqueada') return 'blocked';
 if(task.dueAt&&task.dueAt<today) return 'overdue';
 if(normalized(task.status)==='en espera') return 'waiting';
 return 'planned';
}
function renderCalendar(tickets){
 const month=state.calendarMonth||today.slice(0,7);
 const {first,last}=monthRange(month);
 const ticketSet=calendarTicketSet(tickets);
 const tasks=calendarActivityTasks(tickets);
 const opened=ticketSet.filter(t=>t.openedAt>=first&&t.openedAt<=last);
 const starts=tasks.filter(t=>t.startAt>=first&&t.startAt<=last);
 const due=tasks.filter(t=>t.dueAt>=first&&t.dueAt<=last);
 const overlap=tasks.filter(t=>{
   if(!t.startAt)return false;
   const end=t.dueAt&&t.dueAt>=t.startAt?t.dueAt:t.startAt;
   return t.startAt<=last&&end>=first;
 });
 const plannedDays=overlap.reduce((sum,t)=>{
   const end=t.dueAt&&t.dueAt>=t.startAt?t.dueAt:t.startAt;
   const clippedStart=t.startAt<first?first:t.startAt;
   const clippedEnd=end>last?last:end;
   return sum+daysInclusive(clippedStart,clippedEnd);
 },0);
 const owners=unique([...state.personnel.map(p=>p.name),...state.data.tasks.map(t=>t.owner),...state.data.tickets.map(t=>t.owner)]);
 const clients=unique(tickets.map(t=>t.client));
 const firstDate=isoUtc(first);
 const mondayOffset=(firstDate.getUTCDay()+6)%7;
 const gridStart=addDays(first,-mondayOffset);
 const lastDate=isoUtc(last);
 const sundayOffset=6-((lastDate.getUTCDay()+6)%7);
 const gridEnd=addDays(last,sundayOffset);
 const days=[];
 for(let d=gridStart;d<=gridEnd;d=addDays(d,1)) days.push(d);
 const weekdayNames=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
 const kind=state.calendarKind;
 const eventCells=days.map(date=>{
   const inMonth=date.slice(0,7)===month;
   const isToday=date===today;
   const ticketEvents=(kind==='all'||kind==='tickets')?ticketSet.filter(t=>t.openedAt===date):[];
   const activityEvents=(kind==='all'||kind==='activities')?tasks.filter(t=>{
     if(!t.startAt)return false;
     const end=t.dueAt&&t.dueAt>=t.startAt?t.dueAt:t.startAt;
     return t.startAt<=date&&end>=date;
   }):[];
   const allEvents=[
     ...ticketEvents.map(t=>({sort:'0'+t.folio,html:`<button class="calendar-event ticket-open" data-action="ticket" data-id="${e(t.id)}" title="Ticket #${e(t.folio)} abierto el ${e(fmt(t.openedAt,true))}"><strong>#${e(t.folio)}</strong><span>${e(t.client||'Sin cliente')}</span><small>${e(t.title||'Sin título')}</small></button>`})),
     ...activityEvents.map(t=>{
       const end=t.dueAt&&t.dueAt>=t.startAt?t.dueAt:t.startAt;
       const duration=daysInclusive(t.startAt,end);
       const start=date===t.startAt,endHere=date===end;
       const range=start?(duration>1?`${shortDate(t.startAt)}–${shortDate(end)} · ${duration} días`:'1 día'):(endHere?'Vence hoy':`En curso · ${duration} días`);
       return {sort:'1'+(t.dueAt||'9999')+t.title,html:`<button class="calendar-event activity-event ${activityCalendarClass(t)} ${start?'activity-start':''} ${endHere?'activity-end':''}" data-action="task" data-id="${e(t.id)}" title="${e(t.title)} · ${e(t.owner||'Sin asignar')} · ${e(range)}"><strong>${e(activityType(t))}${checklistProgress(t)?' · '+checklistProgress(t).percent+'%':''}</strong><span>${e(t.title||'Actividad')}</span><small>${e(range)} · ${e(t.owner||'Sin asignar')}</small></button>`};
     })
   ].sort((a,b)=>a.sort.localeCompare(b.sort,'es',{numeric:true}));
   const visible=allEvents.slice(0,5);
   const hidden=allEvents.length-visible.length;
   return `<div class="calendar-day ${inMonth?'':'outside'} ${isToday?'today':''}"><div class="calendar-date"><strong>${Number(date.slice(8,10))}</strong>${isToday?'<span>HOY</span>':''}</div><div class="calendar-day-events">${visible.map(x=>x.html).join('')}${hidden?'<span class="calendar-more">+'+hidden+' más</span>':''}</div></div>`;
 }).join('');
 return `<section class="calendar-controls panel">
   <div class="calendar-month-nav">
     <button class="button secondary small" data-action="calendar-month-shift" data-delta="-1">‹ Anterior</button>
     <label class="calendar-month-picker"><span>Mes</span><input id="calendarMonthPicker" type="month" value="${e(month)}"></label>
     <button class="button secondary small" data-action="calendar-month-shift" data-delta="1">Siguiente ›</button>
     <button class="button ghost small" data-action="calendar-today">Hoy</button>
   </div>
   <div class="calendar-filters">
     <label>Responsable<select id="calendarOwner">${options(owners,state.calendarOwner,'Todos')}</select></label>
     <label>Cliente<select id="calendarClient">${options(clients,state.calendarClient,'Todos')}</select></label>
     <label>Mostrar<select id="calendarKind"><option value="all" ${state.calendarKind==='all'?'selected':''}>Tickets + actividades</option><option value="tickets" ${state.calendarKind==='tickets'?'selected':''}>Solo aperturas de tickets</option><option value="activities" ${state.calendarKind==='activities'?'selected':''}>Solo actividades</option></select></label>
     <label>Actividades<select id="calendarActivityStatus"><option value="pending" ${state.calendarActivityStatus==='pending'?'selected':''}>Pendientes / planeadas</option><option value="all" ${state.calendarActivityStatus==='all'?'selected':''}>Todas</option><option value="complete" ${state.calendarActivityStatus==='complete'?'selected':''}>Completadas</option><option value="cancelled" ${state.calendarActivityStatus==='cancelled'?'selected':''}>Canceladas</option></select></label>
   </div>
 </section>
 <div class="calendar-summary">
   <article><span>Tickets abiertos</span><strong>${n(opened.length)}</strong><small>durante ${e(monthLabel(month))}</small></article>
   <article><span>Actividades iniciadas</span><strong>${n(starts.length)}</strong><small>fecha de inicio en el mes</small></article>
   <article><span>Actividades por vencer</span><strong>${n(due.length)}</strong><small>fecha compromiso en el mes</small></article>
   <article><span>Días planificados</span><strong>${n(plannedDays)}</strong><small>suma de duración dentro del mes</small></article>
 </div>
 <section class="panel calendar-panel">
   <div class="calendar-heading"><div><span class="eyebrow">PLANEACIÓN OPERATIVA</span><h2>${e(monthLabel(month))}</h2></div><div class="calendar-legend"><span><i class="legend-ticket"></i>Inicio de ticket</span><span><i class="legend-activity"></i>Actividad</span><span><i class="legend-overdue"></i>Vencida/bloqueada</span></div></div>
   <div class="calendar-scroll">
     <div class="calendar-weekdays">${weekdayNames.map(x=>'<span>'+x+'</span>').join('')}</div>
     <div class="calendar-grid">${eventCells}</div>
   </div>
 </section>
 <p class="definition-note">La duración de una actividad se calcula desde su fecha de inicio hasta su fecha compromiso, incluyendo ambos días. Las actividades sin fecha compromiso se muestran como una actividad de un día.</p>`;
}

function personWorkload(person,tickets=filtered(),tasks=tasksInScope()){
 const personName=normalized(person.name);
 const ownedTickets=tickets.filter(t=>normalized(t.owner)===personName);
 const assignedTasks=tasks.filter(t=>normalized(t.owner)===personName);
 const pending=assignedTasks.filter(t=>!taskClosed(t));
 const overdue=pending.filter(t=>t.dueAt&&t.dueAt<today);
 return {ownedTickets,assignedTasks,pending,overdue};
}
function teamWorkloadPanel(tickets){
 const people=state.personnel||[];const tasks=tasksInScope();
 const rows=people.map(person=>({person,...personWorkload(person,tickets,tasks)})).sort((a,b)=>b.pending.length-a.pending.length||a.person.name.localeCompare(b.person.name,'es'));
 const max=Math.max(1,...rows.map(row=>row.pending.length));
 return `<section class="panel workload-panel"><div class="panel-header"><div><h2>Carga de trabajo por persona</h2><p>Actividades pendientes de la operación actual</p></div><button class="text-action" data-action="navigate" data-view="team">Ver personal ${icon('arrow')}</button></div><div class="panel-body"><div class="workload-list">${rows.map(row=>`<button class="workload-row" data-action="team-person" data-person="${e(row.person.name)}"><span class="workload-person">${owner(row.person.name)}<small>${e(row.person.title)} · ${e(row.person.area)}</small></span><span class="workload-count"><strong>${n(row.pending.length)}</strong><small>pendientes${row.overdue.length?' · '+n(row.overdue.length)+' vencidas':''}</small></span><span class="workload-track"><i style="width:${row.pending.length/max*100}%"></i></span></button>`).join('')}</div></div></section>`;
}
function renderTeam(tickets){
 const people=state.personnel||[];const tasks=tasksInScope();
 const fieldTeam=people.filter(p=>p.fieldTechnician);
 const cards=people.map(person=>{const w=personWorkload(person,tickets,tasks);return `<button class="person-card" data-action="team-person" data-person="${e(person.name)}"><span class="person-card-top"><span class="avatar large">${e(person.name.split(/\s+/).slice(0,2).map(x=>x[0]).join(''))}</span><span class="number-badge">${n(w.pending.length)} pendientes</span></span><h2>${e(person.name)}</h2><h3>${e(person.title)}</h3><p>${person.parentArea?e(person.parentArea)+' · ':''}${e(person.area)}</p><div class="person-tags">${person.fieldTechnician?'<span class="badge blue">Técnico de campo</span>':''}${person.fieldLead?'<span class="badge green">Responsable de campo</span>':''}</div><span class="entity-card-foot"><span><strong>${n(w.ownedTickets.length)}</strong> tickets</span><span><strong>${n(w.assignedTasks.length)}</strong> actividades</span><span>${n(w.overdue.length)} vencidas</span></span></button>`;}).join('');
 return `<div class="team-summary"><section class="panel"><div class="panel-header"><div><h2>Equipo de campo</h2><p>Personal habilitado para atención técnica en sitio</p></div><span class="number-badge">${fieldTeam.length} técnicos</span></div><div class="panel-body"><div class="field-team">${fieldTeam.map(person=>`<div class="field-person"><span class="avatar">${e(person.name.split(/\s+/).slice(0,2).map(x=>x[0]).join(''))}</span><span><strong>${e(person.name)}</strong><small>${e(person.fieldRole||'Técnico de campo')}</small></span></div>`).join('')}</div></div></section></div><div class="person-grid">${cards}</div>`;
}
function renderEquipment(tickets){const groups=equipmentGroups(tickets).sort((a,b)=>b.tickets.length-a.tickets.length);return `<div class="view-summary"><span><strong>${n(groups.length)}</strong> series registradas en esta vista</span><span>${n(tickets.filter(t=>!validSerial(t.serial)).length)} tickets sin serie identificable</span></div><div class="card-grid">${pageSlice(groups).map(g=>`<button class="entity-card" data-action="equipment" data-value="${e(g.serial)}"><span class="entity-card-top"><span class="entity-icon">${icon('engine')}</span><span class="number-badge">${g.tickets.length} tickets</span></span><h2>${e(g.models[0]||'Modelo sin registrar')}</h2><p>Serie: ${e(g.serial)}</p><p>${e(g.clients[0]||'Cliente sin registrar')}${g.clients.length>1?' y otros':''}</p><span class="entity-card-foot"><span><strong>${g.tickets.filter(isActive).length}</strong> activos</span><span>Ver servicios ↗</span></span></button>`).join('')}</div>${groups.length?pagination(groups.length):empty('Los tickets seleccionados no contienen un número de serie identificable.')}<p class="definition-note">Agrupación por serie registrada. Se conservan todos los modelos asociados; los movimientos anteriores que no están en el Excel quedan pendientes de incorporar.</p>`;}
function contacts(){const rows=state.references?.CLIENTES?.rows||[];return rows.filter(r=>r.row>1&&(r.cells.B||r.cells.G)).map(r=>({id:r.row,name:clean(r.cells.B),email:clean(r.cells.C),phone:clean(r.cells.D),role:clean(r.cells.E),company:clean(r.cells.G),type:clean(r.cells.H),address:clean(r.cells.J),city:clean(r.cells.K),region:clean(r.cells.L)}));}
function selectedContacts(){const q=normalized(state.contactQuery);const matchingClients=new Set(filtered().map(t=>normalized(t.client)));const scoped=activeFilters().length>0;return contacts().filter(c=>(!scoped||matchingClients.has(normalized(c.company)))&&(!q||[c.name,c.company,c.email,c.city].some(v=>normalized(v).includes(q))));}
function renderClients(tickets){const groups=countsBy(tickets,'client');let content='';const tabs=`<div class="view-summary"><div class="segments"><button data-action="client-tab" data-value="operations" class="${state.clientTab==='operations'?'active':''}">Operación por cliente</button><button data-action="client-tab" data-value="directory" class="${state.clientTab==='directory'?'active':''}">Directorio del Excel</button></div><span>${state.clientTab==='operations'?n(groups.length)+' clientes':state.references?n(contacts().length)+' contactos en el archivo':'Cargando directorio…'}</span></div>`;
 if(state.clientTab==='operations'){content=`<div class="card-grid">${pageSlice(groups).map(g=>{const ts=tickets.filter(t=>(t.client||'Sin registrar')===g.name);return `<button class="entity-card" data-action="filter" data-key="client" data-value="${e(g.name==='Sin registrar'?'__EMPTY__':g.name)}"><span class="entity-card-top"><span class="entity-icon">${icon('users')}</span><span class="number-badge">${g.count} tickets</span></span><h2>${e(g.name)}</h2><p>${unique(ts.map(t=>t.businessUnit)).map(e).join(' · ')}</p><span class="entity-card-foot"><span><strong>${ts.filter(isActive).length}</strong> activos</span><span>Ver operación ↗</span></span></button>`;}).join('')}</div>${groups.length?pagination(groups.length):empty()}`;}
 else if(!state.references){if(!state.referenceError)loadReferences();content=state.referenceError?`<div class="empty-state"><h2>No se pudo cargar el directorio</h2><button class="button" data-action="retry-references">Reintentar</button></div>`:'<div class="loading-state"><div class="loading-ring"></div></div>';}
 else{const list=selectedContacts();content=`<div class="view-summary"><input class="inline-search" id="contactSearch" value="${e(state.contactQuery)}" placeholder="Buscar contacto o compañía" aria-label="Buscar en el directorio"><span>${n(list.length)} contactos en esta vista</span></div>${activeFilters().length?'<p class="notice neutral">El directorio muestra coincidencias exactas con los clientes de los tickets filtrados.</p>':''}<div class="card-grid contact-grid">${pageSlice(list).map(c=>`<article class="contact-card"><h2>${e(c.name||'Contacto sin nombre')}</h2><h3>${e(c.company)}</h3><p>${e(c.role||c.type)}</p><p>${e([c.city,c.region].filter(Boolean).join(', '))}</p>${c.email?`<a href="mailto:${encodeURIComponent(c.email)}">${icon('mail')}${e(c.email)}</a>`:''}${c.phone?`<a href="tel:${c.phone.replace(/[^+\d]/g,'')}">${icon('phone')}${e(c.phone)}</a>`:''}${c.address?`<p style="margin-top:12px">${e(c.address)}</p>`:''}</article>`).join('')}</div>${list.length?pagination(list.length):empty('No hay contactos coincidentes. Puedes limpiar los filtros generales para consultar todo el directorio.')}`;}
 return tabs+content;
}
let referencesLoading=false;
async function loadReferences(){if(referencesLoading)return;referencesLoading=true;try{state.references=await repository.references();state.referenceError=false;}catch{state.referenceError=true;}finally{referencesLoading=false;if(state.view==='clients')render();}}

function fillWriteSelect(id,values,placeholder='Seleccionar'){
 const el=$(id);if(!el)return;
 el.innerHTML=options(unique(values.filter(Boolean)),'',placeholder);
}
function openNewTicket(){
 fillWriteSelect('newTicketClient',state.data.tickets.map(t=>t.client),'Seleccionar cliente');
 fillWriteSelect('newTicketBusinessUnit',state.data.tickets.map(t=>t.businessUnit),'Seleccionar unidad');
 fillWriteSelect('newTicketArea',[...state.personnel.map(p=>p.area),...state.personnel.map(p=>p.parentArea),...state.data.tickets.map(t=>t.area)],'Seleccionar área');
 fillWriteSelect('newTicketOwner',state.personnel.map(p=>p.name),'Sin asignar');
 const form=$('newTicketForm');form.reset();form.elements.openedAt.value=today;$('newTicketError').textContent='';
 $('newTicketDialog').showModal();
}
function activityTicketOptions(query='',selected=''){
 const queryText=normalized(query);
 const all=[...state.data.tickets].sort((a,b)=>Number(isClosed(a))-Number(isClosed(b))||(b.openedAt||'').localeCompare(a.openedAt||'')||b.folio.localeCompare(a.folio,'es',{numeric:true}));
 let matches=all;
 if(queryText){
   matches=all.filter(t=>normalized([t.folio,t.title,t.client,t.model,t.serial,t.status].join(' ')).includes(queryText));
 }else{
   matches=all.filter(t=>!isClosed(t)).slice(0,40);
 }
 if(selected&&!matches.some(t=>String(t.folio)===String(selected))){
   const selectedTicket=all.find(t=>String(t.folio)===String(selected));
   if(selectedTicket) matches=[selectedTicket,...matches];
 }
 return matches.slice(0,80);
}
function renderActivityTicketOptions(query='',selected=''){
 const select=$('newTaskTicket');if(!select)return;
 const matches=activityTicketOptions(query,selected);
 select.innerHTML='<option value="">Seleccionar ticket</option>'+matches.map(t=>`<option value="${e(t.folio)}" ${String(t.folio)===String(selected)?'selected':''}>#${e(t.folio)} · ${e(t.client||'Sin cliente')} · ${e(t.title||'Sin título')}${t.model?' · '+e(t.model):''}${isClosed(t)?' · '+e(t.status):''}</option>`).join('');
 const help=$('newTaskTicketSearch')?.closest('.field')?.querySelector('.field-help');
 if(help) help.textContent=normalized(query)?(matches.length+' coincidencia'+(matches.length===1?'':'s')+' encontradas.'):'Mostrando los 40 tickets activos más recientes. Escribe para buscar en todos.';
}
function progressMarkup(task){
 const p=checklistProgress(task);
 if(!p)return '';
 return `<span class="work-progress"><progress max="100" value="${p.percent}" aria-label="Avance de trabajos"></progress><span>${p.percent}% · ${p.completed} de ${p.total} trabajos</span></span>`;
}
function categoryOptions(value=''){
 return '<option value="">Seleccionar categoría</option>'+activityCategories.map(c=>`<option ${c===value?'selected':''}>${c}</option>`).join('');
}
function checklistEditor(id,category,items=[]){
 return `<section id="${id}" class="work-editor full-width" ${category==='OPERACIONES'?'':'hidden'}><h3>Lista de trabajos</h3><p class="definition-note">Trabajos internos de esta actividad. El avance no cambia su estado.</p><div class="work-items">${items.map(workItemRow).join('')}</div><p class="work-summary" aria-live="polite"></p><button type="button" class="button secondary small" data-action="add-work">+ Agregar trabajo</button></section>`;
}
function workItemRow(item){
 return `<div class="work-item" data-work-id="${e(item.id)}"><input type="checkbox" class="work-completed" aria-label="Trabajo completado" ${item.completed?'checked':''}><input type="text" class="work-text" aria-label="Descripción del trabajo" maxlength="1000" value="${e(item.text)}" placeholder="Escribe el trabajo a realizar"><button type="button" class="button ghost small" data-action="remove-work" aria-label="Eliminar trabajo">Eliminar</button></div>`;
}
function readChecklist(editor){
 return [...editor.querySelectorAll('.work-item')].map(row=>({id:row.dataset.workId,text:row.querySelector('.work-text').value,completed:row.querySelector('.work-completed').checked}));
}
function updateWorkSummary(editor){
 if(!editor)return;
 const p=checklistProgress({category:'OPERACIONES',checklist:readChecklist(editor)});
 editor.querySelector('.work-summary').textContent=`${p.percent}% · ${p.completed} de ${p.total} trabajos completados`;
 editor.querySelector('[data-action="add-work"]').disabled=p.total>=MAX_WORK_ITEMS;
}
function openNewTask(ticketFolio=''){
 const form=$('newTaskForm');form.reset();
 $('newTaskCategory').innerHTML=categoryOptions();
 $('newTaskChecklistHost').innerHTML=checklistEditor('newTaskChecklist','');
 updateWorkSummary($('newTaskChecklist'));
 fillWriteSelect('newTaskOwner',state.personnel.map(p=>p.name),'Seleccionar responsable');
 form.elements.startAt.value=today;
 const search=$('newTaskTicketSearch');
 if(search) search.value='';
 renderActivityTicketOptions('',ticketFolio);
 if(ticketFolio){
   const ticket=state.data.tickets.find(t=>String(t.folio)===String(ticketFolio));
   if(search&&ticket) search.value='#'+ticket.folio+' · '+(ticket.client||'')+' · '+(ticket.title||'');
 }
 $('newTaskError').textContent='';
 $('newTaskDialog').showModal();
}
function formPayload(form){return Object.fromEntries([...new FormData(form).entries()].map(([key,value])=>[key,clean(value)]));}
async function refreshOperationalData(){state.data=await repository.loadSupabase();render();}
async function submitNewTicket(event){
 event.preventDefault();const error=$('newTicketError');error.textContent='';
 if(!repository.canWrite()){error.textContent='La conexión de escritura con Supabase todavía no está disponible.';return;}
 const button=event.submitter;button.disabled=true;
 try{await repository.createTicket(formPayload(event.currentTarget));$('newTicketDialog').close();await refreshOperationalData();toast('Ticket creado y guardado en Supabase.');}
 catch(err){error.textContent=err.message||'No se pudo guardar el ticket.';}finally{button.disabled=false;}
}
async function submitNewTask(event){
 event.preventDefault();const error=$('newTaskError');error.textContent='';
 if(!repository.canWrite()){error.textContent='La conexión de escritura con Supabase todavía no está disponible.';return;}
 const payload=formPayload(event.currentTarget);
 if(!payload.ticketFolio){error.textContent='Selecciona el ticket al que pertenece la actividad.';return;}
 const button=event.submitter;button.disabled=true;
 try{
   payload.checklist=validateChecklist(readChecklist($('newTaskChecklist')));
   validateActivity(payload);
   await repository.createTask(payload);
   $('newTaskDialog').close();
   await refreshOperationalData();
   const ticket=state.data.tickets.find(t=>t.folio===payload.ticketFolio);
   if(ticket) showTicketDetail(ticket.id);
   toast('Actividad creada y ligada al ticket #'+payload.ticketFolio+'.');
 } catch(err){error.textContent=err.message||'No se pudo guardar la actividad.';}
 finally{button.disabled=false;}
}

function render(){if(!state.data)return;const tickets=filtered();const view=views[state.view];$('pageTitle').textContent=view.title;$('pageSubtitle').textContent=view.subtitle;$('breadcrumbTitle').textContent=view.label;$('globalSearch').value=state.filters.q;renderNav();renderFilterChips();$('resultAnnouncement').textContent=`${tickets.length} tickets coinciden con los filtros.`;
 if(state.view==='dashboard')$('content').innerHTML=kpis(tickets)+operationalTaskPanel()+`<div class="grid-main">${statusPanel(tickets)}${trendPanel(tickets)}</div>`+teamWorkloadPanel(tickets)+renderTickets(tickets,true)+`<div class="grid-even" style="margin-top:18px">${barsPanel(tickets,'stage','Etapas de atención','Las 6 etapas con más tickets en esta vista')}${barsPanel(tickets,'businessUnit','Unidades de negocio','Participación dentro de la vista actual')}</div>`;
 if(state.view==='tickets')$('content').innerHTML=renderTickets(tickets);
 if(state.view==='tasks')$('content').innerHTML=renderTasks();
 if(state.view==='calendar')$('content').innerHTML=renderCalendar(tickets);
 if(state.view==='team')$('content').innerHTML=renderTeam(tickets);
 if(state.view==='equipment')$('content').innerHTML=renderEquipment(tickets);
 if(state.view==='clients')$('content').innerHTML=renderClients(tickets);
 $('exportButton').disabled=state.view==='clients'&&state.clientTab==='directory'&&!state.references;writeLocation();
}

function detailHeader(eyebrow,title){return `<div class="dialog-header"><div><span class="eyebrow">${e(eyebrow)}</span><h2 id="detailTitle">${e(title)}</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Cerrar detalle">${icon('close')}</button></div>`;}
function openDetail(html){$('detailContent').innerHTML=html;if(!$('detailDialog').open)$('detailDialog').showModal();$('detailDialog').scrollTop=0;}
function detailField(label,value){return `<div class="detail-field"><span>${label}</span><strong>${e(value||'Sin registrar')}</strong></div>`;}
function showTicketDetail(id){
 const t=state.data.tickets.find(t=>t.id===id);if(!t)return;
 const tasks=state.data.tasks.filter(task=>task.ticketFolio===t.folio);
 const url=safeEvidenceUrl(t.evidenceUrl);
 const ticketStatuses=['NUEVA','ASIGNADA','ACEPTADA','EN PROCESO','EN ESPERA','PAUSADA','ESPERANDO INFO','BLOQUEADA','PENDIENTE VALIDACIÓN','CONCLUIDA','CANCELADA','ABIERTO','COBRANZA','APROBADA','CERRADO'];
 const ownerOptions='<option value="">Sin asignar</option>'+state.personnel.map(p=>`<option value="${e(p.name)}" ${normalized(p.name)===normalized(t.owner)?'selected':''}>${e(p.name)}</option>`).join('');
 const statusOptions=unique([t.status,...ticketStatuses]).map(value=>`<option value="${e(value)}" ${normalized(value)===normalized(t.status)?'selected':''}>${e(value)}</option>`).join('');
 const completed=tasks.filter(taskComplete).length;
 const cancelled=tasks.filter(x=>['cancelada','cancelado'].includes(normalized(x.status))).length;
 const pending=tasks.filter(x=>!taskClosed(x)).length;
 const blocked=tasks.filter(x=>!taskClosed(x)&&normalized(x.status)==='bloqueada').length;
 const overdue=tasks.filter(x=>!taskClosed(x)&&x.dueAt&&x.dueAt<today).length;
 const applicable=Math.max(0,tasks.length-cancelled);
 const progress=applicable?Math.round(completed/applicable*100):0;
 const activityList=[...tasks].sort((a,b)=>Number(taskClosed(a))-Number(taskClosed(b))||(a.dueAt||'9999').localeCompare(b.dueAt||'9999'));
 openDetail(detailHeader('SEGUIMIENTO DEL SERVICIO','Ticket #'+t.folio)+
 `<div class="detail-heading-title"><h3>${e(t.title||'Sin título')}</h3><div class="detail-badges">${badge(t)}${priority(t)}${isOverdue(t,today)?'<span class="badge red">Fuera de plazo</span>':''}</div></div>
 <div class="detail-grid">${[['Cliente',t.client],['Unidad de negocio',t.businessUnit],['Área',t.area],['Etapa',t.stage],['Responsable del ticket',t.owner],['Estado del ticket',t.status],['Inicio',fmt(t.openedAt,true)],['Meta de cierre',fmt(t.dueAt,true)],['Cierre real',fmt(t.closedAt,true)],['Modelo',t.model],['Número de serie',t.serial]].map(([l,v])=>detailField(l,v)).join('')}</div>
 <section class="detail-section"><div class="detail-section-actions"><h3>Actualizar seguimiento</h3><span class="number-badge">Supabase</span></div>
 <div class="filter-fields">
   <label class="field">Estado<select id="ticketEditStatus">${statusOptions}</select></label>
   <label class="field">Etapa<input id="ticketEditStage" value="${e(t.stage)}" maxlength="120" placeholder="Ej. En diagnóstico"></label>
   <label class="field">Nivel de atención<select id="ticketEditPriority"><option value="">Sin nivel</option>${[1,2,3,4].map(p=>`<option value="${p}" ${String(t.priority)===String(p)?'selected':''}>Nivel ${p}</option>`).join('')}</select></label>
   <label class="field">Responsable<select id="ticketEditOwner">${ownerOptions}</select></label>
 </div>
 <div class="detail-section-actions" style="margin-top:14px"><span class="muted">Los cambios se guardan directamente en Supabase.</span><button class="button small primary" data-action="save-ticket-update" data-id="${e(t.id)}">Guardar cambios</button></div></section>
 <section class="detail-section"><h3>Bitácora</h3><p class="note-text">${e(t.log||'No hay bitácora registrada.')}</p></section>
 <section class="detail-section"><h3>Diagnóstico y trabajos realizados</h3><p class="note-text">${e(t.diagnosis||'No hay diagnóstico registrado.')}</p></section>
 <section class="detail-section activity-section"><div class="detail-section-actions"><div><h3>Actividades del ticket <span class="number-badge">${tasks.length}</span></h3><p class="muted" style="font-size:10px;margin-top:4px">${completed} completadas · ${pending} pendientes${cancelled?' · '+cancelled+' canceladas':''}</p></div><button class="button small primary" data-action="new-task" data-folio="${e(t.folio)}">+ Agregar actividad</button></div>
 <div class="activity-progress"><div class="activity-progress-top"><strong>${progress}%</strong><span>avance de actividades</span>${blocked?'<span class="badge red">'+blocked+' bloqueadas</span>':''}${overdue?'<span class="badge red">'+overdue+' vencidas</span>':''}</div><div class="activity-progress-track"><i style="width:${progress}%"></i></div></div>
 <div class="detail-tasks">${activityList.length?activityList.map(task=>taskRow(task,true)).join(''):'<p class="definition-note">Este ticket todavía no tiene actividades. Agrega la primera para comenzar su gestión operativa.</p>'}</div></section>
 <section class="detail-section"><h3>Documentación y evidencias</h3><div class="evidence-box"><p>${url?'El ticket tiene un enlace registrado.':'No hay un enlace de carpeta registrado para este ticket.'}</p>${url?`<a class="button secondary" href="${e(url)}" target="_blank" rel="noopener noreferrer">Abrir carpeta ${icon('external')}</a>`:''}</div><p class="definition-note">${t.sourceRow?'Origen histórico: Excel TICKETS, fila '+e(t.sourceRow)+'.':'Registro operativo almacenado en Supabase.'}</p></section>`);
}
function showTaskDetail(id){
 const task=state.data.tasks.find(t=>t.id===id);if(!task)return;
 const ticket=state.data.tickets.find(t=>t.folio===task.ticketFolio);
 if(!ticket)return;
 const ownerOptions=state.personnel.map(p=>`<option value="${e(p.name)}" ${normalized(p.name)===normalized(task.owner)?'selected':''}>${e(p.name)}</option>`).join('');
 const statuses=['SIN INICIAR','EN PROCESO','EN ESPERA','BLOQUEADA','COMPLETADA','CANCELADA'];
 const statusOptions=unique([task.status,...statuses]).map(value=>`<option value="${e(value)}" ${normalized(value)===normalized(task.status)?'selected':''}>${e(value)}</option>`).join('');
 const outcomes=['','REALIZADA','NO REALIZADA','CANCELADA POR CLIENTE','TÉCNICO NO PUDO ACUDIR','REPROGRAMADA','OTRO'];
 const outcomeOptions=unique([task.outcome,...outcomes]).map(value=>`<option value="${e(value)}" ${normalized(value)===normalized(task.outcome)?'selected':''}>${e(value||'Seleccionar resultado')}</option>`).join('');
 const resolutionBadge=task.outcome?`<span class="badge ${activityOutcomeTone(task.outcome)}">${e(task.outcome)}</span>`:'';
 openDetail(detailHeader('ACTIVIDAD DEL TICKET','Ticket #'+task.ticketFolio)+
 `<div class="detail-heading-title"><h3>${e(task.title||'Actividad sin descripción')}</h3><div class="detail-badges"><span class="badge ${activityStatusTone(task)}">${e(taskComplete(task)?'COMPLETADA':(task.status||'SIN INICIAR'))}</span><span class="badge ${activityTypeTone(task)}">${e(activityType(task))}</span>${resolutionBadge}</div></div>
 <div class="detail-grid">${[['Ticket','#'+task.ticketFolio],['Cliente',ticket.client],['Responsable',task.owner],['Área',task.area],['Tipo',activityType(task)],['Referencia',task.reference],['Inicio',fmt(task.startAt,true)],['Fecha compromiso',fmt(task.dueAt,true)],['Realización',fmt(task.completedAt,true)],['Estado',task.status]].map(([l,v])=>detailField(l,v)).join('')}</div>
 <section class="detail-section">${progressMarkup(task)}</section>
 <section class="detail-section activity-requirement"><h3>Requerimiento / observaciones</h3><p class="note-text">${e(task.notes||'No hay observaciones registradas.')}</p><p class="definition-note">Aquí se conserva lo que se solicitó hacer y las indicaciones originales de la actividad.</p></section>
 <section class="detail-section activity-resolution ${task.resolution?'has-resolution':''}"><div class="detail-section-actions"><h3>Resolución / resultado</h3>${task.outcome?`<span class="badge ${activityOutcomeTone(task.outcome)}">${e(task.outcome)}</span>`:''}</div><p class="note-text">${e(task.resolution||'La actividad todavía no tiene una resolución registrada.')}</p><p class="definition-note">Este apartado describe qué ocurrió realmente al ejecutar o cerrar la actividad.</p></section>
 <section class="detail-section"><div class="detail-section-actions"><h3>Actualizar actividad</h3><span class="number-badge">${e(task.platformId||'Supabase')}</span></div>
 <div class="filter-fields">
   <label class="field full-width">Actividad<input id="taskEditTitle" value="${e(task.title)}" maxlength="180"></label>
   <label class="field">Categoría general<select id="taskEditCategory">${categoryOptions(task.category)}</select></label>
   <label class="field">Tipo<input id="taskEditType" list="activityTypeList" value="${e(activityType(task))}" maxlength="80"></label>
   <label class="field">Responsable<select id="taskEditOwner">${ownerOptions}</select></label>
   <label class="field">Estado<select id="taskEditStatus">${statusOptions}</select></label>
   <label class="field">Prioridad<select id="taskEditPriority"><option value="">Normal</option><option value="1" ${task.priority==='1'?'selected':''}>Alta</option><option value="2" ${task.priority==='2'?'selected':''}>Media</option><option value="3" ${task.priority==='3'?'selected':''}>Baja</option></select></label>
   <label class="field">Fecha de inicio<input id="taskEditStart" type="date" value="${e(task.startAt||'')}"></label>
   <label class="field">Fecha compromiso<input id="taskEditDue" type="date" value="${e(task.dueAt||'')}"></label>
   <label class="field">Referencia<input id="taskEditReference" value="${e(task.reference||'')}" maxlength="100"></label>
   ${checklistEditor('taskEditChecklist',task.category,task.checklist||[])}
   <label class="field full-width">Observaciones / requerimiento<textarea id="taskEditNotes" rows="4" maxlength="2000" placeholder="Qué se requiere hacer, alcance, indicaciones...">${e(task.notes||'')}</textarea></label>
   <label class="field">Resultado de la actividad<select id="taskEditOutcome">${outcomeOptions}</select></label>
   <label class="field full-width">Resolución<textarea id="taskEditResolution" rows="5" maxlength="3000" placeholder="Qué se hizo, qué se encontró, por qué no se realizó, cancelación del cliente, reprogramación, etc.">${e(task.resolution||'')}</textarea></label>
 </div>
 <p class="definition-note">Al marcar una actividad como COMPLETADA o CANCELADA, registra también su resultado y resolución para conservar la trazabilidad.</p>
 <div class="detail-section-actions" style="margin-top:14px"><button class="button secondary" data-action="ticket" data-id="${e(ticket.id)}">Volver al ticket #${e(ticket.folio)}</button><button class="button small primary" data-action="save-task-update" data-id="${e(task.id)}">Guardar actividad</button></div></section>`);
}
function showEquipment(serial){const list=state.data.tickets.filter(t=>normalized(t.serial)===normalized(serial));const models=unique(list.map(t=>t.model));openDetail(detailHeader('SERVICIOS REGISTRADOS','Serie '+serial)+`<div class="detail-heading-title"><h3>${models.map(e).join(' · ')||'Modelo sin registrar'}</h3><p class="definition-note">Modelos tal como figuran en los tickets. El Excel no documenta necesariamente el motivo de sus diferencias.</p></div><div class="detail-section"><h3>${list.length} tickets asociados</h3>${sortRecent(list).map(t=>`<button class="task-row" data-action="ticket" data-id="${t.id}"><span class="entity-icon">${icon('ticket')}</span><span class="task-row-title">#${e(t.folio)} · ${e(t.title)}<small>${fmt(t.openedAt,true)} · ${e(t.client)}</small></span><span>${badge(t)}</span></button>`).join('')}</div>`);}
function showSource(){const m=state.data.metadata;openDetail(detailHeader('INFORMACIÓN DE DATOS','Fuente operativa')+`<div class="dialog-body"><p>La operación actual se consulta desde Supabase. El Excel se conserva como fuente histórica de los tickets migrados.</p><div class="source-list">${[['Archivo',m.sourceFile],['Modificado en origen',fmt(m.sourceModifiedAt,true)],['Importado',fmt(m.importedAt,true)],['Tickets',n(m.counts.tickets)],['Actividades operativas',n(m.counts.tasks)],['Actividades históricas archivadas',n(m.archivedTaskCount||0)],['Actividades sin descripción',n(m.quality.tasksWithoutTitle)],['Estados sin clasificar',n(state.data.tickets.filter(t=>!isKnownStatus(t)).length)]].map(([label,value])=>`<div class="source-item"><span>${label}</span><strong>${e(value)}</strong></div>`).join('')}</div><p class="definition-note">Activos: estados reconocidos que no están cerrados ni cancelados. Fuera de plazo: tickets activos con meta anterior al ${fmt(today,true)}. Una carpeta enlazada no acredita que contenga evidencias.</p><p class="definition-note">Área, etapa, responsable y estado se conservan del Excel. Los filtros por fecha muestran registros del periodo; no reconstruyen cómo estaban los tickets en esa fecha.</p><details class="extra-details"><summary>Hojas conservadas del archivo</summary><div class="source-list">${m.sheets.map(s=>`<div class="source-item"><span>${e(s.name)}</span><strong>${n(s.nonemptyRows)} filas con contenido</strong></div>`).join('')}</div><p>Las hojas de referencia, instrucciones, resumen y calendario se conservan como datos de origen. Los tickets se calculan desde TICKETS. Las tareas operativas se calculan únicamente desde TAREAS_PLATAFORMA; la hoja TAREAS anterior se conserva como histórico y no participa en los indicadores.</p></details><button class="button secondary" data-action="install" style="margin-top:22px">Instalar en el teléfono ${icon('download')}</button></div>`);}

function getSavedViews(){try{const data=JSON.parse(localStorage.getItem(config.storageKey)||'[]');return Array.isArray(data)?data.filter(v=>typeof v.name==='string'&&v.filters&&typeof v.filters==='object').slice(0,10):[];}catch{return [];}}
function renderSavedViews(){const list=getSavedViews();$('savedViews').innerHTML='<option value="">Mis vistas</option>'+list.map((v,i)=>`<option value="${i}">${e(v.name)}</option>`).join('');}
function exportView(){let records,columns,label;if(state.view==='calendar'){const tickets=calendarTicketSet(filtered());const {first,last}=monthRange(state.calendarMonth||today.slice(0,7));const activities=calendarActivityTasks(filtered()).filter(t=>t.startAt&&t.startAt<=last&&(t.dueAt&&t.dueAt>=t.startAt?t.dueAt:t.startAt)>=first).map(t=>({...t,durationDays:daysInclusive(t.startAt,t.dueAt&&t.dueAt>=t.startAt?t.dueAt:t.startAt)}));records=[...tickets.filter(t=>t.openedAt>=first&&t.openedAt<=last).map(t=>({recordType:'TICKET',folio:t.folio,client:t.client,title:t.title,owner:t.owner,start:t.openedAt,due:'',durationDays:1,status:t.status})),...activities.map(t=>({recordType:'ACTIVIDAD',folio:t.ticketFolio,client:t.client,title:t.title,owner:t.owner,start:t.startAt,due:t.dueAt,durationDays:t.durationDays,status:t.status}))];columns=[['recordType','Tipo'],['folio','Ticket'],['client','Cliente'],['title','Concepto'],['owner','Responsable'],['start','Inicio'],['due','Fecha compromiso'],['durationDays','Duración días'],['status','Estado']];label='calendario_'+(state.calendarMonth||today.slice(0,7));}else if(state.view==='tasks'){records=currentTasks().map(task=>({...task,category:taskCategoryLabel(taskCategory(task))}));columns=[['ticketFolio','Ticket'],['category','Tipo'],['title','Actividad'],['client','Cliente / tercero'],['reference','Referencia'],['owner','Responsable'],['area','Área'],['startAt','Inicio'],['dueAt','Fin programado'],['status','Estado'],['completedAt','Realización'],['notes','Observaciones / requerimiento'],['outcome','Resultado'],['resolution','Resolución']];label='actividades';}else if(state.view==='team'){records=state.personnel.map(p=>{const w=personWorkload(p);return {...p,pendingTasks:w.pending.length,overdueTasks:w.overdue.length,assignedTasks:w.assignedTasks.length,ownedTickets:w.ownedTickets.length};});columns=[['name','Nombre'],['title','Cargo'],['area','Área'],['parentArea','Área principal'],['fieldRole','Rol de campo'],['ownedTickets','Tickets'],['assignedTasks','Tareas'],['pendingTasks','Pendientes'],['overdueTasks','Vencidas']];label='personal';}else if(state.view==='clients'&&state.clientTab==='directory'){records=selectedContacts();columns=[['name','Contacto'],['company','Compañía'],['role','Cargo'],['email','Correo'],['phone','Teléfono'],['address','Dirección'],['city','Ciudad'],['region','Estado']];label='contactos';}else{records=filtered();columns=[['folio','Folio'],['priority','Nivel SLA'],['title','Título'],['client','Cliente'],['businessUnit','Unidad de negocio'],['area','Área'],['stage','Etapa'],['owner','Responsable'],['openedAt','Inicio'],['dueAt','Meta de cierre'],['closedAt','Cierre real'],['model','Modelo'],['serial','Serie'],['status','Estado'],['log','Bitácora'],['diagnosis','Diagnóstico'],['evidenceUrl','Carpeta']];label='tickets';}const blob=new Blob([toCsv(records,columns.map(([key,label])=>({key,label})))],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`SUDMAR_${label}_${today}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast(`${n(records.length)} registros exportados a CSV.`);}
async function install(){if(installEvent){await installEvent.prompt();installEvent=null;return;}openDetail(detailHeader('ACCESO DESDE EL TELÉFONO','Instalar SUDMAR')+`<div class="dialog-body"><p>Cuando la plataforma esté disponible en una dirección HTTPS, podrás añadirla a la pantalla de inicio.</p><div class="source-list"><div class="source-item"><span>Android</span><strong>Menú del navegador → Instalar app o Añadir a pantalla de inicio.</strong></div><div class="source-item"><span>iPhone / iPad</span><strong>Safari → Compartir → Añadir a pantalla de inicio.</strong></div></div><p class="definition-note">Un archivo descargado o una vista previa local no permite la instalación completa. La consulta de datos requiere conexión; esta versión no permite editar sin conexión.</p></div>`);}

document.addEventListener('click',event=>{const b=event.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;if(!state.data&&!['close-dialog'].includes(a))return;
 if(a==='navigate')navigate(b.dataset.view);
 if(a==='filters')openFilters();
 if(a==='add-work'){
   const editor=b.closest('.work-editor');
   if(readChecklist(editor).length>=MAX_WORK_ITEMS)return;
   editor.querySelector('.work-items').insertAdjacentHTML('beforeend',workItemRow({id:crypto.randomUUID(),text:'',completed:false}));
   updateWorkSummary(editor);editor.querySelector('.work-item:last-child .work-text').focus();
 }
 if(a==='remove-work'){const editor=b.closest('.work-editor');b.closest('.work-item').remove();updateWorkSummary(editor);}
 if(a==='new-ticket')openNewTicket();
 if(a==='new-task')openNewTask(b.dataset.folio||'');
 if(a==='close-dialog')b.closest('dialog')?.close();
 if(a==='clear')clearFilters();
 if(a==='remove-filter'){state.filters[b.dataset.key]=blankFilters()[b.dataset.key];state.page=1;render();}
 if(a==='filter')setFilter(b.dataset.key,b.dataset.value);
 if(a==='ticket')showTicketDetail(b.dataset.id);
 if(a==='save-ticket-update'){(async()=>{b.disabled=true;try{await repository.updateTicket(b.dataset.id,{status:$('ticketEditStatus')?.value||'',stage:$('ticketEditStage')?.value||'',priority:$('ticketEditPriority')?.value||'',owner:$('ticketEditOwner')?.value||''});await refreshOperationalData();showTicketDetail(b.dataset.id);toast('Ticket actualizado en Supabase.');}catch(err){toast(err.message||'No se pudo actualizar el ticket.');}finally{b.disabled=false;}})();}
 if(a==='task'){showTaskDetail(b.dataset.id);updateWorkSummary($('taskEditChecklist'));}
 if(a==='save-task-update'){(async()=>{
  b.disabled=true;
  try{
    const task=state.data.tasks.find(t=>t.id===b.dataset.id);
    const selectedOwner=$('taskEditOwner')?.value||'';
    const selectedStatus=$('taskEditStatus')?.value||'SIN INICIAR';
    const outcome=$('taskEditOutcome')?.value||'';
    const resolution=clean($('taskEditResolution')?.value||'');
    const closing=['COMPLETADA','CANCELADA'].includes(selectedStatus.toUpperCase());
    if(closing&&!outcome) throw new Error('Selecciona el resultado de la actividad antes de cerrarla.');
    if(closing&&!resolution) throw new Error('Registra la resolución de la actividad antes de cerrarla.');
    const person=state.personnel.find(p=>normalized(p.name)===normalized(selectedOwner));
    const changes={
      category:$('taskEditCategory').value||null,
      checklist:validateChecklist(readChecklist($('taskEditChecklist'))),
      title:$('taskEditTitle')?.value||'',
      taskType:$('taskEditType')?.value||'',
      owner:selectedOwner,
      area:selectedOwner===task.owner ? task.area : (person?.area||task?.area||''),
      status:selectedStatus,
      priority:$('taskEditPriority')?.value||'',
      startAt:$('taskEditStart')?.value||'',
      dueAt:$('taskEditDue')?.value||'',
      reference:$('taskEditReference')?.value||'',
      notes:$('taskEditNotes')?.value||'',
      outcome,
      resolution
    };
    validateActivity(changes);
    // Leave unchanged dates and completion timestamps exactly as stored.
    for(const key of ['title','taskType','owner','area','status','priority','startAt','dueAt','reference','notes','outcome','resolution'])if(changes[key]===(task[key]||''))delete changes[key];
    await repository.updateTask(b.dataset.id,changes,task.updatedAt);
    await refreshOperationalData();
    showTaskDetail(b.dataset.id);
    updateWorkSummary($('taskEditChecklist'));
    toast('Actividad actualizada con su resolución.');
  }catch(err){toast(err.message||'No se pudo actualizar la actividad.');}
  finally{b.disabled=false;}
 })();}
 if(a==='equipment')showEquipment(b.dataset.value);
 if(a==='team-person'){state.taskOwner=b.dataset.person;state.taskStatus='pending';state.taskCategory='';navigate('tasks');}
 if(a==='task-category'){state.taskCategory=b.dataset.category||'';state.taskStatus='pending';state.taskOwner='';navigate('tasks');}
 if(a==='calendar-month-shift'){state.calendarMonth=shiftMonth(state.calendarMonth||today.slice(0,7),Number(b.dataset.delta)||0);render();}
 if(a==='calendar-today'){state.calendarMonth=today.slice(0,7);render();}
 if(a==='source')showSource();
 if(a==='export')exportView();
 if(a==='install')install();
 if(a==='page'){state.page+=Number(b.dataset.delta);render();window.scrollTo({top:160,behavior:'instant'});}
 if(a==='quick'){state.filters.status=b.dataset.key==='wait'?'EN ESPERA':b.dataset.key==='collection'?'COBRANZA':'';state.filters.activeOnly=b.dataset.key==='active';state.filters.overdue=false;state.page=1;render();}
 if(a==='kpi'){const key=b.dataset.key;if(key==='tasks'){state.taskStatus='pending';state.taskOwner='';state.taskCategory='';navigate('tasks');}else{if(key==='active')state.filters.activeOnly=true;if(key==='overdue')state.filters.overdue=true;navigate('tickets');}}
 if(a==='month'){state.filters.from=b.dataset.value+'-01';const [y,m]=b.dataset.value.split('-').map(Number);state.filters.to=`${y}-${String(m).padStart(2,'0')}-${new Date(y,m,0).getDate()}`;navigate('tickets');}
 if(a==='client-tab'){state.clientTab=b.dataset.value;state.page=1;render();}
 if(a==='retry-references'){state.referenceError=false;loadReferences();render();}
 if(a==='save-view'){if($('filtersDialog').open&&!applyFormFilters(false))return;$('saveDialog').showModal();}
});
$('filterForm').addEventListener('submit',event=>{event.preventDefault();applyFormFilters();});
$('newTicketForm').addEventListener('submit',submitNewTicket);
$('newTaskForm').addEventListener('submit',submitNewTask);
$('globalSearch').addEventListener('input',event=>{clearTimeout(searchTimer);const value=event.target.value;searchTimer=setTimeout(()=>{state.filters.q=value;state.page=1;render();},160);});
document.addEventListener('change',event=>{
 if(event.target.matches('.work-completed'))updateWorkSummary(event.target.closest('.work-editor'));
 if(['newTaskCategory','taskEditCategory'].includes(event.target.id)){
   const editor=$(event.target.id==='newTaskCategory'?'newTaskChecklist':'taskEditChecklist');
   editor.hidden=event.target.value!=='OPERACIONES';updateWorkSummary(editor);
 }
 if(event.target.id==='taskStatus'){state.taskStatus=event.target.value;state.page=1;render();}
 if(event.target.id==='taskOwner'){state.taskOwner=event.target.value;state.page=1;render();}
 if(event.target.id==='taskCategory'){state.taskCategory=event.target.value;state.page=1;render();}
 if(event.target.id==='calendarMonthPicker'){state.calendarMonth=event.target.value||today.slice(0,7);render();}
 if(event.target.id==='calendarOwner'){state.calendarOwner=event.target.value;render();}
 if(event.target.id==='calendarClient'){state.calendarClient=event.target.value;render();}
 if(event.target.id==='calendarKind'){state.calendarKind=event.target.value;render();}
 if(event.target.id==='calendarActivityStatus'){state.calendarActivityStatus=event.target.value;render();}
 if(event.target.id==='newTicketOwner'){const person=state.personnel.find(p=>p.name===event.target.value);if(person&&$('newTicketArea'))$('newTicketArea').value=person.area;}
 if(event.target.id==='newTaskOwner'){const person=state.personnel.find(p=>p.name===event.target.value);if($('newTaskArea'))$('newTaskArea').value=person?.area||'';}
});
document.addEventListener('input',event=>{
 if(event.target.id==='newTaskTicketSearch'){
   const selected=$('newTaskTicket')?.value||'';
   renderActivityTicketOptions(event.target.value,selected);
 }
 if(event.target.id==='contactSearch'){
   clearTimeout(searchTimer);
   const value=event.target.value,position=event.target.selectionStart;
   searchTimer=setTimeout(()=>{state.contactQuery=value;state.page=1;render();const el=$('contactSearch');el?.focus();el?.setSelectionRange(position,position);},180);
 }
});
$('saveViewForm').addEventListener('submit',event=>{event.preventDefault();const name=clean(new FormData(event.target).get('viewName'));if(!name)return;const saved=getSavedViews().filter(v=>v.name!==name);saved.unshift({name,filters:{...state.filters},view:state.view});try{localStorage.setItem(config.storageKey,JSON.stringify(saved.slice(0,10)));$('saveDialog').close();renderSavedViews();toast('Vista guardada en este navegador.');}catch{toast('El navegador no permitió guardar esta vista.');}});
$('savedViews').addEventListener('change',event=>{if(event.target.value==='')return;const view=getSavedViews()[Number(event.target.value)];if(!view)return;const defaults=blankFilters();for(const key of Object.keys(defaults)){if(typeof view.filters[key]===typeof defaults[key])defaults[key]=view.filters[key];}state.filters=defaults;navigate(view.view||'dashboard');});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&!document.querySelector('dialog[open]')){event.preventDefault();$('globalSearch').focus();}});
window.addEventListener('popstate',()=>{readLocation();render();});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installEvent=event;});

async function init(){hydrateIcons();document.documentElement.style.setProperty('--primary',config.brand.primary);document.documentElement.style.setProperty('--accent',config.brand.accent);document.querySelectorAll('[data-brand-name]').forEach(el=>el.textContent=config.brand.name);document.querySelectorAll('[data-brand-mark]').forEach(el=>{el.textContent=config.brand.initials;if(config.brand.logoUrl){const img=new Image();img.src=config.brand.logoUrl;img.alt=config.brand.name;img.onload=()=>el.replaceChildren(img);}});renderSavedViews();readLocation();try{const [operationData,people]=await Promise.all([repository.load(),repository.personnel().catch(()=>[])]);state.data=operationData;state.personnel=people;$('sourceDate').textContent=(state.data.metadata.mode==='supabase'?'Supabase en línea · ':'Datos actualizados · ')+fmt(state.data.metadata.sourceModifiedAt||state.data.metadata.importedAt,true);$('sourceTotals').textContent=`${n(state.data.tickets.length)} tickets · ${n(state.data.tasks.length)} actividades`;$('exportButton').disabled=false;render();}catch(error){$('sourceDate').textContent='Datos no disponibles';$('content').innerHTML=`<div class="panel empty-state">${icon('alert')}<h2>No pudimos cargar la operación</h2><p>${e(error.message)} Revisa tu conexión e inténtalo nuevamente.</p><button class="button primary" id="retryLoad">Reintentar</button></div>`;$('retryLoad').addEventListener('click',init);}if('serviceWorker'in navigator&&!globalThis.__SUDMAR_SNAPSHOT__&&location.protocol!=='file:'){navigator.serviceWorker.register('./sw.js').catch(()=>{/* Read access still works without installation support. */});}}
init();

