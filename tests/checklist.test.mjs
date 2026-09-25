import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checklistProgress,validateChecklist,validateActivity} from '../prototype/src/checklist.js';
import {SnapshotRepository} from '../prototype/src/repository.js';

test('checklist progress handles empty, partial, full and hidden lists independently of state',()=>{
 for(const status of ['SIN INICIAR','EN PROCESO','BLOQUEADA','COMPLETADA']) {
  assert.deepEqual(checklistProgress({category:'OPERACIONES',status,checklist:[]}),{total:0,completed:0,percent:0});
  const checklist=Array.from({length:15},(_,i)=>({id:String(i),text:'Trabajo '+i,completed:i<10}));
  assert.equal(checklistProgress({category:'OPERACIONES',status,checklist}).percent,67);
  assert.equal(checklistProgress({category:'COMPRAS',status,checklist}).percent,67);
  assert.equal(checklistProgress({category:'OPERACIONES',status,checklist:checklist.map(i=>({...i,completed:true}))}).percent,100);
 }
 assert.equal(checklistProgress({}).percent,0);
});
test('checklist rejects malformed, duplicate and blank items; supports up to 500 jobs',()=>{
 const item={id:'a',text:'Trabajo',completed:false};
 assert.equal(validateChecklist(Array.from({length:500},(_,i)=>({...item,id:String(i)}))).length,500);
 for(const invalid of [null,{},[item,item],[{...item,text:' '}],[{...item,completed:'true'}],Array(501).fill(item)])assert.throws(()=>validateChecklist(invalid));
});
test('activity validates date ranges and categories without requiring a checklist on legacy records',()=>{
 const p={title:'Instalación',startAt:'2026-09-24',dueAt:'2026-09-27',category:'OPERACIONES',checklist:[]};
 assert.doesNotThrow(()=>validateActivity(p));
 assert.throws(()=>validateActivity({...p,dueAt:'2026-09-23'}));
 assert.throws(()=>validateActivity({...p,category:'INVALID'}));
 assert.doesNotThrow(()=>validateActivity({...p,category:null}));
});
test('repository saves checklist atomically with the activity and retains distinct observations and resolution',async()=>{
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,options={})=>{
  calls.push({url,options});
  const data=url.includes('/tickets?')?[{id:'ticket',client_id:'client'}]:url.includes('/personnel?')?[{id:'owner'}]:[{id:'task'}];
  return new Response(JSON.stringify(data),{status:200});
 };
 try {
  const repo=new SnapshotRepository();const checklist=[{id:'one',text:'Pruebas',completed:true}];
  await repo.createTask({title:'Instalar',ticketFolio:'584',owner:'Javier',startAt:'2026-09-24',category:'OPERACIONES',checklist,notes:'Requerimiento'});
  const post=calls.find(c=>c.options.method==='POST');const body=JSON.parse(post.options.body);
  assert.deepEqual(body.checklist,checklist);assert.equal(body.notes,'Requerimiento');assert.equal(body.ticket_id,'ticket');
  await repo.updateTask('task',{category:'COMPRAS',checklist,resolution:'Parcial'},'2026-09-24T00:00:00+00:00');
  const patch=calls.find(c=>c.options.method==='PATCH');const changed=JSON.parse(patch.options.body);
  assert.deepEqual(changed.checklist,checklist);assert.equal(changed.resolution,'Parcial');
  for(const untouched of ['notes','status','start_at','due_at','completed_at'])assert.equal(untouched in changed,false);
  assert.ok(patch.url.includes('updated_at=eq.'));
  globalThis.fetch=async()=>new Response('[]',{status:200});
  await assert.rejects(repo.updateTask('task',{checklist},'old'),/otra sesión/);
 } finally {globalThis.fetch=original;}
});
