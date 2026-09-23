import {config} from './config.js';

const dateOnly = value => value ? String(value).slice(0,10) : null;

async function fetchSupabaseTable(table, select, extra='') {
  const base=config.supabase?.url?.replace(/\/$/,'');
  const key=config.supabase?.publishableKey;
  if (!base || !key) throw new Error('Supabase no está configurado.');
  const url=`${base}/rest/v1/${table}?select=${encodeURIComponent(select)}${extra}`;
  const response=await fetch(url,{
    cache:'no-store',
    headers:{
      apikey:key,
      Authorization:`Bearer ${key}`,
      Accept:'application/json',
    }
  });
  if (!response.ok) {
    let detail='';
    try { detail=await response.text(); } catch {}
    throw new Error(`No se pudo leer ${table} desde Supabase. ${detail}`.trim());
  }
  return response.json();
}

/**
 * Operational data boundary.
 * Supabase is the live source for the pilot. The Excel JSON snapshot remains
 * available only as a fallback so the dashboard does not go dark if the API fails.
 */
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
    const [tickets, clients, equipment, personnel] = await Promise.all([
      fetchSupabaseTable('tickets',
        'id,folio,client_id,equipment_id,owner_id,area,business_unit,stage,title,priority,status,opened_at,due_at,closed_at,logbook,diagnosis,folder_url',
        '&order=folio.desc'),
      fetchSupabaseTable('clients','id,name'),
      fetchSupabaseTable('equipment','id,model,serial_number'),
      fetchSupabaseTable('personnel','id,name')
    ]);

    const clientsById=new Map(clients.map(item=>[item.id,item]));
    const equipmentById=new Map(equipment.map(item=>[item.id,item]));
    const personnelById=new Map(personnel.map(item=>[item.id,item]));

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
        model: unit?.model??'',
        serial: unit?.serial_number??'',
        status: row.status??'',
        log: row.logbook??'',
        diagnosis: row.diagnosis??'',
        evidenceUrl: row.folder_url??null,
        evidenceLabel: row.folder_url?'Abrir carpeta':'',
        sourceExtra: {},
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
        counts:{tickets:mappedTickets.length,tasks:0},
        quality:{duplicateTicketFolios:[],taskFoliosNotInTickets:[],tasksWithoutTitle:0},
      },
      tickets:mappedTickets,
      tasks:[],
    };
  }

  async load() {
    if (config.features.sharedDatabase && config.supabase?.url && config.supabase?.publishableKey) {
      try {
        return await this.loadSupabase();
      } catch (error) {
        console.error('Supabase no disponible; usando snapshot local.', error);
      }
    }
    return this.loadSnapshot();
  }

  canWrite() {
    return Boolean(config.features.editing && config.writeApiUrl);
  }

  async mutate(resource, payload) {
    if (!this.canWrite()) throw new Error('La escritura compartida todavía no está habilitada.');
    const base=config.writeApiUrl.replace(/\/$/,'');
    const response=await fetch(base+'/'+resource,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload),
      credentials:'omit',
    });
    if (!response.ok) {
      let message='No se pudo guardar la información.';
      try { const body=await response.json(); if(body?.message) message=body.message; } catch {}
      throw new Error(message);
    }
    return response.json();
  }

  async createTicket(payload) { return this.mutate('tickets', payload); }
  async createTask(payload) { return this.mutate('tasks', payload); }

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
