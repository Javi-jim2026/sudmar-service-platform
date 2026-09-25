import {catalogKey,validateRequest,requestSummary} from './operations.js';
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
  const result=[];let offset=0;
  while(true){const rows=await supabaseRequest(`/rest/v1/${table}?select=${encodeURIComponent(select)}${extra}&limit=1000&offset=${offset}`);result.push(...rows);if(rows.length<1000)break;offset+=1000;}return result;
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
        '*',
        '&order=folio.desc'),
      fetchSupabaseTable('clients','id,name'),
      fetchSupabaseTable('equipment','id,client_id,model,serial_number,equipment_type'),
      fetchSupabaseTable('personnel','id,name,role,area'),
      fetchSupabaseTable('tasks',
        '*',
        '&order=created_at.desc')
    ]);

    const catalogs=await this.catalogs();
    this.catalogData=catalogs;
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
        isTest: row.is_test===true,
        folio: String(row.folio??''),
        priority: String(row.priority??'').replace(/^P/i,''),
        title: row.title??'',
        description: row.description??'',
        client: client?.name??'',
        businessUnit: row.business_unit??'',
        area: row.area??'',
        stage: row.stage??'',
        owner: owner?.name??'',
        openedAt: dateOnly(row.opened_at),
        dueAt: dateOnly(row.due_at),
        closedAt: dateOnly(row.closed_at),
        model: row.catalog_model_id ? (catalogs.models.find(m=>m.id===row.catalog_model_id)?.name??row.source_model??'') : (row.source_model??unit?.model??''),
        serial: row.catalog_model_id ? (catalogs.serials.find(s=>s.id===row.catalog_serial_id)?.serial_number??row.source_serial??'') : (row.source_serial??unit?.serial_number??''),
        status: row.operational_status??'POR CLASIFICAR',
        legacyStatus:row.legacy_status??row.status,legacyStage:row.legacy_stage??row.stage,legacyDiagnosis:row.legacy_diagnosis??row.diagnosis,
        requestContext:row.request_context,technicalFindings:row.technical_findings??'',workPerformed:row.work_performed??'',finalCondition:row.final_condition??'',
        serviceCategoryId:row.service_category_id??'',catalogModelId:row.catalog_model_id??'',catalogSerialId:row.catalog_serial_id??'',
        equipmentType:catalogs.models.find(m=>m.id===row.catalog_model_id)?.equipment_type??unit?.equipment_type??'',
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
        antecedentFolio:ticketsById.get(row.antecedent_ticket_id)?.folio??'',
        statusGroup:catalogs.statuses.find(s=>s.name===row.activity_status)?.group_code,
        isCancelled:catalogs.statuses.find(s=>s.name===row.activity_status)?.is_cancelled,
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
        status: row.activity_status??row.status??'',
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
      catalogs,
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

  async catalogs() {
    const [clients,models,serials,categories,types,statuses]=await Promise.all([
      fetchSupabaseTable('clients','id,name','&order=name.asc'),fetchSupabaseTable('equipment_models','*','&order=name.asc'),
      fetchSupabaseTable('equipment_serials','*','&order=id.asc'),fetchSupabaseTable('service_categories','*','&order=name.asc'),
      fetchSupabaseTable('activity_types','*','&order=name.asc'),fetchSupabaseTable('activity_statuses','*','&order=name.asc')]);
    return {clients,models,serials,categories,types,statuses};
  }
  async addCatalog(table,body) {
    const allowed=['clients','equipment_models','equipment_serials','service_categories','activity_types','activity_statuses'];
    if(!allowed.includes(table))throw Error('Catálogo no permitido.');
    const rows=await supabaseRequest('/rest/v1/'+table,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});
    return rows[0];
  }
  async ticketBody(payload,creating=false) {
    const body={updated_at:new Date().toISOString()};
    if(payload.requestContext){validateRequest(payload.requestContext);body.request_context=payload.requestContext;body.description=requestSummary(payload.requestContext);body.title=body.description.slice(0,180);}
    else if(creating)throw Error('Completa la captura guiada.');
    if(payload.client!==undefined){const clients=(await this.catalogs()).clients;const c=clients.find(c=>catalogKey(c.name)===catalogKey(payload.client));if(!c)throw Error('Selecciona un cliente del catálogo.');body.client_id=c.id;}
    if(payload.owner!==undefined)body.owner_id=await this.lookupId('personnel','name',payload.owner);
    const mapping={area:'area',businessUnit:'business_unit',priority:'priority',status:'operational_status',openedAt:'opened_at',dueAt:'due_at',serviceCategoryId:'service_category_id',catalogModelId:'catalog_model_id',catalogSerialId:'catalog_serial_id',log:'logbook',technicalFindings:'technical_findings',workPerformed:'work_performed',finalCondition:'final_condition'};
    for(const [key,column] of Object.entries(mapping))if(payload[key]!==undefined)body[column]=payload[key]||null;
    if(body.priority)body.priority='P'+String(body.priority).replace(/^P/,'');
    if(payload.catalogModelId!==undefined){
      const catalogs=await this.catalogs();const model=catalogs.models.find(m=>m.id===payload.catalogModelId);
      const serial=catalogs.serials.find(s=>s.id===payload.catalogSerialId);
      if(payload.catalogModelId&&!model)throw Error('Modelo no disponible.');
      if(serial&&serial.model_id!==model?.id)throw Error('La serie no corresponde al modelo.');
      if(model){body.source_model=model.name;body.source_serial=serial?.serial_number||null;}
    }
    return body;
  }
  async createTicket(payload) {
    const body=await this.ticketBody(payload,true);body.is_test=payload.isTest===true;body.operational_status=payload.status||'REGISTRADO';
    const rows=await supabaseRequest('/rest/v1/tickets',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});return rows[0];
  }

  async deleteTestTicket(id,folio) {
    if(!this.canWrite() || !config.features.testTicketDeletion)throw Error('La eliminación temporal no está disponible.');
    if(!id || !folio)throw Error('Escribe el folio exacto.');
    const deleted=await supabaseRequest('/rest/v1/rpc/delete_test_ticket',{method:'POST',body:JSON.stringify({p_ticket_id:id,p_folio:folio})});
    if(deleted!==id)throw Error('No se confirmó la eliminación. Recarga antes de reintentar.');
    return deleted;
  }

  async createTask(payload) {
    validateActivity(payload);
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
        category:null,
        antecedent_ticket_id:payload.antecedentFolio?await this.lookupId('tickets','folio',payload.antecedentFolio):null,
        checklist:validateChecklist(payload.checklist||[]),
        title:payload.taskType,

        area:payload.area||null,
        priority:payload.priority||null,
        activity_status:payload.status||'POR INICIAR',
        outcome:payload.outcome||null,resolution:payload.resolution||null,
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
    if(changes.antecedentFolio!==undefined)body.antecedent_ticket_id=changes.antecedentFolio?await this.lookupId('tickets','folio',changes.antecedentFolio):null;
    if (changes.area!==undefined) body.area=changes.area||null;
    if (changes.priority!==undefined) body.priority=changes.priority||null;
    if(changes.status!==undefined)body.activity_status=changes.status;
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

  async updateTicket(id,changes) {
    const body=await this.ticketBody(changes);
    const rows=await supabaseRequest(`/rest/v1/tickets?id=${exact(id)}&select=*`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});
    if(!rows?.[0])throw Error('No se pudo actualizar el ticket.');return rows[0];
  }

  async personnel() {
    if(this.canWrite()){
      const people=await fetchSupabaseTable('personnel','*','&active=eq.true&order=name.asc');
      let reference=[];try{const response=await fetch(config.personnelUrl,{cache:'no-store'});reference=(await response.json()).people||[];}catch{}
      return people.map(p=>({...reference.find(r=>catalogKey(r.name)===catalogKey(p.name)),...p,title:p.role,parentArea:'',operationalAreas:p.operational_areas||[p.area]}));
    }
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
