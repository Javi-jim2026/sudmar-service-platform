// Visibilidad operativa independiente del estado y de los antecedentes históricos.
import {normalized, validSerial, ticketSerials} from './core.js';

export const isOperationallyVisible = ticket => ticket.operationalHidden !== true;

export function ticketsByVisibility(tickets, mode='visible') {
  if (mode==='all') return tickets;
  if (mode==='hidden') return tickets.filter(ticket=>!isOperationallyVisible(ticket));
  return tickets.filter(isOperationallyVisible);
}

// Distintos formatos históricos: un ticket puede contener varias series separadas
// por saltos de línea, comas, punto y coma o barras verticales. Nunca dividir por '/'.
export function serialsInTicket(ticket) {
  const values=ticketSerials(ticket||{});
  const collected=new Map();
  for(const raw of values){
    for(const segment of String(raw).split(/[\r\n;,|]+/)){
      const serial=segment.trim(),key=normalized(serial);
      if(validSerial(serial)&&!collected.has(key))collected.set(key,serial);
    }
  }
  return [...collected.values()];
}

// Siempre consultar TODOS los tickets, incluso los desactivados, con coincidencia exacta.
export function antecedentsBySerial(tickets, serial) {
  if (!validSerial(serial)) return [];
  const key=normalized(serial);
  return tickets.filter(ticket=>serialsInTicket(ticket).some(s=>normalized(s)===key))
    .sort((a,b)=>(b.openedAt||'').localeCompare(a.openedAt||'')||String(b.folio||'').localeCompare(String(a.folio||''),'es',{numeric:true}));
}

// Relación calculada en memoria; no modifica folios, estados ni vínculos de Supabase.
// Un mismo número de serie en distintos tickets no prueba que sea la misma falla.
export function relatedTicketSerials(tickets, currentTicket) {
  if(!currentTicket)return [];
  return serialsInTicket(currentTicket).map(serial=>({
    serial,
    tickets:antecedentsBySerial(tickets,serial).filter(other=>other.id!==currentTicket.id)
  })).filter(group=>group.tickets.length>0);
}
