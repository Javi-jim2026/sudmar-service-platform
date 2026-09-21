import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blankFilters,filterTickets,linkedTasks,metrics,isOverdue,taskComplete,equipmentGroups,safeEvidenceUrl,toCsv} from '../prototype/src/core.js';
const data=JSON.parse(readFileSync(new URL('../prototype/data/operations.json',import.meta.url),'utf8'));
const today='2026-09-21';

test('Import preserves all source ticket and task rows, including incomplete tasks',()=>{
 assert.equal(data.tickets.length,574);assert.equal(data.tasks.length,3475);
 assert.equal(data.tasks.filter(t=>!t.title).length,22);
 assert.equal(new Set(data.tickets.map(t=>t.folio)).size,574);
 assert.equal(data.tasks.filter(t=>!data.tickets.some(x=>x.folio===t.ticketFolio)).length,0);
 assert.equal(data.tickets.filter(t=>t.status==='CERRADO').length,432);
 assert.equal(data.tasks.filter(taskComplete).length,3271);
});
test('Combined filters and dates operate on the same ticket set used by all KPIs',()=>{
 const t=data.tickets.find(t=>t.folio==='2650');
 const filters={...blankFilters(),client:t.client,businessUnit:t.businessUnit,area:t.area,stage:t.stage,folio:'2650',from:t.openedAt,to:t.openedAt};
 const actual=filterTickets(data.tickets,filters,today);assert.deepEqual(actual,[t]);
 const totals=metrics(actual,data.tasks,today);assert.equal(totals.total,1);
 assert.equal(totals.tasks,data.tasks.filter(x=>x.ticketFolio==='2650').length);
 assert.equal(filterTickets(data.tickets,{...filters,area:'COMERCIAL'},today).length,0);
});
test('Invalid source state stays visible and is not silently treated as active',()=>{
 const m=metrics(data.tickets,data.tasks,today);assert.equal(m.unknown,1);assert.equal(m.active,141);assert.equal(m.closed+m.active+m.unknown,m.total);
});
test('Overdue excludes closed, unknown, missing dates and the current date',()=>{
 const base={status:'ABIERTO',dueAt:'2026-09-20'};
 assert.equal(isOverdue(base,today),true);
 for(const t of [{...base,status:'CERRADO'},{...base,status:'<'},{...base,dueAt:null},{...base,dueAt:today}])assert.equal(Boolean(isOverdue(t,today)),false);
});
test('Text search ignores accents, task joins are exact, and equipment keeps model variants',()=>{
 const t={id:'x',folio:'123',title:'Revisión',client:'Árbol',model:'M',serial:'SN 1',status:'ABIERTO'};
 assert.equal(filterTickets([t],{...blankFilters(),q:'revision'},today).length,1);
 assert.deepEqual(linkedTasks([t],[{ticketFolio:'12'},{ticketFolio:'123'}]),[{ticketFolio:'123'}]);
 const groups=equipmentGroups([t,{...t,id:'y',model:'M2',serial:'sn 1'},{...t,serial:'NA'}]);
 assert.equal(groups.length,1);assert.deepEqual(groups[0].models,['M','M2']);
});
test('Evidence links and CSV output reject executable links and spreadsheet formulas',()=>{
 assert.equal(safeEvidenceUrl('javascript:alert(1)'),null);assert.equal(safeEvidenceUrl('file:///etc/passwd'),null);
 assert.equal(safeEvidenceUrl('https://example.com/a'),'https://example.com/a');
 const csv=toCsv([{v:'=1+1'},{v:'Hola; "mundo"\nsegunda línea'}],[{key:'v',label:'Campo'}]);
 assert.ok(csv.startsWith('\ufeff'));assert.ok(csv.includes("'"+'=1+1'));assert.ok(csv.includes('""mundo""'));
});
