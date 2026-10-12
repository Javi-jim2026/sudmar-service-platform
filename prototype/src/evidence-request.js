import {safeEvidenceUrl} from './core.js';

// Los enlaces se obtienen de las actividades; se respetan los históricos del ticket.
export function evidenceFolders(ticket,tasks=[]){
 if(!ticket)return [];
 const folders=[],seen=new Set();
 const add=(value,label)=>{
  const url=safeEvidenceUrl(value);
  if(!url||seen.has(url))return;
  seen.add(url);folders.push({url,label});
 };
 if(ticket.evidenceUrl)add(ticket.evidenceUrl,'Carpeta general del ticket');
 for(const [index,task] of tasks.entries()){
  if(!task)continue;
  const code=String(task.platformId??'').trim();
  const description=String(task.taskType||task.title||'').trim();
  const label=['Actividad '+(code||String(index+1)),description].filter(Boolean).join(' · ');
  add(task.evidenceUrl,label);
 }
 return folders;
}

// Mensaje para compartir, sin modificar el ticket ni sus actividades.
export function evidenceRequestMessage(ticket,tasks=[]){
 const folders=evidenceFolders(ticket,tasks);
 if(!folders.length)return null;
 const folio=String(ticket.folio??'').trim()||'Sin folio';
 const client=String(ticket.client??'').trim()||'Sin cliente registrado';
 const title=String(ticket.title??'').trim()||'Servicio sin título';
 const links=folders.length===1
  ?['🔗 *Carpeta de evidencias:*',folders[0].url]
  :['🔗 *Carpetas de evidencias:*',...folders.flatMap(({label,url})=>['','*'+label+'*',url])];
 return [
  '📁 *SOLICITUD DE EVIDENCIAS*',
  '',
  '🎫 *Ticket:* #'+folio,
  '🏢 *Cliente:* '+client,
  '🔧 *Servicio:* '+title,
  '',
  'Buen día, equipo.',
  '',
  'Favor de cargar las evidencias correspondientes a los trabajos realizados en las siguientes carpetas:',
  '',
  ...links,
  '',
  '📸 Incluir fotografías, videos, reportes técnicos y demás documentación disponible.',
  '',
  'Agradecemos confirmar una vez que hayan cargado la información.'
 ].join('\n');
}
