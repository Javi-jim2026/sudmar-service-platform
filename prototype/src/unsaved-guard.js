// Protección de los formularios de tickets y actividades, sin escrituras al servidor.
const guards=new Map();
const capture=root=>JSON.stringify([...root.querySelectorAll('input,select,textarea')]
 .filter(el=>!['button','submit','reset','hidden'].includes(el.type)&&!el.closest('.ops-picker'))
 .map((el,index)=>[el.id||el.name||index,el.type==='checkbox'||el.type==='radio'?el.checked:el.value]));
export function isUnsaved(dialog){
 const state=guards.get(dialog);
 return !!(state?.interacted&&dialog.open&&state.root.isConnected&&capture(state.root)!==state.initial);
}
export function armUnsaved(dialog,root){
 if(!dialog?.open||!root)return;
 const state={root,initial:capture(root),interacted:false};guards.set(dialog,state);
 // Los componentes complementarios se inicializan en microtareas al abrir.
 requestAnimationFrame(()=>{if(guards.get(dialog)===state&&!state.interacted&&dialog.open)state.initial=capture(root);});
}
export function clearUnsaved(dialog){guards.delete(dialog);}
export function confirmDiscard(dialog){
 if(!isUnsaved(dialog)){clearUnsaved(dialog);return true;}
 if(!window.confirm('Tienes cambios sin guardar. Si sales, perderás la información capturada.\n\n¿Descartar cambios y salir?'))return false;
 clearUnsaved(dialog);return true;
}
function fieldChanged(event){
 const dialog=event.target.closest?.('dialog'),state=guards.get(dialog);
 if(state?.root.contains(event.target))state.interacted=true;
}
function structureChanged(event){
 const button=event.target.closest?.('[data-action]');
 if(!button||!['add-work','remove-work','multi-add','multi-remove','multi-duplicate','multi-apply-work'].includes(button.dataset.action))return;
 const dialog=button.closest('dialog'),state=guards.get(dialog);
 if(state?.root.contains(button))state.interacted=true;
}
export function installUnsavedProtection(){
 document.addEventListener('input',fieldChanged,true);
 document.addEventListener('change',fieldChanged,true);
 document.addEventListener('click',structureChanged,true);
 document.addEventListener('cancel',event=>{
  const dialog=event.target;
  if(dialog instanceof HTMLDialogElement&&guards.has(dialog)&&!confirmDiscard(dialog))event.preventDefault();
 },true);
 document.addEventListener('close',event=>{
  if(event.target instanceof HTMLDialogElement)clearUnsaved(event.target);
 },true);
 window.addEventListener('beforeunload',event=>{
  if(![...guards.keys()].some(isUnsaved))return;
  event.preventDefault();
  event.returnValue='';
 });
}
