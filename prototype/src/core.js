// Pure domain functions: the UI, a future API adapter and tests share these rules.
export const normalized = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const clean = value => String(value ?? '').trim();
export const MULTI_FILTER_KEYS=Object.freeze(['status','priority','area','owner','client','businessUnit']);
export const blankFilters = () => ({ q: '', folio: '', priority: '', client: '', businessUnit: '', area: '', equipmentType:'', owner: '', status: '', model: '', serial: '', from: '', to: '', dateField: 'openedAt', overdue: false, activeOnly: false });
const terminal = new Set(['cerrado', 'cancelado', 'cancelada', 'aprobada', 'aprobado', 'concluida', 'concluido']);
const known = new Set(['registrado','programado','en ejecucion','bloqueado','pendiente de validacion','abierto', 'cerrado', 'cancelado', 'cancelada', 'en espera', 'cobranza', 'inactivo', 'consigna', 'nueva', 'asignada', 'aceptada', 'en proceso', 'pausada', 'esperando info', 'bloqueada', 'pendiente validacion', 'pendiente validación', 'aprobada', 'aprobado', 'concluida', 'concluido']);
export const isKnownStatus = t => known.has(normalized(t.status));
export const isClosed = t => terminal.has(normalized(t.status));
export const isActive = t => isKnownStatus(t) && !isClosed(t);
export const isOverdue = (t, today) => isActive(t) && Boolean(t.dueAt) && t.dueAt < today;
export const taskComplete = t => (t.statusGroup==='CERRADA'&&!t.isCancelled) || t.checked === true || ['completas', 'completa', 'completada', 'concluida'].includes(normalized(t.status));
export const taskClosed = t => t.statusGroup==='CERRADA' || taskComplete(t) || ['cancelada','cancelado'].includes(normalized(t.status));
export const validSerial = value => !['', '-', 'na', 'n/a', 's/n', 'sn', 'no aplica', 'sin serie', 'sin numero de serie', 'pendiente', 'varios', '#n/a'].includes(normalized(value));
export const unique = items => [...new Set(items.filter(v => v !== null && v !== undefined && clean(v) !== '').map(clean))].sort((a,b) => a.localeCompare(b,'es',{numeric:true}));

export function ticketSerials(t) {
  return t.isMultiEquipment && t.linkedEquipment?.length ? unique(t.linkedEquipment.map(x=>x.serial)) : (t.serial?[t.serial]:[]);
}
export function ticketModels(t) {
  return t.isMultiEquipment && t.linkedEquipment?.length ? unique(t.linkedEquipment.map(x=>x.model)) : (t.model?[t.model]:[]);
}
export function filterTickets(tickets, filters, today) {
  const query = normalized(filters.q);
  return tickets.filter(t => {
    if (query && ![t.folio,t.title,t.client,t.model,t.serial,...ticketModels(t),...ticketSerials(t),t.log,t.diagnosis].some(v=>normalized(v).includes(query))) return false;
    if (filters.folio && !normalized(t.folio).includes(normalized(filters.folio))) return false;
    if(filters.serial&&filters.serial!=='__EMPTY__'&&!ticketSerials(t).some(v=>clean(v)===clean(filters.serial)))return false;
    if(filters.model&&filters.model!=='__EMPTY__'&&!ticketModels(t).some(v=>clean(v)===clean(filters.model)))return false;
    for (const key of ['priority','client','businessUnit','area','equipmentType','owner','status']) {
      const selection=filters[key];
      if(Array.isArray(selection)){
        // Opciones del mismo filtro: OR; filtros diferentes: AND.
        if(!selection.some(v=>typeof v==='string'&&(v==='__EMPTY__'?clean(t[key])==='':clean(t[key])===v)))return false;
      }else{
        if(selection==='__EMPTY__'&&clean(t[key])!=='')return false;
        if(selection&&selection!=='__EMPTY__'&&clean(t[key])!==selection)return false;
      }
    }
    const date = t[['openedAt','dueAt','closedAt'].includes(filters.dateField) ? filters.dateField : 'openedAt'];
    if (filters.from && (!date || date < filters.from)) return false;
    if (filters.to && (!date || date > filters.to)) return false;
    if (filters.activeOnly && !isActive(t)) return false;
    return !filters.overdue || isOverdue(t,today);
  });
}

export function linkedTasks(tickets, tasks) {
  const folios = new Set(tickets.map(t=>t.folio));
  return tasks.filter(t=>folios.has(t.ticketFolio));
}

export function metrics(tickets, tasks, today) {
  const associated = linkedTasks(tickets,tasks);
  return {total:tickets.length, active:tickets.filter(isActive).length,
    closed:tickets.filter(isClosed).length, overdue:tickets.filter(t=>isOverdue(t,today)).length,
    priority1:tickets.filter(t=>isActive(t)&&t.priority==='1').length,
    pendingTasks:associated.filter(t=>!taskClosed(t)).length, tasks:associated.length,
    unknown:tickets.filter(t=>!isKnownStatus(t)).length};
}

export function countsBy(items, key) {
  const counts = new Map();
  for (const item of items) {const value=clean(item[key])||'Sin registrar'; counts.set(value,(counts.get(value)||0)+1);}
  return [...counts].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'es'));
}

export function equipmentGroups(tickets) {
  const groups = new Map();
  for (const ticket of tickets) {
    for(const serial of ticketSerials(ticket)){
      if(!validSerial(serial))continue;
      const key=normalized(serial);
      if(!groups.has(key))groups.set(key,{key,serial,tickets:[]});
      if(!groups.get(key).tickets.some(x=>x.id===ticket.id))groups.get(key).tickets.push(ticket);
    }
  }
  return [...groups.values()].map(g=>({...g,models:unique(g.tickets.flatMap(ticketModels)),clients:unique(g.tickets.map(t=>t.client))}));
}

export function safeEvidenceUrl(value) {
  if (!value) return null;
  try { const u=new URL(value); return ['http:','https:'].includes(u.protocol)?u.href:null; } catch {return null;}
}

export function toCsv(records, columns) {
  const cell = value => {
    let s=String(value??'');
    if (/^[\s]*[=+\-@]/.test(s)||/^[\t\r]/.test(s)) s="'"+s;
    return '"'+s.replaceAll('"','""')+'"';
  };
  return '\ufeff'+[columns.map(c=>cell(c.label)).join(';'),...records.map(r=>columns.map(c=>cell(r[c.key])).join(';'))].join('\r\n');
}


export function taskCategory(task) {
  const explicit=normalized(task.taskType);
  if (explicit) {
    if (['compra','compras'].includes(explicit)) return 'COMPRA';
    if (['cobranza','cobro'].includes(explicit)) return 'COBRANZA';
    if (['facturacion','facturación','factura'].includes(explicit)) return 'FACTURACION';
    if (['visita','diagnostico','diagnóstico','operativa','servicio','campo'].includes(explicit)) return 'CAMPO';
    if (['cotizacion','cotización'].includes(explicit)) return 'COTIZACION';
    if (['seguimiento','administrativa','administrativo'].includes(explicit)) return 'SEGUIMIENTO';
  }
  const text=normalized([task.title,task.notes,task.reference,task.client].filter(Boolean).join(' '));
  if (/\b(cobrar|cobranza|cobro|recuperar pago|pago pendiente)\b/.test(text)) return 'COBRANZA';
  if (/\b(factura|facturar|facturacion|cfdi)\b/.test(text)) return 'FACTURACION';
  if (/\b(cotizar|cotizacion|presupuesto)\b/.test(text)) return 'COTIZACION';
  if (/\b(comprar|compra|insumo|proveedor|refaccion|refacciones|material|pedido)\b/.test(text)) return 'COMPRA';
  if (/\b(visita|servicio|diagnostico|prueba|pruebas|instalacion|instalar|campo|arranque|mantenimiento)\b/.test(text)) return 'CAMPO';
  return 'SEGUIMIENTO';
}
