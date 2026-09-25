import test from 'node:test';
import assert from 'node:assert/strict';
import {repository} from '../prototype/src/repository.js';
test('deletion calls only the guarded RPC, preserves exact confirmation and propagates rejection',async()=>{
 const original=globalThis.fetch;let call;
 try{
  globalThis.fetch=async(url,options)=>{call={url,options};return new Response(JSON.stringify('ticket-id'),{status:200});};
  assert.equal(await repository.deleteTestTicket('ticket-id','01234'),'ticket-id');
  assert.match(call.url,/\/rpc\/delete_test_ticket$/);
  assert.equal(call.options.method,'POST');
  assert.deepEqual(JSON.parse(call.options.body),{p_ticket_id:'ticket-id',p_folio:'01234'});
  globalThis.fetch=async()=>new Response(JSON.stringify({message:'Debe cancelarse/archivarse'}),{status:400});
  await assert.rejects(repository.deleteTestTicket('ticket-id','01234'),/cancelarse/);
  globalThis.fetch=async()=>new Response('null',{status:200});
  await assert.rejects(repository.deleteTestTicket('ticket-id','01234'),/No se confirmó/);
 }finally{globalThis.fetch=original;}
});
