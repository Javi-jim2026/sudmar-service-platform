import {config} from './config.js';

/**
 * Data boundary. A future authenticated API implements this same load contract.
 * Do not use localStorage as the operational database. Saved views contain filters only.
 * Keep tenant authorization and mutation/audit logic on the server in the next release.
 */
export class SnapshotRepository {
  async load() {
    const injected = globalThis.__SUDMAR_SNAPSHOT__;
    const response = injected ? null : await fetch(config.dataUrl, {cache:'no-store'});
    if (response && !response.ok) throw new Error('No se pudo cargar el archivo de operación.');
    const data = injected || await response.json();
    if (data.metadata?.schemaVersion!==1 || !Array.isArray(data.tickets) || !Array.isArray(data.tasks)) throw new Error('El archivo de operación no tiene el formato esperado.');
    return data;
  }
  canWrite() {
    return Boolean(config.features.editing && config.writeApiUrl);
  }
  async mutate(resource, payload) {
    if (!this.canWrite()) throw new Error('La conexión segura de escritura con OneDrive todavía no está configurada.');
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
  async references() {
    if (globalThis.__SUDMAR_REFERENCES__) return globalThis.__SUDMAR_REFERENCES__;
    const response=await fetch(config.referenceUrl,{cache:'no-store'});
    if (!response.ok) throw new Error('No se pudo cargar el directorio.');
    return response.json();
  }
}

export const repository = new SnapshotRepository();
