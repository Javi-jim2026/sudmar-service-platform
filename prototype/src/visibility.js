// Visibilidad operativa independiente del estado y de los antecedentes históricos.
import {normalized, validSerial} from './core.js';

export const isOperationallyVisible = ticket => ticket.operationalHidden !== true;

export function ticketsByVisibility(tickets, mode='visible') {
  if (mode==='all') return tickets;
  if (mode==='hidden') return tickets.filter(ticket=>!isOperationallyVisible(ticket));
  return tickets.filter(isOperationallyVisible);
}

// La comprobación de antecedentes debe consultar TODOS los tickets, incluidos los ocultos.
export function antecedentsBySerial(tickets, serial) {
  if (!validSerial(serial)) return [];
  const key=normalized(serial);
  return tickets.filter(ticket=>normalized(ticket.serial)===key)
    .sort((a,b)=>(b.openedAt||'').localeCompare(a.openedAt||''));
}
