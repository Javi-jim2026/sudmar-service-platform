import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const repository=await readFile(new URL('../prototype/src/repository.js',import.meta.url),'utf8');
const enhancements=await readFile(new URL('../prototype/src/enhancements.js',import.meta.url),'utf8');
const migration=await readFile(new URL('../supabase/migrations/20261005073000_actual_resolution_and_activity_evidence.sql',import.meta.url),'utf8');

test('ticket keeps a separate actual resolution date',()=>{
 assert.match(repository,/resolvedAt:\s*dateOnly\(row\.resolved_at\)/);
 assert.match(repository,/resolvedAt:'resolved_at'/);
 assert.match(enhancements,/Fecha de resolución real/);
 assert.match(enhancements,/Tiempo real de resolución/);
 assert.match(migration,/new\.operational_status='CONCLUIDO'/);
 assert.match(migration,/new\.resolved_at := now\(\)/);
});

test('activities expose actual completion date and evidence folder',()=>{
 assert.match(repository,/completed_at:payload\.completedAt\|\|null/);
 assert.match(repository,/evidence_url:payload\.evidenceUrl\|\|null/);
 assert.match(repository,/evidenceUrl:\s*row\.evidence_url\?\?null/);
 assert.match(enhancements,/Fecha de realización real/);
 assert.match(enhancements,/Carpeta de evidencias \/ OneDrive/);
 assert.match(enhancements,/Evidencias del servicio/);
 assert.match(enhancements,/Abrir evidencias/);
});

test('evidence links are restricted to https',()=>{
 assert.match(enhancements,/url\.protocol!=='https:'/);
 assert.match(migration,/tasks_evidence_url_https_chk/);
 assert.match(migration,/evidence_url ~\* '\^https:\/\/'/);
});
