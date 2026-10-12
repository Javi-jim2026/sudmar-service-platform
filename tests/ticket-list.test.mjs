import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TICKET_PAGE_SIZES,TICKET_DATE_FIELDS,filterTicketDatePresence,sortTicketList,ticketPageLimit} from '../prototype/src/ticket-list.js';

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

test('date selection sorts each date independently; empty dates remain last',()=>{
 const data=[
  {folio:'200',openedAt:'2026-02-01',dueAt:null,closedAt:'2026-03-02'},
  {folio:'300',openedAt:'2026-04-01',dueAt:'2026-06-01',closedAt:null},
  {folio:'100',openedAt:'2026-01-01',dueAt:'2026-02-01',closedAt:'2026-01-05'}
 ];
 assert.deepEqual(Object.keys(TICKET_DATE_FIELDS),['openedAt','dueAt','closedAt']);
 assert.deepEqual(sortTicketList(data,'date','desc','openedAt').map(x=>x.folio),['300','200','100']);
 assert.deepEqual(sortTicketList(data,'date','asc','closedAt').map(x=>x.folio),['100','200','300']);
 assert.deepEqual(sortTicketList(data,'date','desc','dueAt').map(x=>x.folio),['300','100','200']);
 assert.deepEqual(sortTicketList(data,'date','asc','dueAt').map(x=>x.folio),['100','300','200']);
 assert.equal(data[0].folio,'200');
});
test('filter with and without a selected date, combined with any prior ticket filters',()=>{
 const data=[{folio:'1',openedAt:'2026-01-01',dueAt:'',closedAt:null},
  {folio:'2',openedAt:'2026-02-01',dueAt:'2026-03-01',closedAt:''},
  {folio:'3',openedAt:'2026-03-01',dueAt:null,closedAt:'2026-04-01'}];
 assert.deepEqual(filterTicketDatePresence(data,'dueAt','missing').map(x=>x.folio),['1','3']);
 assert.deepEqual(filterTicketDatePresence(data,'dueAt','with').map(x=>x.folio),['2']);
 assert.deepEqual(filterTicketDatePresence(data,'openedAt','missing'),[]);
 assert.deepEqual(filterTicketDatePresence(data,'closedAt','with').map(x=>x.folio),['3']);
 assert.deepEqual(filterTicketDatePresence(data,'closedAt','missing').map(x=>x.folio),['1','2']);
 assert.deepEqual(filterTicketDatePresence(data,'dueAt','all'),data);
});
