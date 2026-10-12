import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evidenceFolders,evidenceRequestMessage} from '../prototype/src/evidence-request.js';

test('No se genera mensaje sin carpeta o con enlace inválido',()=>{
 for(const url of [undefined,null,'','   ','javascript:alert(1)','file:///carpeta','/ruta/relativa']){
  assert.equal(evidenceRequestMessage({folio:'124',client:'Cliente',title:'Servicio',evidenceUrl:url}),null);
 }
 assert.equal(evidenceRequestMessage(null),null);
});
test('Cada mensaje toma folio, cliente, título y carpeta de su ticket',()=>{
 const uno=evidenceRequestMessage({folio:'2643',client:'PLANTIRENT',title:'Revisión de generador',evidenceUrl:'https://1drv.ms/f/CarpetaUno'});
 const dos=evidenceRequestMessage({folio:'2689',client:'PRETTL',title:'Pruebas con carga',evidenceUrl:'https://contoso.sharepoint.com/CarpetaDos'});
 assert.match(uno,/\*Ticket:\* #2643/);
 assert.match(uno,/\*Cliente:\* PLANTIRENT/);
 assert.match(uno,/\*Servicio:\* Revisión de generador/);
 assert.match(uno,/https:\/\/1drv.ms\/f\/CarpetaUno/);
 assert.doesNotMatch(uno,/CarpetaDos|PRETTL/);
 assert.match(dos,/\*Ticket:\* #2689/);
 assert.match(dos,/\*Cliente:\* PRETTL/);
 assert.match(dos,/\*Servicio:\* Pruebas con carga/);
 assert.match(dos,/https:\/\/contoso.sharepoint.com\/CarpetaDos/);
 assert.doesNotMatch(dos,/CarpetaUno|PLANTIRENT/);
 assert.match(dos,/Favor de cargar las evidencias/);
 assert.match(dos,/Agradecemos confirmar/);
});

test('Ticket sin carpeta general utiliza la carpeta de su actividad',()=>{
 const ticket={folio:'2680',client:'MANTENIMIENTO',title:'Dos servicios',evidenceUrl:null};
 const task={platformId:'ACT-000030',taskType:'Mantenimiento',evidenceUrl:'https://1drv.ms/f/c/CarpetaActividad'};
 const message=evidenceRequestMessage(ticket,[task]);
 assert.match(message,/\*Ticket:\* #2680/);
 assert.match(message,/\*Cliente:\* MANTENIMIENTO/);
 assert.match(message,/\*Servicio:\* Dos servicios/);
 assert.match(message,/https:\/\/1drv.ms\/f\/c\/CarpetaActividad/);
});
test('Sin ninguna carpeta válida de actividades, se oculta el mensaje',()=>{
 const ticket={folio:'2680',evidenceUrl:null};
 assert.equal(evidenceRequestMessage(ticket,[]),null);
 assert.equal(evidenceRequestMessage(ticket,[{platformId:'ACT-1',evidenceUrl:'javascript:alert(1)'}]),null);
});
test('Varias actividades generan enlaces identificados y se evitan duplicados',()=>{
 const ticket={folio:'2680',client:'Cliente',title:'Mantenimientos',evidenceUrl:null};
 const tasks=[
  {platformId:'ACT-000030',taskType:'Mantenimiento',evidenceUrl:'https://1drv.ms/f/Primera'},
  {platformId:'ACT-000031',taskType:'Inspección',evidenceUrl:'https://1drv.ms/f/Segunda'},
  {platformId:'ACT-000032',taskType:'Revisión',evidenceUrl:'https://1drv.ms/f/Segunda'}
 ];
 const message=evidenceRequestMessage(ticket,tasks);
 assert.match(message,/Actividad ACT-000030 · Mantenimiento/);
 assert.match(message,/Actividad ACT-000031 · Inspección/);
 assert.match(message,/https:\/\/1drv.ms\/f\/Primera/);
 assert.match(message,/https:\/\/1drv.ms\/f\/Segunda/);
 assert.equal(message.split('https://1drv.ms/f/Segunda').length-1,1);
});

test('Carpeta general histórica también se reconoce sin repetir el enlace',()=>{
 const ticket={folio:'100',evidenceUrl:'https://example.com/carpeta'};
 const tasks=[{platformId:'ACT-001',evidenceUrl:'https://example.com/carpeta'}];
 assert.equal(evidenceFolders(ticket,tasks).length,1);
 assert.equal(evidenceRequestMessage(ticket,tasks).split('https://example.com/carpeta').length-1,1);
});
