// Ordenación determinista, sin modificar el arreglo original ni los registros.
export const TICKET_PAGE_SIZES=['20','50','100','all'];
export function ticketPageLimit(value,total){
  if(value==='all')return Math.max(1,total);
  return TICKET_PAGE_SIZES.includes(String(value))?Number(value):20;
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
export function sortTicketList(tickets,field='folio',order='desc'){
  const direction=order==='asc'?1:-1;
  return [...tickets].sort((a,b)=>{
    if(field==='dueAt'){
      const da=String(a.dueAt||'').slice(0,10),db=String(b.dueAt||'').slice(0,10);
      if(!da&&db)return 1;
      if(da&&!db)return -1;
      if(da!==db)return da.localeCompare(db)*direction;
    }
    return compareFolios(a,b,direction);
  });
}
