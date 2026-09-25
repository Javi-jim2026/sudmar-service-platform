export const ticketStates={
 'REGISTRADO':'Creado, aún sin ejecución definida.',
 'PROGRAMADO':'Ya tiene responsable, fecha o plan.',
 'EN EJECUCIÓN':'Trabajo operativo iniciado.',
 'EN ESPERA':'Depende de cliente, refacción, información, acceso, autorización u otro factor externo.',
 'BLOQUEADO':'Impedimento concreto que no permite continuar.',
 'PENDIENTE DE VALIDACIÓN':'Trabajo terminado; faltan pruebas o confirmación técnica.',
 'CONCLUIDO':'No queda trabajo operativo pendiente.',
 'CANCELADO':'El servicio ya no se realizará.'
};
export const slaHelp='SLA-01: atención crítica. SLA-02: atención alta. SLA-03: atención normal. SLA-04: atención planificada. Indican orden de atención técnica; los tiempos se acuerdan en la fecha objetivo.';
export const slaColors={'1':'#c74444','2':'#dc7b22','3':'#168ca8','4':'#788390'};
export const requestQuestions={what:'¿Qué sucede?',where:'¿Dónde / en qué componente?',condition:'¿En qué condición ocurre?',required:'¿Qué se requiere realizar?'};
export const catalogKey=v=>String(v??'').trim().replace(/\s+/g,' ').toUpperCase();
export function requestSummary(context){return context?`${context.what} · ${context.where} · ${context.condition}. Se requiere: ${context.required}`:'';}
export function validateRequest(context){
 for(const [key,label] of Object.entries(requestQuestions))if(!context||String(context[key]||'').trim().length<4)throw Error(`Completa ${label} con información concreta.`);
 const detail=[context.where,context.condition,context.required].join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const generic=/^(presenta falla|revisar equipo|no funciona|cliente reporta problema|sin datos|no se sabe|no aplica|pendiente|equipo|falla|revision|normal|ninguna)$/;
 if([context.where,context.condition,context.required].filter(x=>!generic.test(String(x).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''))).length<2||detail.length<24)throw Error('Agrega el componente, la condición y la acción requerida; la solicitud necesita contexto.');
 return context;
}
export function operationalGroup(status){return ({REGISTRADO:'Pendientes',PROGRAMADO:'Pendientes','EN EJECUCIÓN':'Activos','EN ESPERA':'Detenidos',BLOQUEADO:'Detenidos','PENDIENTE DE VALIDACIÓN':'Por validar',CONCLUIDO:'Terminados',CANCELADO:'Terminados'})[status]||'Por clasificar';}
export function cedulaSummary(t){return [['Ticket',`#${t.folio}`],['Cliente',t.client],['Equipo',[t.model,t.serial].filter(Boolean).join(' · ')],['Solicitud / incidencia reportada',t.description||t.title],['Hallazgo / diagnóstico técnico',t.technicalFindings],['Trabajo realizado / resolución',t.workPerformed],['Resultado / condición final',t.finalCondition],['Estado',t.status],['Cierre real',t.closedAt]].filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`).join('\n');}
