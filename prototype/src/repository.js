import {validateActivity, validateChecklist, activityCategories} from './checklist.js';
import {config} from './config.js';

const dateOnly = value => value ? String(value).slice(0,10) : null;

function supabaseHeaders(extra={}) {
  const key=config.supabase?.publishableKey;
  return {
    apikey:key,
    Authorization:`Bearer ${key}`,
    Accept:'application/json',
    'Content-Type':'application/json',
    ...extra,
  };
}

async function supabaseRequest(path, options={}) {
  const base=config.supabase?.url?.replace(/\/$/,'');
  const key=config.supabase?.publishableKey;
  if (!base || !key) throw new Error('Supabase no está configurado.');
  const response=await fetch(base+path,{
    cache:'no-store',
    ...options,
    headers:supabaseHeaders(options.headers||{}),
  });
  if (!response.ok) {
    let message='No se pudo completar la operación en Supabase.';
    try {
      const body=await response.json();
      message=body?.message||body?.hint||body?.details||message;
    } catch {}
    throw new Error(message);
  }
  if (response.status===204) return null;
  const text=await response.text();
  return text ? JSON.parse(text) : null;
}

async function fetchSupabaseTable(table, select, extra='') {
  return supabaseRequest(`/rest/v1/${table}?select=${encodeURIComponent(select)}${extra}`);
}

const exact = value => encodeURIComponent('eq.'+value);

export class SnapshotRepository {
  async loadSnapshot() {
    const injected = globalThis.__SUDMAR_SNAPSHOT__;
    const response = injected ? null : await fetch(config.dataUrl, {cache:'no-store'});
    if (response && !response.ok) throw new Error('No se pudo cargar el archivo de operación.');
    const data = injected || await response.json();
    if (data.metadata?.schemaVersion!==1 || !Array.isArray(data.tickets) || !Array.isArray(data.tasks)) throw new Error('El archivo de operación no tiene el formato esperado.');
    if (data.metadata?.taskSource!=='TAREAS_PLATAFORMA') {
      const archivedTaskCount=data.tasks.length;
      data.metadata={...data.metadata,taskSource:'TAREAS_PLATAFORMA',archivedTaskCount,counts:{...data.metadata.counts,tasks:0},quality:{...data.metadata.quality,tasksWithoutTitle:0,taskFoliosNotInTickets:[]}};
      data.tasks=[];
    }
    return data;
  }

  async loadSupabase() {
    const [tickets, clients, equipment, personnel, tasks] = await Promise.all([
      fetchSupabaseTable('tickets',
        'id,folio,client_id,equipment_id,owner_id,area,business_unit,stage,title,description,priority,status,opened_at,due_at,closed_at,logbook,diagnosis,folder_url,source_model,source_serial,source_row',
        '&order=folio.desc'),
      fetchSupabaseTable('clients','id,name'),
      fetchSupabaseTable('equipment','id,client_id,model,serial_number'),
      fetchSupabaseTable('personnel','id,name,role,area'),
      fetchSupabaseTable('tasks',
        'id,task_code,ticket_id,client_id,assignee_id,task_type,title,reference,area,priority,status,start_at,due_at,completed_at,notes,resolution,outcome,created_by,created_at,updated_at,category,checklist',
        '&order=created_at.desc')
    ]);

    const clientsById=new Map(clients.map(item=>[item.id,item]));
    const equipmentById=new Map(equipment.map(item=>[item.id,item]));
    const personnelById=new Map(personnel.map(item=>[item.id,item]));
    const ticketsById=new Map(tickets.map(item=>[item.id,item]));

    const mappedTickets=tickets.map(row=>{
      const client=clientsById.get(row.client_id);
      const unit=equipmentById.get(row.equipment_id);
      const owner=personnelById.get(row.owner_id);
      return {
        id: row.id,
        folio: String(row.folio??''),
        priority: String(row.priority??'').replace(/^P/i,''),
        title: row.title??'',
        client: client?.name??'',
        businessUnit: row.business_unit??'',
        area: row.area??'',
        stage: row.stage??'',
        owner: owner?.name??'',
        openedAt: dateOnly(row.opened_at),
        dueAt: dateOnly(row.due_at),
        closedAt: dateOnly(row.closed_at),
        model: row.source_model??unit?.model??'',
        serial: row.source_serial??unit?.serial_number??'',
        status: row.status??'',
        log: row.logbook??'',
        diagnosis: row.diagnosis??row.description??'',
        evidenceUrl: row.folder_url??null,
        evidenceLabel: row.folder_url?'Abrir carpeta':'',
        sourceRow: row.source_row??null,
        sourceExtra: {},
      };
    });

    const mappedTasks=tasks.map(row=>{
      const ticket=ticketsById.get(row.ticket_id);
      const client=clientsById.get(row.client_id || ticket?.client_id);
      const assignee=personnelById.get(row.assignee_id);
      return {
        id: row.id,
        platformId: row.task_code??'',
        category: row.category??null,
        checklist: row.checklist??[],
        updatedAt: row.updated_at,
        ticketFolio: ticket?.folio ? String(ticket.folio) : '',
        title: row.title??'',
        notes: row.notes??'',
        resolution: row.resolution??'',
        outcome: row.outcome??'',
        owner: assignee?.name??'',
        client: client?.name??'',
        businessUnit: '',
        stage: '',
        area: row.area??assignee?.area??'',
        model: '',
        serial: '',
        ticketStatus: ticket?.status??'',
        taskType: row.task_type??'',
        reference: row.reference??'',
        priority: row.priority??'',
        origin: 'PLATAFORMA',
        createdBy: row.created_by??'',
        createdAt: dateOnly(row.created_at),
        startAt: dateOnly(row.start_at),
        duration: null,
        dueAt: dateOnly(row.due_at),
        completedAt: dateOnly(row.completed_at),
        status: row.status??'',
        checked: ['COMPLETAS','COMPLETA','COMPLETADA','CONCLUIDA'].includes(String(row.status??'').toUpperCase()),
        sourceProgress: null,
        sourceDaysCompleted: null,
        sourceTicket: ticket ? {title:ticket.title??'',client:client?.name??'',status:ticket.status??''} : {},
      };
    });

    return {
      metadata:{
        schemaVersion:1,
        mode:'supabase',
        sourceFile:'Supabase · sudmar-service-platform',
        sourceModifiedAt:new Date().toISOString(),
        importedAt:new Date().toISOString(),
        taskSource:'TAREAS_PLATAFORMA',
        archivedTaskCount:0,
        counts:{tickets:mappedTickets.length,tasks:mappedTasks.length},
        sheets:[],
        quality:{duplicateTicketFolios:[],taskFoliosNotInTickets:[],tasksWithoutTitle:mappedTasks.filter(t=>!t.title).length},
      },
      tickets:mappedTickets,
      tasks:mappedTasks,
    };
  }

  async load() {
    if (config.features.sharedDatabase && config.supabase?.url && config.supabase?.publishableKey) {
      try {
        return await this.loadSupabase();
      } catch (error) {
        throw new Error('No se pudo cargar la operación actual de Supabase. Revisa la conexión y vuelve a intentar.', {cause:error});
      }
    }
    return this.loadSnapshot();
  }

  canWrite() {
    return Boolean(config.features.editing && config.features.sharedDatabase && config.supabase?.url && config.supabase?.publishableKey);
  }

  async lookupId(table, field, value) {
    if (!value) return null;
    const rows=await supabaseRequest(`/rest/v1/${table}?select=id&${field}=${exact(value)}&limit=1`);
    return rows?.[0]?.id??null;
  }

  async createEquipment({clientId,model,serial}) {
    if (!model && !serial) return null;
    if (serial) {
      const found=await supabaseRequest(`/rest/v1/equipment?select=id&serial_number=${exact(serial)}&limit=1`);
      if (found?.[0]?.id) return found[0].id;
    }
    const rows=await supabaseRequest('/rest/v1/equipment',{
      method:'POST',
      headers:{Prefer:'return=representation'},
      body:JSON.stringify({client_id:clientId,model:model||null,serial_number:serial||null})
    });
    return rows?.[0]?.id??null;
  }

  async createTicket(payload) {
    const clientId=await this.lookupId('clients','name',payload.client);
    if (!clientId) throw new Error('El cliente seleccionado no existe en Supabase.');
    const ownerId=payload.owner ? await this.lookupId('personnel','name',payload.owner) : null;
    const equipmentId=await this.createEquipment({clientId,model:payload.model,serial:payload.serial});
    const rows=await supabaseRequest('/rest/v1/tickets',{
      method:'POST',
      headers:{Prefer:'return=representation'},
      body:JSON.stringify({
        client_id:clientId,
        equipment_id:equipmentId,
        owner_id:ownerId,
        area:payload.area||null,
        business_unit:payload.businessUnit||null,
        title:payload.title,
        description:payload.description||null,
        priority:payload.priority ? 'P'+payload.priority : null,
        status:'NUEVA',
        stage:'Nueva',
        opened_at:payload.openedAt||null,
        due_at:payload.dueAt||null,
      })
    });
    return rows?.[0]??null;
  }

  async createTask(payload) {
    validateActivity(payload);
    if (!activityCategories.includes(payload.category)) throw new Error('Selecciona la categoría general.');
    if (!payload.ticketFolio) throw new Error('Toda actividad debe estar ligada a un ticket.');
    const tickets=await supabaseRequest(`/rest/v1/tickets?select=id,client_id&folio=${exact(payload.ticketFolio)}&limit=1`);
    if (!tickets?.[0]) throw new Error('El ticket relacionado no existe.');
    const ticketId=tickets[0].id;
    const clientId=tickets[0].client_id;
    const assigneeId=await this.lookupId('personnel','name',payload.owner);
    if (!assigneeId) throw new Error('El responsable seleccionado no existe en Supabase.');
    const rows=await supabaseRequest('/rest/v1/tasks',{
      method:'POST',
      headers:{Prefer:'return=representation'},
      body:JSON.stringify({
        ticket_id:ticketId,
        client_id:clientId,
        assignee_id:assigneeId,
        task_type:payload.taskType||'SEGUIMIENTO',
        category:payload.category,
        checklist:validateChecklist(payload.checklist||[]),
        title:payload.title,
        reference:payload.reference||null,
        area:payload.area||null,
        priority:payload.priority||null,
        status:payload.status||'SIN INICIAR',
        start_at:payload.startAt||null,
        due_at:payload.dueAt||null,
        notes:payload.notes||null,
        created_by:'Plataforma SUDMAR',
      })
    });
    return rows?.[0]??null;
  }

  async updateTask(id, changes, expectedUpdatedAt) {
    const body={updated_at:new Date().toISOString()};
    if (changes.owner!==undefined) body.assignee_id=changes.owner ? await this.lookupId('personnel','name',changes.owner) : null;
    if (changes.category!==undefined) {
      if (changes.category!==null && !activityCategories.includes(changes.category)) throw new Error('Categoría general inválida.');
      body.category=changes.category;
    }
    if (changes.checklist!==undefined) body.checklist=validateChecklist(changes.checklist);
    if (changes.taskType!==undefined) body.task_type=changes.taskType||null;
    if (changes.title!==undefined) body.title=changes.title||null;
    if (changes.reference!==undefined) body.reference=changes.reference||null;
    if (changes.area!==undefined) body.area=changes.area||null;
    if (changes.priority!==undefined) body.priority=changes.priority||null;
    if (changes.status!==undefined) {
      body.status=changes.status||'SIN INICIAR';
      if (String(body.status).toUpperCase()==='COMPLETADA') body.completed_at=new Date().toISOString();
      else body.completed_at=null;
    }
    if (changes.startAt!==undefined) body.start_at=changes.startAt||null;
    if (changes.dueAt!==undefined) body.due_at=changes.dueAt||null;
    if (changes.notes!==undefined) body.notes=changes.notes||null;
    if (changes.resolution!==undefined) body.resolution=changes.resolution||null;
    if (changes.outcome!==undefined) body.outcome=changes.outcome||null;
    const rows=await supabaseRequest(`/rest/v1/tasks?id=${exact(id)}&select=*${expectedUpdatedAt?'&updated_at='+exact(expectedUpdatedAt):''}`,{
      method:'PATCH',
      headers:{Prefer:'return=representation'},
      body:JSON.stringify(body)
    });
    if (!rows?.[0]) throw new Error('La actividad cambió en otra sesión o ya no está disponible. Recarga la página antes de volver a editarla.');
    return rows[0];
  }

  async updateTicket(id, changes) {
    const body={updated_at:new Date().toISOString()};
    if (changes.status!==undefined) body.status=changes.status||null;
    if (changes.stage!==undefined) body.stage=changes.stage||null;
    if (changes.priority!==undefined) body.priority=changes.priority ? 'P'+String(changes.priority).replace(/^P/i,'') : null;
    if (changes.owner!==undefined) body.owner_id=changes.owner ? await this.lookupId('personnel','name',changes.owner) : null;
    const rows=await supabaseRequest(`/rest/v1/tickets?id=${exact(id)}&select=*`,{
      method:'PATCH',
      headers:{Prefer:'return=representation'},
      body:JSON.stringify(body)
    });
    return rows?.[0]??null;
  }

  async personnel() {
    const response=await fetch(config.personnelUrl,{cache:'no-store'});
    if (!response.ok) throw new Error('No se pudo cargar el catálogo de personal.');
    const data=await response.json();
    if (data.schemaVersion!==1 || !Array.isArray(data.people)) throw new Error('El catálogo de personal no tiene el formato esperado.');
    return data.people.filter(person=>person.active!==false);
  }

  async references() {
    if (globalThis.__SUDMAR_REFERENCES__) return globalThis.__SUDMAR_REFERENCES__;
    const response=await fetch(config.referenceUrl,{cache:'no-store'});
    if (!response.ok) throw new Error('No se pudo cargar el directorio.');
    return response.json();
  }
}

export const repository = new SnapshotRepository();
