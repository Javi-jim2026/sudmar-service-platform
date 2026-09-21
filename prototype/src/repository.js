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
  async references() {
    if (globalThis.__SUDMAR_REFERENCES__) return globalThis.__SUDMAR_REFERENCES__;
    const response=await fetch(config.referenceUrl,{cache:'no-store'});
    if (!response.ok) throw new Error('No se pudo cargar el directorio.');
    return response.json();
  }
}

export const repository = new SnapshotRepository();
