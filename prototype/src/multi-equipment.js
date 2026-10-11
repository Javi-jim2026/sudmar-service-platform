// Gestión multiequipo opcional. Cada serie mantiene su propia intervención.
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const statuses=[['PENDIENTE','Pendiente'],['EN PROCESO','En proceso'],['RESUELTO','Resuelto'],['NO RESUELTO','No resuelto']];
let rowSequence=0;
const escapeUnit=u=>({
  model:u.model||'',serial:u.serial||'',status:u.status||'PENDIENTE',
  technician:u.technician||'',attendedAt:u.attendedAt||'',findings:u.findings||'',
  workPerformed:u.workPerformed||'',finalCondition:u.finalCondition||'',evidenceUrl:u.evidenceUrl||''
});
export function multiEquipmentRow(prefix,rawUnit={},catalogs={models:[],serials:[]}){
 const unit=escapeUnit(rawUnit),key=prefix+'MultiRow'+(++rowSequence);
 const model=catalogs.models.find(m=>norm(m.name)===norm(unit.model));
 const serials=catalogs.serials.filter(s=>s.model_id===model?.id);
 const status=unit.status||'PENDIENTE';
 return `<div class="multi-unit" data-prefix="${esc(prefix)}">
 <div class="multi-unit-head"><strong class="multi-position">Equipo</strong><div class="multi-unit-actions"><button type="button" class="button ghost small" data-action="multi-duplicate">Duplicar modelo</button><button type="button" class="button ghost small" data-action="multi-remove">Quitar</button></div></div>
 <div class="multi-unit-fields">
  <label>Modelo <input class="multi-model" list="${key}Models" maxlength="120" value="${esc(unit.model)}" autocomplete="off" aria-label="Modelo de equipo">
   <datalist id="${key}Models">${catalogs.models.map(m=>`<option value="${esc(m.name)}"></option>`).join('')}</datalist></label>
  <label>Número de serie <input class="multi-serial" list="${key}Serials" maxlength="120" value="${esc(unit.serial)}" autocomplete="off" aria-label="Serie de equipo">
   <datalist id="${key}Serials">${serials.map(s=>`<option value="${esc(s.serial_number)}"></option>`).join('')}</datalist></label>
 </div>
 <div class="multi-catalog-actions"><button type="button" class="text-action" data-action="multi-catalog" data-kind="equipment_models">+ Modelo en catálogo</button><button type="button" class="text-action" data-action="multi-catalog" data-kind="equipment_serials">+ Serie en catálogo</button></div>
 <details class="multi-followup"><summary>Seguimiento individual · <span class="multi-status-label">${esc(status)}</span></summary>
 <div class="multi-unit-fields">
 <label>Estado del equipo <select class="multi-status">${statuses.map(([v,label])=>`<option value="${esc(v)}" ${status===v?'selected':''}>${esc(label)}</option>`).join('')}</select></label>
 <label>Fecha de atención <input class="multi-attended" type="date" value="${esc(unit.attendedAt)}"></label>
 <label>Técnico que atendió <input class="multi-technician" maxlength="120" value="${esc(unit.technician)}"></label>
 <label>Enlace de evidencia <input class="multi-evidence" type="url" maxlength="1000" placeholder="https://..." value="${esc(unit.evidenceUrl)}"></label>
 </div>
 <label>¿Qué encontramos? <textarea class="multi-findings" rows="2" maxlength="5000">${esc(unit.findings)}</textarea></label>
 <label>¿Qué hicimos? <textarea class="multi-work" rows="2" maxlength="5000">${esc(unit.workPerformed)}</textarea></label>
 <label>¿Cómo quedó? <textarea class="multi-condition" rows="2" maxlength="5000">${esc(unit.finalCondition)}</textarea></label>
 </details></div>`;
}
export function multiEquipmentMarkup(prefix,t={},catalogs={}){
 const enabled=t.isMultiEquipment===true;
 const units=enabled&&t.linkedEquipment?.length?t.linkedEquipment:[{model:t.model||'',serial:t.serial||''}];
 return `<div class="multi-feature full-width" id="${prefix}MultiFeature">
 <label class="multi-switch"><input type="checkbox" id="${prefix}MultiEnabled" class="multi-enabled" ${enabled?'checked disabled':''}><span><strong>Gestión multiequipo</strong><small>Opcional · para incidencias que afectan varios equipos, incluso de distintos modelos.</small></span></label>
 <div id="${prefix}MultiPanel" class="multi-panel" ${enabled?'':'hidden'}>
 <p class="definition-note">Cada unidad conserva modelo, serie y resolución propios. Un solo ticket principal.</p>
 <div id="${prefix}MultiRows" class="multi-rows">${units.map(u=>multiEquipmentRow(prefix,u,catalogs)).join('')}</div>
 <button type="button" class="button secondary" data-action="multi-add" data-prefix="${prefix}">+ Agregar equipo</button>
 <label class="multi-bulk-label">Trabajo común a varios equipos (opcional)<textarea id="${prefix}MultiCommonWork" rows="2" placeholder="Describe un trabajo realizado en todas las unidades seleccionadas."></textarea></label>
 <button type="button" class="button secondary small" data-action="multi-apply-work" data-prefix="${prefix}">Aplicar trabajo común a todos sin borrar lo existente</button>
 <p id="${prefix}MultiProgress" class="multi-progress" aria-live="polite"></p>
 </div></div>`;
}
export function updateMultiProgress(prefix){
 const panel=document.getElementById(prefix+'MultiPanel');if(!panel)return;
 const rows=[...panel.querySelectorAll('.multi-unit')];
 rows.forEach((r,i)=>{r.querySelector('.multi-position').textContent='Equipo '+(i+1);const status=r.querySelector('.multi-status').value;r.querySelector('.multi-status-label').textContent=status;});
 const resolved=rows.filter(r=>r.querySelector('.multi-status').value==='RESUELTO').length;
 const target=document.getElementById(prefix+'MultiProgress');
 if(target)target.textContent=rows.length+' equipos vinculados · '+resolved+' resueltos · '+(rows.length-resolved)+' por resolver / revisar.';
}
export function changeMultiMode(prefix,catalogs){
 const toggle=document.getElementById(prefix+'MultiEnabled'),panel=document.getElementById(prefix+'MultiPanel');
 const single=document.getElementById(prefix+'SingleEquipment');if(!toggle||!panel||!single)return;
 panel.hidden=!toggle.checked;single.hidden=toggle.checked;
 if(toggle.checked){
  const first=panel.querySelector('.multi-unit');
  if(first&&!first.querySelector('.multi-model').value){
   first.querySelector('.multi-model').value=document.getElementById(prefix+'model')?.value||'';
   first.querySelector('.multi-serial').value=document.getElementById(prefix+'serial')?.value||'';
   refreshMultiCatalogs(first,catalogs);
  }
 }
 updateMultiProgress(prefix);
}
export function refreshMultiCatalogs(row,catalogs,resetSerial=false){
 if(!row)return;
 const modelInput=row.querySelector('.multi-model'),serialInput=row.querySelector('.multi-serial');
 const modelList=row.querySelector('datalist[id$="Models"]'),serialList=row.querySelector('datalist[id$="Serials"]');
 const model=catalogs.models.find(x=>norm(x.name)===norm(modelInput.value));
 if(modelList)modelList.innerHTML=catalogs.models.map(x=>`<option value="${esc(x.name)}"></option>`).join('');
 if(resetSerial)serialInput.value='';
 if(serialList)serialList.innerHTML=catalogs.serials.filter(x=>x.model_id===model?.id).map(x=>`<option value="${esc(x.serial_number)}"></option>`).join('');
}
export function handleMultiAction(button,catalogs){
 const action=button.dataset.action;
 const prefix=button.dataset.prefix||button.closest('.multi-unit')?.dataset.prefix;
 if(!prefix||!action.startsWith('multi-')||action==='multi-catalog')return false;
 const container=document.getElementById(prefix+'MultiRows'),row=button.closest('.multi-unit');
 if(action==='multi-add'){
  if(container.children.length>=100)throw Error('Máximo 100 equipos por ticket.');
  container.insertAdjacentHTML('beforeend',multiEquipmentRow(prefix,{},catalogs));
 }else if(action==='multi-duplicate'){
  if(container.children.length>=100)throw Error('Máximo 100 equipos por ticket.');
  container.insertAdjacentHTML('beforeend',multiEquipmentRow(prefix,{model:row.querySelector('.multi-model').value},catalogs));
 }else if(action==='multi-remove'){
  if(container.children.length<=1)throw Error('Debe quedar al menos un equipo.');
  const filled=['.multi-findings','.multi-work','.multi-condition'].some(s=>row.querySelector(s).value.trim());
  if(filled&&!confirm('Este equipo tiene seguimiento escrito. ¿Quitarlo del ticket?'))return true;
  row.remove();
 }else if(action==='multi-apply-work'){
  const common=document.getElementById(prefix+'MultiCommonWork')?.value.trim();
  if(!common)throw Error('Escribe el trabajo común antes de aplicarlo.');
  for(const unit of container.querySelectorAll('.multi-unit')){
   const field=unit.querySelector('.multi-work');
   if(!field.value.split('\n').includes(common))field.value=field.value.trim()?field.value.trim()+'\n'+common:common;
  }
 }else return false;
 updateMultiProgress(prefix);return true;
}
export function readMultiEquipment(prefix,catalogs){
 const enabled=document.getElementById(prefix+'MultiEnabled');
 if(!enabled?.checked)return null;
 const rows=[...document.querySelectorAll('#'+prefix+'MultiRows .multi-unit')];
 if(!rows.length||rows.length>100)throw Error('Agrega entre 1 y 100 equipos.');
 const seen=new Set();
 return rows.map((r,i)=>{
  const val=selector=>r.querySelector(selector)?.value.trim()||'';
  const model=catalogs.models.find(x=>norm(x.name)===norm(val('.multi-model')));
  if(!model)throw Error('Equipo '+(i+1)+': selecciona o agrega un modelo del catálogo.');
  const serial=catalogs.serials.find(x=>x.model_id===model.id&&norm(x.serial_number)===norm(val('.multi-serial')));
  if(!serial)throw Error('Equipo '+(i+1)+': selecciona o agrega una serie que corresponda al modelo.');
  if(seen.has(serial.id))throw Error('La serie '+serial.serial_number+' está repetida en este ticket.');
  seen.add(serial.id);
  const status=val('.multi-status'),evidenceUrl=val('.multi-evidence');
  if(!statuses.some(s=>s[0]===status))throw Error('Estado de equipo inválido.');
  if(evidenceUrl&&!/^https?:\/\//i.test(evidenceUrl))throw Error('La evidencia del equipo '+(i+1)+' debe ser una URL http(s).');
  return {modelId:model.id,serialId:serial.id,position:i+1,status,technician:val('.multi-technician'),attendedAt:val('.multi-attended')||null,
   findings:val('.multi-findings'),workPerformed:val('.multi-work'),finalCondition:val('.multi-condition'),evidenceUrl};
 });
}
export function multiSummary(ticket){
 const rows=ticket.linkedEquipment||[];
 if(!ticket.isMultiEquipment)return '';
 const done=rows.filter(x=>x.status==='RESUELTO').length;
 return `<span class="badge blue">Multiequipo · ${rows.length} unidades · ${done} resueltas</span`;
}
