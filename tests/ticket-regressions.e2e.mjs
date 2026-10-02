import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const {chromium}=createRequire(import.meta.url)('playwright');
const root=new URL('../prototype/',import.meta.url);
const server=createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html';
    const file=new URL(path,root);
    if(!file.href.startsWith(root.href))throw Error('path');
    const body=await readFile(file);
    res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.json')?'application/json':'text/html');
    res.end(body);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));

const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
const context=await browser.newContext({viewport:{width:1360,height:1000},serviceWorkers:'block'});
const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',error=>pageErrors.push(error.message));

const day='2026-10-02';
const simpleSentinel='__SUDMAR_SIMPLE_REQUEST__';
const fullRequest={what:'Cliente reporta falla de arranque',where:'Motor de arranque',condition:'Al intentar encender',required:'Realizar diagnóstico eléctrico'};
const tables={
  tickets:[{
    id:'historic',folio:'9100',client_id:'client',owner_id:'commercial',area:'Comercial',title:'Ticket comercial histórico',description:'Solicitud histórica completa',
    operational_status:'REGISTRADO',status:'REGISTRADO',business_unit:'SUDMAR',service_category_id:'cat1',opened_at:day,request_context:fullRequest,
    updated_at:new Date().toISOString()
  }],
  clients:[{id:'client',name:'Cliente prueba'}],
  personnel:[
    {id:'ops',name:'Javier Jimenez',role:'Gerente Operativo',area:'Operaciones',operational_areas:['Operaciones'],active:true},
    {id:'services',name:'Daniel Hernández',role:'Servicios',area:'Servicios Especializados',operational_areas:['Servicios Especializados'],active:true},
    {id:'warehouse',name:'Hernán Reyes',role:'Técnico',area:'Almacén Fiscal',operational_areas:['Almacén Fiscal'],active:true},
    {id:'projects',name:'Enrique González',role:'Proyectos',area:'Proyectos',operational_areas:['Proyectos'],active:true},
    {id:'commercial',name:'Dulce Flores',role:'Ventas',area:'Comercial',operational_areas:['Comercial'],active:true}
  ],
  equipment:[],tasks:[],equipment_models:[],equipment_serials:[],
  service_categories:[{id:'cat1',business_unit:'SUDMAR',name:'Cursos'}],
  activity_types:[{id:'type1',name:'Diagnóstico'}],
  activity_statuses:[
    {name:'POR INICIAR',group_code:'POR INICIAR',description:'Aún no comienza'},
    {name:'EN EJECUCIÓN',group_code:'EN CURSO',description:'En ejecución'},
    {name:'EN ESPERA',group_code:'DETENIDA',description:'Dependencia externa'},
    {name:'BLOQUEADA',group_code:'DETENIDA',description:'Impedimento'},
    {name:'COMPLETADA',group_code:'CERRADA',description:'Terminó'},
    {name:'CANCELADA',group_code:'CERRADA',description:'Cancelada',is_cancelled:true}
  ]
};
let idSequence=1;

await page.route('https://*.supabase.co/rest/v1/**',async route=>{
  const req=route.request();
  const url=new URL(req.url());
  const table=url.pathname.split('/').pop();
  let rows=tables[table]||[];
  for(const [key,val] of url.searchParams){
    if(!val.startsWith('eq.'))continue;
    const expected=val.slice(3);
    if(key==='active')rows=rows.filter(row=>row.active!==false);
    else rows=rows.filter(row=>String(row[key]??'')===expected);
  }
  if(req.method()==='POST'){
    const body=req.postDataJSON();
    const row={id:`created-${idSequence++}`,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),...body};
    tables[table].push(row);rows=[row];
  }
  if(req.method()==='PATCH'){
    const body=req.postDataJSON();
    for(const row of rows)Object.assign(row,body,{updated_at:new Date().toISOString()});
  }
  const offset=Number(url.searchParams.get('offset')||0);
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows.slice(offset,offset+1000))});
});

const click=selector=>page.locator(selector).first().click();
const fill=(selector,value)=>page.locator(selector).fill(value);

try{
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#sourceDate').filter({hasText:'Supabase en línea'}).waitFor();

  // Existing commercial tickets with a full guided request must keep all four fields.
  await click('[data-action="ticket"][data-id="historic"]');
  await page.locator('#ticketEditTitleInput').waitFor();
  assert.equal(await page.locator('#ticketEditwhat').isVisible(),true);
  assert.equal(await page.locator('#ticketEditwhere').isVisible(),true);
  assert.equal(await page.locator('#ticketEditcondition').isVisible(),true);
  assert.equal(await page.locator('#ticketEditrequired').isVisible(),true);
  assert.equal((await page.locator('#detailDialog').innerText()).includes(simpleSentinel),false);
  await click('#detailDialog [data-action="close-dialog"]');

  // Operations, Specialized Services, Fiscal Warehouse and Projects all use full technical capture.
  for(const [owner,area] of [
    ['Javier Jimenez','Operaciones'],
    ['Daniel Hernández','Servicios Especializados'],
    ['Hernán Reyes','Almacén Fiscal'],
    ['Enrique González','Proyectos']
  ]){
    await click('[data-action="new-ticket"]');
    await page.locator('#newTicketTitleInput').waitFor();
    await page.locator('#newTicketowner').selectOption(owner);
    await page.locator('#newTicketowner').dispatchEvent('change');
    await page.waitForFunction(expected=>document.querySelector('#newTicketarea')?.value===expected,area);
    assert.equal(await page.locator('#newTicketwhat').isVisible(),true,`${area} debe mostrar ¿Qué sucede?`);
    assert.equal(await page.locator('#newTicketwhere').isVisible(),true,`${area} debe mostrar ¿Dónde / en qué componente?`);
    assert.equal(await page.locator('#newTicketcondition').isVisible(),true,`${area} debe mostrar ¿En qué condición ocurre?`);
    assert.equal(await page.locator('#newTicketrequired').isVisible(),true,`${area} debe mostrar ¿Qué se requiere realizar?`);
    await click('#newTicketDialog [data-action="close-dialog"]');
  }

  // A new Commercial ticket must switch to the simplified request capture.
  await click('[data-action="new-ticket"]');
  await page.locator('#newTicketTitleInput').waitFor();
  await page.locator('#newTicketbusinessUnit').selectOption('SUDMAR');
  await page.locator('#newTicketclient').selectOption('Cliente prueba');
  await fill('#newTicketserviceCategory','Cursos');
  await page.locator('#newTicketowner').selectOption('Dulce Flores');
  await page.locator('#newTicketowner').dispatchEvent('change');
  await page.waitForFunction(()=>document.querySelector('#newTicketarea')?.value==='Comercial');
  await page.waitForFunction(()=>document.querySelector('#newTicketwhat')?.closest('.field')?.hidden===true);
  assert.equal(await page.locator('#newTicketwhat').isVisible(),false);
  assert.equal(await page.locator('#newTicketwhere').isVisible(),false);
  assert.equal(await page.locator('#newTicketcondition').isVisible(),false);
  assert.equal(await page.locator('#newTicketrequired').isVisible(),true);

  await fill('#newTicketrequired','Enviar cotización de filtros para mantenimiento');
  await fill('#newTicketTitleInput','Cotización de filtros de mantenimiento');
  await fill('#newTicketfolio','COM-001');
  await click('#newTicketForm [type="submit"]');
  await page.locator('#newTicketDialog').waitFor({state:'hidden'});

  const created=tables.tickets.find(ticket=>ticket.folio==='COM-001');
  assert.ok(created,'El ticket simplificado debe guardarse.');
  assert.equal(created.request_context.what,simpleSentinel);
  assert.equal(created.request_context.where,simpleSentinel);
  assert.equal(created.request_context.condition,simpleSentinel);
  assert.equal(created.request_context.required,'Enviar cotización de filtros para mantenimiento');
  assert.equal(created.title,'Cotización de filtros de mantenimiento');
  assert.equal(created.description,'Enviar cotización de filtros para mantenimiento');

  // Opening the simplified ticket must never expose sentinel implementation values.
  await click(`[data-action="ticket"][data-id="${created.id}"]`);
  await page.locator('#ticketEditTitleInput').waitFor();
  assert.equal((await page.locator('#detailDialog').innerText()).includes(simpleSentinel),false);
  assert.equal(await page.locator('#ticketEditwhat').isVisible(),false);
  assert.equal(await page.locator('#ticketEditwhere').isVisible(),false);
  assert.equal(await page.locator('#ticketEditcondition').isVisible(),false);
  assert.equal(await page.locator('#ticketEditrequired').isVisible(),true);

  // Manual title edits must be included in PATCH and remain visible after app.js re-renders the detail.
  await fill('#ticketEditTitleInput','Cotización filtros Cummins');
  const patchPromise=page.waitForRequest(request=>request.method()==='PATCH'&&request.url().includes('/rest/v1/tickets?'));
  await click('[data-action="save-ticket-update"]');
  const patch=await patchPromise;
  assert.equal(patch.postDataJSON().title,'Cotización filtros Cummins');
  await page.locator('#toast').filter({hasText:'Ticket actualizado'}).waitFor();
  await page.locator('#ticketEditTitleInput').waitFor();
  assert.equal(await page.locator('#ticketEditTitleInput').inputValue(),'Cotización filtros Cummins');
  assert.equal(created.title,'Cotización filtros Cummins');
  assert.equal(created.description,'Enviar cotización de filtros para mantenimiento');
  assert.equal((await page.locator('#detailDialog').innerText()).includes(simpleSentinel),false);

  assert.deepEqual(pageErrors,[]);
  console.log('Ticket regression flows passed: title persistence, simplified capture, technical-area capture, historical compatibility.');
}finally{
  await browser.close();
  server.close();
}
