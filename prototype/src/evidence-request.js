import {safeEvidenceUrl} from './core.js';

// Copia un mensaje con los datos del ticket, sin escribir en la base de datos.
export function evidenceRequestMessage(ticket){
 const url=safeEvidenceUrl(ticket?.evidenceUrl);
 if(!url)return null;
 const folio=String(ticket.folio??'').trim()||'Sin folio';
 const client=String(ticket.client??'').trim()||'Sin cliente registrado';
 const title=String(ticket.title??'').trim()||'Servicio sin título';
 return [
  '📁 *SOLICITUD DE EVIDENCIAS*',
  '',
  '🎫 *Ticket:* #'+folio,
  '🏢 *Cliente:* '+client,
  '🔧 *Servicio:* '+title,
  '',
  'Buen día, equipo.',
  '',
  'Favor de cargar las evidencias correspondientes a los trabajos realizados en la siguiente carpeta:',
  '',
  '🔗 *Carpeta de evidencias:*',
  url,
  '',
  '📸 Incluir fotografías, videos, reportes técnicos y demás documentación disponible.',
  '',
  'Agradecemos confirmar una vez que hayan cargado la información.'
 ].join('\n');
}
