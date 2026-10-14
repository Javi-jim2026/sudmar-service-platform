import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ticketsByVisibility,isOperationallyVisible,antecedentsBySerial,serialsInTicket,relatedTicketSerials} from '../prototype/src/visibility.js';
import {metrics,linkedTasks} from '../prototype/src/core.js';

const tickets=[
 {id:'a',folio:'100',serial:'ABC/0001',operationalHidden:false,status:'REGISTRADO',openedAt:'2026-09-01'},
 {id:'b',folio:'101',serial:'ABC/0001',operationalHidden:true,status:'EN EJECUCIÓN',openedAt:'2026-10-01'},
 {id:'c',folio:'102',serial:'ZZZ/0002',status:'CONCLUIDO',openedAt:'2026-08-01'}
];
const tasks=[{ticketFolio:'100',status:'POR INICIAR'},{ticketFolio:'101',status:'POR INICIAR'}];

test('default preserves every ticket as visible unless explicitly hidden',()=>{
 assert.equal(isOperationallyVisible({}),true);
 assert.deepEqual(ticketsByVisibility(tickets).map(x=>x.folio),['100','102']);
 assert.deepEqual(ticketsByVisibility(tickets,'hidden').map(x=>x.folio),['101']);
 assert.equal(ticketsByVisibility(tickets,'all').length,3);
});
test('hide flag never changes the underlying ticket state, tasks or history',()=>{
 const visible=ticketsByVisibility(tickets);
 assert.equal(metrics(visible,tasks,'2026-10-08').total,2);
 assert.deepEqual(linkedTasks(visible,tasks).map(x=>x.ticketFolio),['100']);
 assert.equal(tickets[1].status,'EN EJECUCIÓN');
 assert.equal(tasks.length,2);
 assert.deepEqual(antecedentsBySerial(tickets,' abc/0001 ').map(x=>x.folio),['101','100']);
});
test('empty or placeholder series do not yield false antecedents',()=>{
 assert.deepEqual(antecedentsBySerial(tickets,'S/N'),[]);
 assert.deepEqual(antecedentsBySerial(tickets,''),[]);
});

test('serial history exposes recurrent exact serial across hidden and active tickets without itself',()=>{
 const sample=[
  {id:'old',folio:'70',serial:'333301/0011',status:'CONCLUIDO',operationalHidden:true,openedAt:'2025-11-01'},
  {id:'current',folio:'99',serial:'333301/0011',status:'EN PROCESO',openedAt:'2026-10-14'},
  {id:'other',folio:'23',serial:'333301/00110',status:'ABIERTO',openedAt:'2026-01-02'}
 ];
 const history=relatedTicketSerials(sample,sample[1]);
 assert.equal(history.length,1);
 assert.equal(history[0].serial,'333301/0011');
 assert.deepEqual(history[0].tickets.map(t=>t.folio),['70']);
 assert.equal(history[0].tickets[0].operationalHidden,true);
 assert.equal(sample.length,3,'La búsqueda no debe alterar registros');
});
test('historical multiline series and multi-equipment serials yield independent links',()=>{
 const old={id:'old',folio:'11',serial:'333301/0011\n333301/0022',status:'CONCLUIDO'};
 const multi={id:'multi',folio:'12',isMultiEquipment:true,linkedEquipment:[
  {serial:'333301/0011',model:'ESE 560'},{serial:'333301/0033',model:'ESE 190'}
 ]};
 const current={id:'current',folio:'13',serial:'333301/0011',status:'ABIERTO'};
 assert.deepEqual(serialsInTicket(old),['333301/0011','333301/0022']);
 assert.deepEqual(serialsInTicket(multi),['333301/0011','333301/0033']);
 assert.deepEqual(antecedentsBySerial([old,multi,current],'333301/0011').map(t=>t.folio),['13','12','11']);
 assert.deepEqual(relatedTicketSerials([old,multi,current],current)[0].tickets.map(t=>t.folio),['12','11']);
 assert.deepEqual(antecedentsBySerial([old,multi,current],'333301/001'),[]);
 assert.deepEqual(serialsInTicket({serial:'S/N'}),[]);
});
