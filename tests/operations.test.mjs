import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateRequest,requestSummary,cedulaSummary,operationalGroup,catalogKey,simpleRequestSentinel,suggestTicketTitle} from '../prototype/src/operations.js';
import {isActive,isClosed,taskClosed,taskComplete,filterTickets,blankFilters} from '../prototype/src/core.js';
test('guided request accepts a generic symptom with concrete context, rejects context-free requests',()=>{
 const valid={what:'No funciona',where:'Motor de arranque',condition:'Al intentar encender en frío',required:'Diagnóstico eléctrico en sitio'};
 assert.doesNotThrow(()=>validateRequest(valid));assert.match(requestSummary(valid),/Motor de arranque/);
 assert.throws(()=>validateRequest({...valid,where:'equipo',condition:'normal',required:'revisar equipo'}));
 assert.throws(()=>validateRequest({...valid,condition:''}));
});
test('non-operations request may use only the required action and keeps a clean summary',()=>{
 const simple={what:simpleRequestSentinel,where:simpleRequestSentinel,condition:simpleRequestSentinel,required:'Preparar cotización de mantenimiento preventivo'};
 assert.doesNotThrow(()=>validateRequest(simple));
 assert.equal(requestSummary(simple),'Preparar cotización de mantenimiento preventivo');
 assert.equal(suggestTicketTitle(simple),'Preparar cotización de mantenimiento preventivo');
 assert.throws(()=>validateRequest({...simple,required:'x'}));
});
test('ticket title suggestion is concise and does not include boilerplate',()=>{
 const request={what:'El cliente reporta que el generador presenta falla de arranque',where:'Tablero de transferencia',condition:'Al perder la red normal',required:'Realizar diagnóstico y pruebas funcionales'};
 const title=suggestTicketTitle(request);
 assert.ok(title.length<=81);
 assert.doesNotMatch(title,/^El cliente reporta que/i);
 assert.match(title,/generador/i);
});
test('operational states and custom activity groups preserve statistics',()=>{
 for(const status of ['REGISTRADO','PROGRAMADO','EN EJECUCIÓN','EN ESPERA','BLOQUEADO','PENDIENTE DE VALIDACIÓN'])assert.equal(isActive({status}),true);
 assert.equal(isClosed({status:'CONCLUIDO'}),true);assert.equal(isActive({status:'POR CLASIFICAR'}),false);
 assert.equal(operationalGroup('PENDIENTE DE VALIDACIÓN'),'Por validar');
 assert.equal(taskClosed({status:'Revisión terminada',statusGroup:'CERRADA'}),true);
 assert.equal(taskComplete({status:'Cancelación especial',statusGroup:'CERRADA',isCancelled:true}),false);
});
test('equipment type and SLA filters compose; cédula separates operational information',()=>{
 const t={folio:'10',priority:'2',equipmentType:'PORTATILES',description:'Solicitud',technicalFindings:'Batería descargada',workPerformed:'Reemplazo',finalCondition:'Operativo',log:'Llamada interna'};
 assert.equal(filterTickets([t],{...blankFilters(),equipmentType:'PORTATILES',priority:'2'},'2026-09-25').length,1);
 assert.equal(filterTickets([t],{...blankFilters(),equipmentType:'TRANSFERENCIAS'},'2026-09-25').length,0);
 assert.match(cedulaSummary(t),/Trabajo realizado \/ resolución: Reemplazo/);assert.doesNotMatch(cedulaSummary(t),/Llamada interna/);
 assert.equal(catalogKey('  Cliente   nuevo  '),catalogKey('CLIENTE NUEVO'));
});
