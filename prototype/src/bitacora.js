import {isConcludedStatus, safeEvidenceUrl} from './core.js';
import {evidenceFolders} from './evidence-request.js';

// No database calls: operate exclusively on the snapshot already loaded by SUDMAR.
const value = input => String(input ?? '').trim();
const dateKey = input => /^\d{4}-\d{2}-\d{2}/.test(value(input)) ? value(input).slice(0,10) : '';
const comparableFolio = input => value(input);

export function latestConcludedTicket(tickets, clientName) {
 const name=value(clientName);
 if(!name)return null;
 return (tickets||[])
  .filter(ticket=>value(ticket.client)===name && !ticket.isTest && isConcludedStatus(ticket.status) && dateKey(ticket.closedAt))
  .sort((a,b)=>dateKey(b.closedAt).localeCompare(dateKey(a.closedAt))
    || comparableFolio(b.folio).localeCompare(comparableFolio(a.folio),'es',{numeric:true}))[0]||null;
}

export function buildBitacora(ticket, allTasks=[], generatedAt=new Date()) {
 if(!ticket || !value(ticket.folio))throw Error('No se encontró un ticket válido para la bitácora.');
 const equipment=ticket.isMultiEquipment && Array.isArray(ticket.linkedEquipment) && ticket.linkedEquipment.length
  ? ticket.linkedEquipment : [{model:ticket.model,serial:ticket.serial}];
 const activities=(allTasks||[])
  .filter(task=>value(task.ticketFolio)===value(ticket.folio))
  .map(task=>({
   code:value(task.platformId),
   title:value(task.taskType||task.title)||'Actividad sin título',
   status:value(task.status)||'Sin registrar',
   owner:value(task.owner),
   startAt:dateKey(task.startAt),
   dueAt:dateKey(task.dueAt),
   completedAt:dateKey(task.completedAt),
   createdAt:dateKey(task.createdAt),
   notes:value(task.notes),
   outcome:value(task.outcome),
   resolution:value(task.resolution),
   checklist:Array.isArray(task.checklist)?task.checklist:[],
   evidenceUrl:safeEvidenceUrl(task.evidenceUrl)
  }))
  .sort((a,b)=>(a.completedAt||a.startAt||a.createdAt||'9999').localeCompare(b.completedAt||b.startAt||b.createdAt||'9999')
   || a.code.localeCompare(b.code,'es',{numeric:true}));
 return {
  folio:value(ticket.folio),
  client:value(ticket.client)||'Sin cliente registrado',
  title:value(ticket.title)||'Servicio sin título',
  status:value(ticket.status)||'Sin registrar',
  businessUnit:value(ticket.businessUnit),
  area:value(ticket.area),
  owner:value(ticket.owner),
  openedAt:dateKey(ticket.openedAt),
  resolvedAt:dateKey(ticket.resolvedAt),
  closedAt:dateKey(ticket.closedAt),
  description:value(ticket.description),
  diagnosis:value(ticket.diagnosis),
  technicalFindings:value(ticket.technicalFindings),
  workPerformed:value(ticket.workPerformed),
  finalCondition:value(ticket.finalCondition),
  log:value(ticket.log),
  equipment:equipment.map(unit=>({
   model:value(unit.model),serial:value(unit.serial),
   status:value(unit.status),technician:value(unit.technician),
   attendedAt:dateKey(unit.attendedAt),findings:value(unit.findings),
   workPerformed:value(unit.workPerformed),finalCondition:value(unit.finalCondition),
   evidenceUrl:safeEvidenceUrl(unit.evidenceUrl)
  })),
  activities,
  evidence:evidenceFolders(ticket,allTasks.filter(task=>value(task.ticketFolio)===value(ticket.folio))),
  generatedAt:generatedAt instanceof Date && !Number.isNaN(generatedAt.valueOf())?generatedAt.toISOString():new Date().toISOString(),
  isConcluded:isConcludedStatus(ticket.status),
  isTest:ticket.isTest===true
 };
}

export function bitacoraFileName(record) {
 const slug=value(record.client).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40)||'Cliente';
 const folio=value(record.folio).replace(/[^A-Za-z0-9-]/g,'').slice(0,25)||'SinFolio';
 return 'SUDMAR_Bitacora_'+folio+'_'+slug+'.pdf';
}

const W=595.28, H=841.89, M=43, WIDTH=W-2*M;
const palette={navy:'0.04 0.15 0.29',blue:'0.04 0.37 0.53',teal:'0.07 0.49 0.55',gold:'0.87 0.65 0.26',green:'0.08 0.44 0.30',pale:'0.93 0.96 0.98',paleGreen:'0.88 0.96 0.92',paleAmber:'1 0.95 0.85',white:'1 1 1',gray:'0.34 0.42 0.48',black:'0.12 0.17 0.22'};
const cp1252={'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
function pdfString(text) {
 let result='';
 for(const symbol of value(text).replace(/[\r\n\t]/g,' ')){
  const code=symbol.charCodeAt(0),byte=code<=255?code:cp1252[symbol]??63;
  const char=String.fromCharCode(byte);
  result+=(char==='\\'||char==='('||char===')'?'\\':'')+char;
 }
 return result;
}
function textWidth(text,size=10){
 let total=0;
 for(const c of String(text)){
  total+=('MW@%'.includes(c)?0.86:'il.,;:!| '.includes(c)?0.26:/[0-9]/.test(c)?0.55:0.52)*size;
 }
 return total;
}
function wrap(text,size=10,maxWidth=WIDTH){
 const lines=[];
 for(const raw of String(text||'').split(/\r?\n/)){
  const words=raw.trim().split(/\s+/).filter(Boolean);
  if(!words.length){lines.push('');continue;}
  let line='';
  for(const word of words){
   if(textWidth(word,size)>maxWidth){
    if(line){lines.push(line);line='';}
    let part='';
    for(const char of word){
     if(part && textWidth(part+char,size)>maxWidth){lines.push(part);part='';}
     part+=char;
    }
    line=part;
   }else if(line && textWidth(line+' '+word,size)>maxWidth){
    lines.push(line);line=word;
   }else line+=(line?' ':'')+word;
  }
  if(line)lines.push(line);
 }
 return lines;
}

export function createBitacoraPdf(record) {
 if(!record || !record.folio)throw Error('No hay datos para generar el PDF.');
 const pages=[];
 let current;
 function draw(content){current.commands.push(content);}
 function text(x,y,label,size=10,bold=false,color=palette.black){
  draw('BT /F'+(bold?'2':'1')+' '+size+' Tf '+color+' rg 1 0 0 1 '+x.toFixed(2)+' '+y.toFixed(2)+' Tm ('+pdfString(label)+') Tj ET');
 }
 function fillRect(x,y,width,height,color){draw('q '+color+' rg '+x.toFixed(2)+' '+y.toFixed(2)+' '+width.toFixed(2)+' '+height.toFixed(2)+' re f Q');}
 function rule(y){draw(palette.blue+' RG 0.6 w '+M+' '+y.toFixed(2)+' m '+(W-M)+' '+y.toFixed(2)+' l S');}
 function page(){
  current={commands:[],annotations:[],y:H-91};pages.push(current);
  fillRect(0,H-70,W,70,palette.navy);
  fillRect(0,H-74,W,4,palette.gold);
  text(M,H-43,'SUDMAR  /  ENERGY',16,true,palette.white);
  text(W-M-121,H-42,'SERVICE PLATFORM',8,true,palette.white);
 }
 function stateBanner(){
  enough(40);
  const concluded=record.isConcluded;
  fillRect(M,current.y-11,WIDTH,31,concluded?palette.paleGreen:palette.paleAmber);
  fillRect(M,current.y-11,5,31,concluded?palette.green:palette.gold);
  text(M+14,current.y+1,concluded?'SERVICIO CONCLUIDO':'DOCUMENTO PRELIMINAR',10,true,concluded?palette.green:palette.navy);
  current.y-=46;
 }
 function enough(height=24){if(current.y-height<65)page();}
 function lines(label,{bold=false,size=10,color=palette.black,link=null,indent=0,spacing=4}={}){
  const x=M+indent,parts=wrap(label,size,WIDTH-indent);
  for(const part of parts){
   enough(size+7);
   text(x,current.y,part,size,bold,color);
   if(link&&part)current.annotations.push({url:link,rect:[x,current.y-3,Math.min(W-M,x+textWidth(part,size)+3),current.y+size+3]});
   current.y-=size*1.43;
  }
  current.y-=spacing;
 }
 function section(label){
  enough(51);current.y-=14;
  fillRect(M,current.y-9,WIDTH,26,palette.pale);
  fillRect(M,current.y-9,4,26,palette.gold);
  lines(label.toUpperCase(),{size:10,bold:true,color:palette.navy,indent:13,spacing:16});
 }
 function field(label,entry){
  lines(label+': '+(value(entry)||'No registrado'),{spacing:1});
 }
 function body(label,entry){
  lines(label,{bold:true,color:palette.navy,spacing:0});
  lines(value(entry)||'No documentado en SUDMAR.',{spacing:10});
 }
 function date(dateOnly){if(!dateOnly)return 'Sin fecha';const p=dateOnly.split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:dateOnly;}
 page();
 lines('BITÁCORA DE SERVICIO   |   TICKET #'+record.folio,{size:15,bold:true,color:palette.navy,spacing:7});
 lines(record.title,{size:11,bold:true,spacing:10});
 stateBanner();
 if(!record.isConcluded)lines('AVISO: servicio no concluido; documento preliminar.',{bold:true,color:palette.blue,spacing:9});
 if(record.isTest)lines('AVISO: ticket de prueba; no utilizar como registro de servicio.',{bold:true,color:palette.blue,spacing:9});
 section('Identificación y seguimiento');
 field('Cliente',record.client);
 field('Folio',record.folio);
 field('Estado',record.status);
 field('Unidad / área',[record.businessUnit,record.area].filter(Boolean).join(' / '));
 field('Responsable',record.owner);
 field('Inicio',date(record.openedAt));
 field('Resolución',date(record.resolvedAt));
 field('Cierre real',date(record.closedAt));
 section('Equipos atendidos ('+record.equipment.length+')');
 record.equipment.forEach((unit,index)=>{
  lines('Equipo '+(index+1)+' · '+(unit.model||'Modelo no registrado')+' · Serie '+(unit.serial||'No registrada'),{bold:true,spacing:3});
  if(unit.status)field('Estado del equipo',unit.status);
  if(unit.technician)field('Técnico',unit.technician);
  if(unit.attendedAt)field('Atendido',date(unit.attendedAt));
  if(unit.findings)body('Hallazgos del equipo',unit.findings);
  if(unit.workPerformed)body('Trabajos del equipo',unit.workPerformed);
  if(unit.finalCondition)body('Condición final del equipo',unit.finalCondition);
 });
 section('Descripción y diagnóstico');
 body('Solicitud / descripción',record.description);
 if(record.diagnosis && record.diagnosis!==record.description)body('Diagnóstico registrado',record.diagnosis);
 body('Hallazgos técnicos',record.technicalFindings);
 body('Trabajos realizados',record.workPerformed);
 body('Condición final',record.finalCondition);
 if(record.log){section('Bitácora original');lines(record.log,{spacing:9});}
 section('Cronología de actividades ('+record.activities.length+')');
 if(!record.activities.length)lines('No hay actividades asociadas a este ticket.',{spacing:7});
 record.activities.forEach((activity,index)=>{
  enough(66);
  lines((index+1)+'. '+activity.title+(activity.code?' · '+activity.code:''),{bold:true,color:palette.navy,spacing:3});
  field('Estado / responsable',activity.status+(activity.owner?' / '+activity.owner:''));
  field('Inicio / cierre',[date(activity.startAt),date(activity.completedAt)].join(' / '));
  if(activity.dueAt)field('Fecha programada',date(activity.dueAt));
  if(activity.notes)body('Notas',activity.notes);
  if(activity.outcome)body('Resultado',activity.outcome);
  if(activity.resolution)body('Resolución',activity.resolution);
  if(activity.checklist.length){
   const done=activity.checklist.filter(item=>item&&item.completed===true).length;
   lines('Trabajos internos: '+done+' de '+activity.checklist.length+' marcados como completos.',{spacing:3});
   activity.checklist.forEach(item=>{if(item&&value(item.text))lines((item.completed?'[OK] ':'[ ] ')+item.text,{indent:13,spacing:0});});
  }
  current.y-=7;
 });
 section('Evidencias y documentos');
 const evidence=[...record.evidence];
 for(const unit of record.equipment){
  if(unit.evidenceUrl&&!evidence.some(item=>item.url===unit.evidenceUrl))evidence.push({label:'Evidencia de equipo',url:unit.evidenceUrl});
 }
 if(!evidence.length)lines('No hay enlaces de evidencias registrados. Un enlace no confirma la existencia de archivos.',{spacing:8});
 else for(const item of evidence){lines(item.label,{bold:true,spacing:1});lines(item.url,{size:9,color:palette.blue,link:item.url,spacing:7});}
 section('Control documental');
 lines('Generado desde los registros consultados en SUDMAR el '+new Date(record.generatedAt).toLocaleString('es-MX',{timeZone:'America/Mexico_City'})+'.');
 lines('Documento informativo generado automáticamente: no sustituye una cédula técnica aprobada, un acta firmada ni la revisión de evidencias.',{size:9,color:palette.gray});
 for(let i=0;i<pages.length;i++){
  const prev=current;current=pages[i];
  fillRect(0,0,W,59,palette.pale);
  fillRect(0,57,W,2,palette.gold);
  text(M,38,'SUDMAR · Bitácora automática · Uso interno · Sin firma',8,false,palette.gray);
  text(W-M-73,38,'Página '+(i+1)+' de '+pages.length,8,false,palette.gray);
  current=prev;
 }
 const objects=[null];
 const reserve=()=>{objects.push('');return objects.length-1;};
 const catalogId=reserve(),pagesId=reserve(),regularId=reserve(),boldId=reserve();
 objects[regularId]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
 objects[boldId]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
 const pageIds=[];
 for(const p of pages){
  const pageId=reserve(),streamId=reserve(),annots=[];
  pageIds.push(pageId);
  for(const a of p.annotations){
   const annotId=reserve();annots.push(annotId);
   objects[annotId]='<< /Type /Annot /Subtype /Link /Rect ['+a.rect.map(n=>n.toFixed(2)).join(' ')+'] /Border [0 0 0] /A << /S /URI /URI ('+pdfString(a.url)+') >> >>';
  }
  const stream=p.commands.join('\n')+'\n';
  objects[streamId]='<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream';
  objects[pageId]='<< /Type /Page /Parent '+pagesId+' 0 R /MediaBox [0 0 '+W+' '+H+'] /Resources << /Font << /F1 '+regularId+' 0 R /F2 '+boldId+' 0 R >> >> /Contents '+streamId+' 0 R'+(annots.length?' /Annots ['+annots.map(id=>id+' 0 R').join(' ')+']':'')+' >>';
 }
 objects[pagesId]='<< /Type /Pages /Count '+pageIds.length+' /Kids ['+pageIds.map(id=>id+' 0 R').join(' ')+'] >>';
 objects[catalogId]='<< /Type /Catalog /Pages '+pagesId+' 0 R >>';
 let pdf='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
 const offsets=[0];
 for(let id=1;id<objects.length;id++){offsets.push(pdf.length);pdf+=id+' 0 obj\n'+objects[id]+'\nendobj\n';}
 const xref=pdf.length;
 pdf+='xref\n0 '+objects.length+'\n0000000000 65535 f \n';
 for(let id=1;id<objects.length;id++)pdf+=String(offsets[id]).padStart(10,'0')+' 00000 n \n';
 pdf+='trailer\n<< /Size '+objects.length+' /Root '+catalogId+' 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
 return Uint8Array.from(pdf,character=>character.charCodeAt(0));
}
