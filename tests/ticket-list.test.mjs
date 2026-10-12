import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TICKET_PAGE_SIZES,sortTicketList,ticketPageLimit} from '../prototype/src/ticket-list.js';

test('folios are sorted numerically and the original collection is unchanged',()=>{
  const data=[{folio:'2'},{folio:'100'},{folio:'10'},{folio:'PRUEBA-1'},{folio:'001'}];
  assert.deepEqual(sortTicketList(data,'folio','desc').map(x=>x.folio),['100','10','2','001','PRUEBA-1']);
  assert.deepEqual(sortTicketList(data,'folio','asc').map(x=>x.folio),['001','2','10','100','PRUEBA-1']);
  assert.equal(data[0].folio,'2');
});
test('goals are ordered by date; missing goals stay last in either direction',()=>{
  const data=[{folio:'1',dueAt:null},{folio:'2',dueAt:'2026-12-20'},
    {folio:'3',dueAt:'2026-01-01'},{folio:'4',dueAt:''},{folio:'5',dueAt:'2026-06-03'}];
  assert.deepEqual(sortTicketList(data,'dueAt','desc').map(x=>x.folio),['2','5','3','4','1']);
  assert.deepEqual(sortTicketList(data,'dueAt','asc').map(x=>x.folio),['3','5','2','1','4']);
});
test('page selection supports 20, 50, 100 and all without loading other view page sizes',()=>{
  assert.deepEqual(TICKET_PAGE_SIZES,['20','50','100','all']);
  for(const count of [0,1,19,50,329]){
    assert.equal(ticketPageLimit('all',count),Math.max(1,count));
  }
  assert.equal(ticketPageLimit('20',329),20);
  assert.equal(ticketPageLimit('50',329),50);
  assert.equal(ticketPageLimit('100',329),100);
  assert.equal(ticketPageLimit('invalid',329),20);
});
