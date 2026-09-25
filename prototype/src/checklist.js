export const activityCategories = ['OPERACIONES','COMPRAS','ADMINISTRATIVA','COMERCIAL','OTRA'];
export const MAX_WORK_ITEMS = 500;

export function validateChecklist(items) {
  if (!Array.isArray(items) || items.length > MAX_WORK_ITEMS) throw new Error('La lista admite hasta 500 trabajos por actividad.');
  const ids = new Set();
  return items.map(item => {
    if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 1000 || typeof item.completed !== 'boolean') {
      throw new Error('Escribe un texto de hasta 1000 caracteres en cada trabajo; elimina los renglones vacíos.');
    }
    ids.add(item.id);
    return {id:item.id,text:item.text.trim(),completed:item.completed};
  });
}

export function checklistProgress(task) {
  if (task.category && task.category !== 'OPERACIONES' && !task.checklist?.length) return null;
  const items = Array.isArray(task.checklist) ? task.checklist : [];
  const total = items.length;
  const completed = items.filter(item => item.completed === true).length;
  return {total,completed,percent:total ? Math.round(completed / total * 100) : 0};
}

export function validateActivity(payload) {
  if (!payload.title?.trim()) throw new Error('Escribe el nombre de la actividad.');
  if (!payload.startAt) throw new Error('Selecciona la fecha de inicio.');
  if (payload.dueAt && payload.dueAt < payload.startAt) throw new Error('La fecha compromiso no puede ser anterior al inicio.');
  if (payload.category != null && !activityCategories.includes(payload.category)) throw new Error('Selecciona una categoría general válida.');
  if (payload.checklist !== undefined) validateChecklist(payload.checklist);
}
