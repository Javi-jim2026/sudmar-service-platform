import {buildPrintableBitacora} from '../prototype/src/bitacora-print.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {latestConcludedTicket,buildBitacora,bitacoraFileName,createBitacoraPdf} from '../prototype/src/bitacora.js';

const base={
 id:'test-2643',folio:'2643',client:'ADNR MAQUINARIA',status:'CONCLUIDO',
 title:'Falla por suministro de combustible',openedAt:'2026-09-09',closedAt:'2026-10-14',
 model:'ESE 350 BW/AS',serial:'89333075/0002',
 technicalFindings:'Falla en alimentación',workPerformed:'Se corrigió el suministro',
 finalCondition:'Equipo operativo',evidenceUrl:'https://example.com/evidencias'
};
const tasks=[
 {ticketFolio:'2643',platformId:'ACT-3',taskType:'Prueba',completedAt:'2026-10-14',status:'COMPLETA',resolution:'Prueba de carga',evidenceUrl:'https://example.com/prueba'},
 {ticketFolio:'2643',platformId:'ACT-1',taskType:'Diagnóstico',completedAt:'2026-09-10',status:'COMPLETA',notes:'Revisión del circuito'},
 {ticketFolio:'2643',platformId:'ACT-2',taskType:'Reparación',completedAt:'2026-09-30',status:'COMPLETA',outcome:'Restablecido'},
 {ticketFolio:'9999',platformId:'OTRO',taskType:'Servicio ajeno',notes:'No debe aparecer'}
];

test('Cliente exacto + CONCLUIDO + fecha real más reciente; no usa folio, apertura ni tickets de prueba',()=>{
 const tickets=[
  {...base,folio:'2800',closedAt:null},
  {...base,folio:'2801',status:'EN EJECUCIÓN',closedAt:'2026-11-01'},
  {...base,folio:'2900',isTest:true,closedAt:'2026-11-03'},
  {...base,folio:'2700',closedAt:'2026-10-11'},
  base,
  {...base,folio:'3000',client:'ADNR MAQUINARIA INDUSTRIAL',closedAt:'2026-11-01'},
  {...base,folio:'3001',client:'OTRO CLIENTE',closedAt:'2026-11-01'}
 ];
 assert.equal(latestConcludedTicket(tickets,'ADNR MAQUINARIA')?.folio,'2643');
 assert.equal(latestConcludedTicket(tickets,'ADNR MAQUINARIA INDUSTRIAL')?.folio,'3000');
 assert.equal(latestConcludedTicket(tickets,'ADNR'),null);
 assert.equal(latestConcludedTicket(tickets,'INEXISTENTE'),null);
});

test('Empates por cierre se resuelven de manera estable usando folio numérico',()=>{
 assert.equal(latestConcludedTicket([{...base,folio:'9'},{...base,folio:'10'}],'ADNR MAQUINARIA').folio,'10');
});

test('Incluye tres actividades del folio correcto y su orden cronológico',()=>{
 const record=buildBitacora(base,tasks,new Date('2026-10-28T12:00:00Z'));
 assert.equal(record.folio,'2643');
 assert.equal(record.activities.length,3);
 assert.deepEqual(record.activities.map(a=>a.code),['ACT-1','ACT-2','ACT-3']);
 assert.equal(record.equipment[0].serial,'89333075/0002');
 assert.equal(record.evidence.length,2);
 assert.equal(record.generatedAt,'2026-10-28T12:00:00.000Z');
 assert.equal(record.isConcluded,true);
});

test('El registro multiequipo no mezcla observaciones de otros equipos ni tickets',()=>{
 const ticket={...base,isMultiEquipment:true,linkedEquipment:[
  {model:'ESE 2006',serial:'AAA/001',findings:'Prueba 1',workPerformed:'Reemplazo 1'},
  {model:'ESE 804',serial:'BBB/002',finalCondition:'Disponible',evidenceUrl:'https://example.com/equipo2'}
 ]};
 const record=buildBitacora(ticket,tasks);
 assert.equal(record.equipment.length,2);
 assert.deepEqual(record.equipment.map(e=>e.serial),['AAA/001','BBB/002']);
 assert.equal(record.equipment[1].finalCondition,'Disponible');
 assert.equal(record.activities.length,3);
});

test('El PDF tiene páginas válidas, cierre documental, texto y enlaces de evidencias',()=>{
 const record=buildBitacora(base,tasks);
 const bytes=createBitacoraPdf(record);
 const contents=Buffer.from(bytes).toString('latin1');
 assert.match(contents,/^%PDF-1\.4/);
 assert.match(contents,/\/Type \/Pages \/Count \d+/);
 assert.match(contents,/\/URI \(https:\/\/example\.com\/evidencias\)/);
 assert.match(contents,/ADNR MAQUINARIA/);
 assert.match(contents,/Sin firma/);
 assert.match(contents,/%%EOF\s*$/);
 const offset=Number(contents.match(/startxref\n(\d+)\n/)[1]);
 assert.equal(contents.slice(offset,offset+4),'xref');
 assert.match(bitacoraFileName(record),/^SUDMAR_Bitacora_2643_ADNR_MAQUINARIA\.pdf$/);
});

test('Paginación sin pérdida de contenido en actividades extensas',()=>{
 const many=Array.from({length:20},(_,i)=>({
  ticketFolio:'2643',platformId:'ACT-'+i,taskType:'Prueba '+i,
  completedAt:'2026-10-14',notes:'Evidencia detallada '.repeat(50)
 }));
 const contents=Buffer.from(createBitacoraPdf(buildBitacora(base,many))).toString('latin1');
 const count=Number(contents.match(/\/Type \/Pages \/Count (\d+)/)[1]);
 assert.ok(count>=3,'Se requieren varias páginas para contenido largo');
 assert.match(contents,/Prueba 19/);
 assert.match(contents,/Página 1 de/);
});

test('La interfaz de bitácoras es de solo lectura y conserva el exportador CSV',async()=>{
 const app=await readFile(new URL('../prototype/src/app.js',import.meta.url),'utf8');
 const html=await readFile(new URL('../prototype/index.html',import.meta.url),'utf8');
 const generator=await readFile(new URL('../prototype/src/bitacora.js',import.meta.url),'utf8');
 assert.match(app,/data-action="preview-bitacora-ticket"/);
 assert.match(app,/data-action="preview-bitacora-client"/);
 assert.match(html,/data-action="download-bitacora"/);
 assert.match(app,/if\(a==='download-bitacora'\)/);
 assert.match(app,/function exportView\(\)/);
 assert.match(html,/id="bitacoraDialog"/);
 assert.doesNotMatch(generator,/fetch\(|supabaseRequest\(|\bmethod:\s*['"](?:POST|PATCH|DELETE)/);
});

test('La vista imprimible usa el flujo Guardar como PDF de Reportes y protege el HTML',()=>{
 const record=buildBitacora({...base,client:'ADNR <script>alert(1)</script>'},tasks);
 const html=buildPrintableBitacora(record);
 assert.match(html,/window\.print\(\)/);
 assert.match(html,/Guardar como PDF/);
 assert.match(html,/BITÁCORA TÉCNICA DE SERVICIO/);
 assert.match(html,/@page\{size:A4/);
 assert.match(html,/89333075\/0002/);
 assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
 assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);
});
