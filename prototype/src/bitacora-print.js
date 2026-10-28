// Mismo flujo de SUDMAR Diagnóstico: documento HTML y botón window.print().
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const val=v=>String(v??'').trim();
const date=v=>{const p=val(v).slice(0,10).split('-');return p.length===3&&p[0].length===4?p[2]+'/'+p[1]+'/'+p[0]:'Sin fecha';};
const field=(label,v)=>'<div class="dato"><span class="dato-label">'+esc(label)+'</span><span class="dato-val">'+esc(val(v)||'No registrado')+'</span></div>';
const paragraph=(label,v)=>'<h3>'+esc(label)+'</h3><div class="text-block'+(/condici[oó]n final/i.test(label)?' text-success':'')+'">'+esc(val(v)||'No documentado en SUDMAR.')+'</div>';
export function buildPrintableBitacora(record){
 if(!record||!val(record.folio))throw Error('No hay datos para imprimir la bitácora.');
 const equip=(record.equipment||[]).map((unit,i)=>'<article class="unit"><h3>Equipo '+(i+1)+'</h3><div class="datos-grid">'+field('Modelo',unit.model)+field('Serie',unit.serial)+(unit.status?field('Estado',unit.status):'')+(unit.technician?field('Técnico',unit.technician):'')+(unit.attendedAt?field('Atendido',date(unit.attendedAt)):'')+'</div>'+(unit.findings?paragraph('Hallazgos del equipo',unit.findings):'')+(unit.workPerformed?paragraph('Trabajos del equipo',unit.workPerformed):'')+(unit.finalCondition?paragraph('Condición final del equipo',unit.finalCondition):'')+'</article>').join('');
 const activities=(record.activities||[]).map((task,i)=>'<article class="activity"><div class="activity-head"><b>'+(i+1)+'. '+esc(task.title)+'</b><span>'+esc(task.code||'Actividad')+'</span></div><div class="datos-grid">'+field('Estado',task.status)+field('Responsable',task.owner)+field('Inicio',date(task.startAt))+field('Realización',date(task.completedAt))+(task.dueAt?field('Programación',date(task.dueAt)):'')+'</div>'+(task.notes?paragraph('Notas',task.notes):'')+(task.outcome?paragraph('Resultado',task.outcome):'')+(task.resolution?paragraph('Resolución',task.resolution):'')+(task.checklist?.length?'<div class="checklist">'+task.checklist.filter(x=>x&&val(x.text)).map(x=>'<p>'+(x.completed?'☑ ':'☐ ')+esc(x.text)+'</p>').join('')+'</div>':'')+'</article>').join('')||'<p class="empty">No hay actividades asociadas.</p>';
 const links=[...(record.evidence||[]),...(record.equipment||[]).filter(x=>x.evidenceUrl&&!(record.evidence||[]).some(e=>e.url===x.evidenceUrl)).map(x=>({label:'Evidencia del equipo '+x.serial,url:x.evidenceUrl}))];
 const evidence=links.length?'<ul class="evidence">'+links.map(x=>'<li><b>'+esc(x.label)+'</b><a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">'+esc(x.url)+'</a></li>').join('')+'</ul>':'<p class="empty">No hay enlaces de evidencias registrados.</p>';
 const css=[
 '*{box-sizing:border-box}body{margin:0;background:white;color:#1a1a1a;font:13px/1.5 Arial,sans-serif}',
 '.no-print{background:#0a2c4d;padding:12px 16px;display:flex;gap:10px;position:sticky;top:0;z-index:10}',
 '.btn-pdf{background:#efb64d;color:#16304a;border:0;border-radius:8px;padding:12px 20px;font-weight:700;cursor:pointer;flex:1}',
 '.btn-cerrar{background:white;color:#0a2240;border:0;border-radius:8px;padding:12px 20px;font-weight:700;cursor:pointer}',
 '.page{max-width:800px;margin:auto;padding:18px 25px 40px}.report-header{background:linear-gradient(115deg,#0a2d50,#10264b);border-bottom:5px solid #e8ae42;padding:20px 23px;display:flex;justify-content:space-between;gap:15px;align-items:center;border-radius:8px 8px 0 0}',
 '.report-brand{font-size:24px;color:#fff;font-weight:900}.report-brand span{color:#f3c36c}.report-sub{font-size:10px;font-weight:700;color:#dceaf5;text-align:right}',
 'h1{font-size:20px;color:#0a2c4d;margin:21px 7px 12px}h2{font-size:14px;color:#0b3b60;background:#edf5fa;border-left:5px solid #dda53f;margin:23px 7px 12px;padding:9px 12px;border-radius:0 5px 5px 0;break-after:avoid}',
 'h3{font-size:13px;color:#0b6481;margin:12px 7px 6px;break-after:avoid}.notice{background:#e7f5ed;color:#165a3e;border-left:4px solid #20855a;margin:0 7px 18px;padding:10px 13px;border-radius:3px}.notice-pending{background:#fff3d9;color:#75500a;border-left-color:#d49e31}',
 '.datos-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #dbe2ea;border-radius:8px;overflow:hidden;margin:0 7px 13px}',
 '.dato{padding:9px 12px;display:flex;gap:8px;border-bottom:1px solid #e6eef4;min-width:0;overflow-wrap:anywhere}.dato:nth-child(odd){background:#f0f7fb}',
 '.dato-label{min-width:94px;flex-shrink:0;font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase}.dato-val{font-size:12px;font-weight:500;overflow-wrap:anywhere}',
 '.text-block{background:#f6fafc;border:1px solid #deebf2;border-radius:7px;margin:0 7px 12px;padding:12px 14px;white-space:pre-wrap;overflow-wrap:anywhere}.text-success{background:#ebf7ef;border-left:4px solid #1b815c;color:#174c37}',
 '.unit,.activity{border:1px solid #dce9f0;border-radius:8px;margin:10px 7px;padding:10px;break-inside:auto}.unit{border-left:4px solid #15869a}.activity{border-left:4px solid #d9a23d}.unit>h3{color:#0e486b}.activity-head{background:#0a3455;color:white;display:flex;justify-content:space-between;gap:10px;border-radius:6px;padding:8px 10px;break-after:avoid}',
 '.activity-head span{font-size:10px}.checklist{margin:8px 14px}.checklist p{margin:5px 0}.evidence{padding:0 12px;list-style:none}.evidence li{padding:8px;border-bottom:1px solid #e5e7eb;overflow-wrap:anywhere}.evidence b{display:block}.evidence a{color:#1a5fa8;font-size:11px}',
 '.empty{color:#64748b;padding:10px 12px}.disclaimer{margin:28px 7px 0;padding-top:13px;border-top:2px solid #e5e7eb;color:#64748b;font-size:10px}',
 '@page{size:A4;margin:14mm}@media print{.no-print{display:none!important}.page{max-width:none;padding:0}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}h1,h2,h3,.report-header,.activity-head{break-after:avoid}.datos-grid{break-inside:avoid}}',
 '@media(max-width:620px){.page{padding:12px}.datos-grid{grid-template-columns:1fr}.report-header{flex-direction:column;align-items:start}.btn-pdf,.btn-cerrar{padding:10px}}'
 ].join('');
 const html='<header class="report-header"><div class="report-brand">SUDMAR <span>ENERGY</span></div><div class="report-sub">SERVICE PLATFORM · DOCUMENTACIÓN TÉCNICA</div></header>'+
 '<h1>BITÁCORA TÉCNICA DE SERVICIO</h1><p class="notice '+(record.isConcluded?'notice-ok':'notice-pending')+'">'+(record.isConcluded?'Servicio concluido.':'Ticket no concluido: documento preliminar.')+' Información automática sin revisión, firma ni autorización.</p>'+
 '<h2>1. Datos generales</h2><div class="datos-grid">'+field('Ticket','#'+record.folio)+field('Cliente',record.client)+field('Servicio',record.title)+field('Estado',record.status)+field('Unidad',record.businessUnit)+field('Área',record.area)+field('Responsable',record.owner)+field('Inicio',date(record.openedAt))+field('Resolución',date(record.resolvedAt))+field('Cierre real',date(record.closedAt))+'</div>'+
 '<h2>2. Equipos atendidos ('+(record.equipment||[]).length+')</h2>'+equip+
 '<h2>3. Solicitud y diagnóstico</h2>'+paragraph('Solicitud / incidencia',record.description)+(record.diagnosis&&record.diagnosis!==record.description?paragraph('Diagnóstico',record.diagnosis):'')+paragraph('Hallazgos técnicos',record.technicalFindings)+paragraph('Trabajos realizados',record.workPerformed)+paragraph('Condición final',record.finalCondition)+(record.log?paragraph('Bitácora original',record.log):'')+
 '<h2>4. Cronología de actividades ('+(record.activities||[]).length+')</h2>'+activities+
 '<h2>5. Evidencias y documentos</h2>'+evidence+
 '<div class="disclaimer">Documento generado automáticamente a partir de los registros de SUDMAR. Verificar datos y evidencias antes de compartirlo con terceros.</div>';
 return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc('Bitácora SUDMAR #'+record.folio+' — '+record.client)+'</title><style>'+css+'</style></head><body>'+
 '<div class="no-print"><button class="btn-pdf" onclick="window.print()">🖨️ Guardar como PDF</button><button class="btn-cerrar" onclick="history.back()">✕ Volver a SUDMAR</button></div>'+
 '<main class="page">'+html+'</main></body></html>';
}
