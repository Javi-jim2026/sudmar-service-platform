// Run with Playwright 1.62.1 available (NODE_PATH may point to the desktop runtime).
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=new URL('../prototype/',import.meta.url);
const server=createServer(async(req,res)=>{
 try {
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html';
  const file=new URL(path,root);if(!file.href.startsWith(root.href))throw Error('path');
  const body=await readFile(file);
  res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.json')?'application/json':'text/html');res.end(body);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
const page=await browser.newPage({viewport:{width:1360,height:1000},serviceWorkers:'block'});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const day=new Date().toISOString().slice(0,10);
const tables={tickets:[{id:'seed',folio:'9000',client_id:'client',title:'Ticket inicial',status:'NUEVA',business_unit:'SERVICIO',opened_at:day,owner_id:'person'}],clients:[{id:'client',name:'Cliente prueba'}],personnel:[{id:'person',name:'Rodolfo Martinez',area:'Dirección General'}],equipment:[],tasks:[]};
let sequence=9001;let rejectNext=false;
await page.route('https://*.supabase.co/rest/v1/**',async route=>{
 const req=route.request();const url=new URL(req.url());const table=url.pathname.split('/').pop();
 let rows=tables[table]||[];
 for(const [key,val] of url.searchParams)if(val.startsWith('eq.'))rows=rows.filter(r=>String(r[key])===val.slice(3));
 if(req.method()==='POST'){
  if(rejectNext){rejectNext=false;return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Error de prueba: permiso denegado'})});}
  const row={...req.postDataJSON(),id:'new-'+sequence,folio:String(sequence++),updated_at:new Date().toISOString()};tables[table].push(row);rows=[row];
 }
 if(req.method()==='PATCH')for(const row of rows)Object.assign(row,req.postDataJSON());
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows)});
});
const click=selector=>page.locator(selector).click();
try {
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#sourceDate').filter({hasText:'Supabase en línea'}).waitFor();
 await click('[data-action="new-ticket"]');
 await page.locator('#newTicketForm [name="title"]').fill('Ticket nuevo E2E');
 await page.locator('#newTicketClient').selectOption('Cliente prueba');
 await page.locator('#newTicketBusinessUnit').selectOption('SERVICIO');
 await click('#newTicketForm [type="submit"]');
 await page.locator('#newTicketDialog').waitFor({state:'hidden'});
 const ticket=tables.tickets.at(-1);
 await click('[data-action="new-task"]');
 await page.locator('#newTaskDialog').waitFor({state:'visible'});
 await page.locator('#newTaskTicketSearch').fill(ticket.folio);
 await page.locator('#newTaskTicket').selectOption(ticket.folio);
 await page.locator('#newTaskCategory').selectOption('OPERACIONES');
 await page.locator('#newTaskForm [name="taskType"]').fill('INSTALACIÓN');
 await page.locator('#newTaskForm [name="title"]').fill('Instalación E2E');
 await page.locator('#newTaskOwner').selectOption('Rodolfo Martinez');
 await page.locator('#newTaskForm [name="notes"]').fill('Requerimiento original');
 for(let i=0;i<16;i++){
  await click('#newTaskChecklist [data-action="add-work"]');
  await page.locator('#newTaskChecklist .work-text').last().fill('Trabajo '+i);
  if(i<10)await page.locator('#newTaskChecklist .work-completed').last().check();
 }
 await page.locator('#newTaskChecklist [data-action="remove-work"]').last().click();
 assert.match(await page.locator('#newTaskChecklist .work-summary').innerText(),/67% · 10 de 15/);
 await page.locator('#newTaskCategory').selectOption('COMPRAS');assert.equal(await page.locator('#newTaskChecklist').isVisible(),false);
 await page.locator('#newTaskCategory').selectOption('OPERACIONES');assert.equal(await page.locator('#newTaskChecklist .work-item').count(),15);
 rejectNext=true;await click('#newTaskForm [type="submit"]');
 await page.locator('#newTaskError').filter({hasText:'permiso denegado'}).waitFor();
 assert.equal(await page.locator('#newTaskChecklist .work-item').count(),15);
 await click('#newTaskForm [type="submit"]');
 await page.locator('#newTaskDialog').waitFor({state:'hidden'});
 await page.locator('#detailDialog .work-progress').filter({hasText:'67%'}).waitFor();
 assert.equal(tables.tasks.length,1);assert.equal(tables.tasks[0].ticket_id,ticket.id);
 await click('#detailDialog [data-action="task"]');
 await page.locator('#taskEditChecklist .work-text').first().fill('Trabajo editado');
 await page.locator('#taskEditChecklist .work-completed').nth(10).check();
 await page.locator('#taskEditStatus').selectOption('BLOQUEADA');
 await page.locator('#taskEditResolution').fill('Resolución parcial');
 await click('[data-action="save-task-update"]');
 await page.locator('#detailDialog .work-progress').filter({hasText:'73%'}).waitFor();
 assert.equal(tables.tasks[0].status,'BLOQUEADA');assert.equal(tables.tasks[0].notes,'Requerimiento original');assert.equal(tables.tasks[0].resolution,'Resolución parcial');
 await click('#detailDialog [data-action="ticket"]');
 await click('#detailDialog [data-action="new-task"]');
 assert.equal(await page.locator('#newTaskTicket').inputValue(),ticket.folio);
 await page.locator('#newTaskCategory').selectOption('COMPRAS');
 assert.equal(await page.locator('#newTaskChecklist').isVisible(),false);
 await page.locator('#newTaskForm [name="taskType"]').fill('COMPRA');
 await page.locator('#newTaskForm [name="title"]').fill('Comprar componente');
 await page.locator('#newTaskOwner').selectOption('Rodolfo Martinez');
 await click('#newTaskForm [type="submit"]');
 await page.locator('#newTaskDialog').waitFor({state:'hidden'});assert.equal(tables.tasks.length,2);
 await click('#detailDialog [data-action="close-dialog"]');
 await page.locator('[data-action="navigate"][data-view="calendar"]').first().click();
 await page.locator('.calendar-event.activity-event').filter({hasText:'73%'}).waitFor();
 await page.reload();
 await page.locator('.calendar-event.activity-event').filter({hasText:'73%'}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS: new ticket; both activity entry points; search; 15 jobs; add/edit/remove/check; category round trip; retained form after error; independent state; notes/resolution; ticket/calendar progress; reload.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
