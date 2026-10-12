// Orden y filtros de la lista de tickets: únicamente lectura, sin tocar Supabase.
export const TICKET_PAGE_SIZES=['20','50','100','all'];
export const TICKET_DATE_FIELDS={
  openedAt:{label:'Fecha de inicio',missing:'Inicio no registrado'},
  dueAt:{label:'Meta de cierre',missing:'Meta no registrada'},
  closedAt:{label:'Cierre real',missing:'Cierre no registrado'}
};
export const TICKET_DATE_PRESENCE=['all','with','missing'];
export function ticketPageLimit(value,total){
  if(value==='all')return Math.max(1,total);
  return TICKET_PAGE_SIZES.includes(String(value))?Number(value):20;
}
export function filterTicketDatePresence(tickets,dateField='dueAt',presence='all'){
  if(!TICKET_DATE_PRESENCE.includes(presence)||presence==='all')return tickets;
  const field=Object.hasOwn(TICKET_DATE_FIELDS,dateField)?dateField:'dueAt';
  return tickets.filter(ticket=>(String(ticket[field]??'').trim()!=='')===(presence==='with'));
}
function compareFolios(a,b,direction){
  const x=String(a.folio??'').trim(),y=String(b.folio??'').trim();
  const xNumeric=/^\d+$/.test(x),yNumeric=/^\d+$/.test(y);
  // Folios históricos alfanuméricos al final en ambas direcciones.
  if(xNumeric!==yNumeric)return xNumeric?-1:1;
  if(xNumeric&&yNumeric){
    const ax=BigInt(x),by=BigInt(y);
    if(ax!==by)return (ax<by?-1:1)*direction;
  }
  return x.localeCompare(y,'es',{numeric:true,sensitivity:'base'})*direction;
}
export function sortTicketList(tickets,field='folio',order='desc',selectedDateField='dueAt'){
  const direction=order==='asc'?1:-1;
  const dateField=Object.hasOwn(TICKET_DATE_FIELDS,selectedDateField)?selectedDateField:'dueAt';
  const fieldToSort=field==='date'?dateField:field;
  return [...tickets].sort((a,b)=>{
    if(Object.hasOwn(TICKET_DATE_FIELDS,fieldToSort)){
      const da=String(a[fieldToSort]||'').slice(0,10),db=String(b[fieldToSort]||'').slice(0,10);
      if(!da&&db)return 1;
      if(da&&!db)return -1;
      if(da!==db)return da.localeCompare(db)*direction;
    }
    return compareFolios(a,b,direction);
  });
}
