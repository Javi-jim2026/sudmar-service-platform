import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evidenceRequestMessage} from '../prototype/src/evidence-request.js';

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
