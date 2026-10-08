import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ticketsByVisibility,isOperationallyVisible,antecedentsBySerial} from '../prototype/src/visibility.js';
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
