import test from 'node:test';
import assert from 'node:assert/strict';
import {SnapshotRepository} from '../prototype/src/repository.js';
test('manual folio create, UUID-targeted rename, duplicates, race and historical updates',async()=>{
 const original=globalThis.fetch,repo=new SnapshotRepository(),calls=[];
 let existing=[],race=false;
 repo.ticketBody=async()=>({title:'Prueba'});
 globalThis.fetch=async(url,options)=>{
  calls.push({url,options});
  if(!options.method)return Response.json(existing);
  if(race)return Response.json({code:'23505',message:'duplicate key violates tickets_folio_unique'},{status:409});
  return Response.json([{id:'uuid-original',...JSON.parse(options.body)}]);
 };
 try{
  assert.equal((await repo.createTicket({folio:'  001-A  '})).folio,'001-A');
  assert.equal(JSON.parse(calls.at(-1).options.body).folio,'001-A');
  existing=[{id:'uuid-original'}];
  await repo.updateTicket('uuid-original',{folio:'001-A'});
  assert.match(calls.at(-1).url,/tickets\?id=eq.uuid-original&select=/);
  assert.equal(JSON.parse(calls.at(-1).options.body).id,undefined);
  existing=[{id:'another-uuid'}];
  const writes=()=>calls.filter(c=>c.options.method).length,before=writes();
  await assert.rejects(repo.createTicket({folio:'001-A'}),/Ya existe/);
  await assert.rejects(repo.updateTicket('uuid-original',{folio:'001-A'}),/Ya existe/);
  assert.equal(writes(),before);
  await assert.rejects(repo.createTicket({folio:'  '}),/Escribe/);
  existing=[];race=true;
  await assert.rejects(repo.createTicket({folio:'race'}),/Ya existe/);
  await assert.rejects(repo.updateTicket('uuid-original',{folio:'race'}),/Ya existe/);
  race=false;await repo.updateTicket('uuid-original',{log:'historical'});
  assert.equal(JSON.parse(calls.at(-1).options.body).folio,undefined);
 }finally{globalThis.fetch=original;}
});
