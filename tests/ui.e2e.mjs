import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=new URL('../prototype/',import.meta.url);
const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html';const file=new URL(path,root);if(!file.href.startsWith(root.href))throw Error('path');const body=await readFile(file);res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.json')?'application/json':'text/html');res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
const context=await browser.newContext({viewport:{width:1360,height:1000},serviceWorkers:'block',permissions:['clipboard-read','clipboard-write']});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const day='2026-09-25';
const tables={tickets:[{id:'seed',folio:'9000',client_id:'client',title:'Histórico',status:'COBRANZA',legacy_status:'COBRANZA',stage:'Cobranza',business_unit:'SERVICIO',opened_at:day,owner_id:'person',diagnosis:'Texto histórico'}],clients:[{id:'client',name:'Cliente prueba'}],personnel:[{id:'person',name:'Javier Jimenez',role:'Gerente Operativo',area:'Operaciones',operational_areas:['Operaciones']}],equipment:[],tasks:[],equipment_models:[{id:'model',name:'ESE 250 BW/AS',equipment_type:'GENERADORES A DIESEL'}],equipment_serials:[{id:'serial',model_id:'model',serial_number:'89333065/0006'}],service_categories:[{id:'cat1',business_unit:'SUDMAR',name:'Cursos'},{id:'cat2',business_unit:'PRETTL',name:'Garantía'}],activity_types:[{id:'type1',name:'Diagnóstico'},{id:'type2',name:'Instalación'}],activity_statuses:[{name:'POR INICIAR',group_code:'POR INICIAR',description:'Aún no comienza'},{name:'EN EJECUCIÓN',group_code:'EN CURSO',description:'En ejecución'},{name:'EN ESPERA',group_code:'DETENIDA',description:'Dependencia externa'},{name:'BLOQUEADA',group_code:'DETENIDA',description:'Impedimento'},{name:'COMPLETADA',group_code:'CERRADA',description:'Terminó'},{name:'CANCELADA',group_code:'CERRADA',description:'Cancelada',is_cancelled:true}]};
let sequence=9001,rejectNext=false;
await page.route('https://*.supabase.co/rest/v1/**',async route=>{
 const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').pop();let rows=tables[table]||[];
 for(const [key,val]of url.searchParams)if(val.startsWith('eq.'))rows=rows.filter(r=>key==='active'||String(r[key])===val.slice(3));
 if(req.method()==='POST'){
  if(rejectNext){rejectNext=false;return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Permiso denegado de prueba'})});}
  const row={...req.postDataJSON(),id:'new-'+sequence,folio:String(sequence++),updated_at:new Date().toISOString()};tables[table].push(row);rows=[row];
 }
 if(req.method()==='PATCH')for(const row of rows)Object.assign(row,req.postDataJSON());
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows.slice(Number(url.searchParams.get('offset')||0),Number(url.searchParams.get('offset')||0)+1000))});
});
const click=s=>page.locator(s).first().click(),fill=(s,v)=>page.locator(s).fill(v),change=s=>page.locator(s).dispatchEvent('change');
async function add(kind,prefix,name,extra){await click(`[data-action="add-catalog"][data-kind="${kind}"][data-prefix="${prefix}"]`);await fill('#catalogForm [name="name"]',name);if(extra)await extra();await click('#catalogForm [type="submit"]');await page.locator('#catalogDialog').waitFor({state:'hidden'});}
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('#sourceDate').filter({hasText:'Supabase en línea'}).waitFor();
 await click('[data-action="new-ticket"]');
 await page.locator('#newTicketbusinessUnit').selectOption('PRETTL');
 assert.equal(await page.locator('#newTicketclient option[value="Cliente prueba"]').count(),1);
 await fill('#newTicketclientSearch','cliente PRU');assert.equal(await page.locator('#newTicketclient option').count(),2);
 await fill('#newTicketclientSearch','');
 await add('clients','newTicket','Cliente Nuevo');assert.equal(tables.clients.length,2);
 await add('clients','newTicket','  cliente   nuevo ');assert.equal(tables.clients.length,2);
 assert.equal(await page.locator('#newTicketclient').inputValue(),'Cliente Nuevo');
 await page.locator('#newTicketbusinessUnit').selectOption('PRETTL');assert.equal(await page.locator('#newTicketserviceCategoryList option').getAttribute('value'),'Garantía');
 await page.locator('#newTicketbusinessUnit').selectOption('SUDMAR');await add('service_categories','newTicket','Servicio especial');
 await fill('#newTicketmodel','ESE 250 BW/AS');await change('#newTicketmodel');assert.equal(await page.locator('#newTicketequipmentType').inputValue(),'GENERADORES A DIESEL');
 await fill('#newTicketserial','89333065/0006');
 await page.locator('#newTicketowner').selectOption('Javier Jimenez');assert.equal(await page.locator('#newTicketarea').inputValue(),'Operaciones');
 for(const [k,v]of Object.entries({what:'No funciona',where:'Motor de arranque',condition:'Al intentar encender en frío',required:'Diagnóstico eléctrico en sitio'}))await fill('#newTicket'+k,v);
 await page.locator('#newTicketpriority').selectOption('2');
 await click('#newTicketForm [type="submit"]');await page.locator('#newTicketDialog').waitFor({state:'hidden'});
 const ticket=tables.tickets.at(-1);assert.equal(ticket.catalog_model_id,'model');assert.equal(ticket.catalog_serial_id,'serial');assert.equal(ticket.priority,'P2');assert.equal(ticket.operational_status,'REGISTRADO');assert.match(ticket.description,/Motor de arranque/);
 await click('[data-action="new-ticket"]');assert.equal(await page.locator('#newTicketclient option[value="Cliente Nuevo"]').count(),1);
 await add('equipment_models','newTicket','Modelo nuevo',async()=>fill('#catalogForm [name="equipment_type"]','PORTATILES'));assert.equal(await page.locator('#newTicketequipmentType').inputValue(),'PORTATILES');
 await add('equipment_serials','newTicket','SERIE-NUEVA');assert.equal(tables.equipment_serials.at(-1).model_id,tables.equipment_models.at(-1).id);
 await click('#newTicketDialog [data-action="close-dialog"]');
 await click('[data-action="new-task"]');await fill('#newTaskTicketSearch',ticket.folio);await page.locator('#newTaskTicket').selectOption(ticket.folio);
 await fill('#newTasktaskType','Instalación');await page.locator('#newTaskowner').selectOption('Javier Jimenez');await fill('#newTasknotes','Requerimiento original');await fill('#newTaskantecedentFolio','9000');
 for(let i=0;i<16;i++){await click('#newTaskChecklist [data-action="add-work"]');await page.locator('#newTaskChecklist .work-text').last().fill('Trabajo '+i);if(i<10)await page.locator('#newTaskChecklist .work-completed').last().check();}
 await page.locator('#newTaskChecklist [data-action="remove-work"]').last().click();assert.match(await page.locator('#newTaskChecklist .work-summary').innerText(),/67%/);
 rejectNext=true;await click('#newTaskForm [type="submit"]');await page.locator('#newTaskError').filter({hasText:'Permiso denegado'}).waitFor();assert.equal(await page.locator('#newTaskChecklist .work-item').count(),15);
 await click('#newTaskForm [type="submit"]');await page.locator('#newTaskDialog').waitFor({state:'hidden'});assert.equal(tables.tasks.length,1);assert.equal(tables.tasks[0].antecedent_ticket_id,'seed');
 await click('#detailDialog [data-action="task"]');await page.locator('#taskEditChecklist .work-completed').nth(10).check();
 await add('activity_statuses','taskEdit','Esperando acceso',async()=>{await page.locator('#catalogGroup').selectOption('DETENIDA');await fill('#catalogForm [name="description"]','Falta autorización de acceso al sitio.');});
 await click('[data-action="save-task-update"]');await page.locator('#toast').filter({hasText:'Actividad actualizada'}).waitFor();
 await page.locator('#taskEditstatus').selectOption('COMPLETADA');await click('[data-action="save-task-update"]');await page.locator('#toast').filter({hasText:'resultado y la resolución'}).waitFor();
 await fill('#taskEditoutcome','REALIZADA');await fill('#taskEditresolution','Instalación validada');await click('[data-action="save-task-update"]');await page.locator('#toast').filter({hasText:'actualizada'}).waitFor();
 assert.equal(tables.tasks[0].activity_status,'COMPLETADA');assert.equal(tables.tasks[0].notes,'Requerimiento original');assert.equal(tables.tasks[0].checklist.filter(i=>i.completed).length,11);
 await click('#detailDialog [data-action="ticket"]');await fill('#ticketEditTechnicalFindings','Batería descargada');await fill('#ticketEditWorkPerformed','Sustitución de batería');await fill('#ticketEditFinalCondition','Operativo');await page.locator('#ticketEditstatus').selectOption('CONCLUIDO');await click('[data-action="save-ticket-update"]');await page.locator('#cedulaText').filter({hasText:'Sustitución de batería'}).waitFor();
 await click('[data-action="copy-cedula"]');assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/Sustitución de batería/);
 await page.locator('#ticketEditstatus').selectOption('EN EJECUCIÓN');await click('[data-action="save-ticket-update"]');await page.locator('#toast').filter({hasText:'Ticket actualizado'}).waitFor();assert.equal(tables.tickets.at(-1).operational_status,'EN EJECUCIÓN');
 await click('#detailDialog [data-action="close-dialog"]');await click('[data-action="filters"]');await page.locator('#filterForm [name="equipmentType"]').selectOption('GENERADORES A DIESEL');await page.locator('#filterForm [name="priority"]').selectOption('2');await click('#filterForm [type="submit"]');assert.match(await page.locator('#resultAnnouncement').innerText(),/1 tickets/);
 for(const width of [390,768,1360]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await click('[data-action="new-ticket"]');assert.equal(await page.locator('#newTicketDialog').isVisible(),true);await page.screenshot({path:`${process.env.SCREENSHOT_DIR||'.'}/ui-${width}.png`,fullPage:true});await click('#newTicketDialog [data-action="close-dialog"]');}
 assert.deepEqual(errors,[]);console.log('All operational UI flows passed (desktop/tablet/mobile).');
}finally{await browser.close();server.close();}

