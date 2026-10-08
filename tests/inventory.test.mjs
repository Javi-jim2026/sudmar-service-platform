import test from 'node:test';
import assert from 'node:assert/strict';
import {inventorySerialKey,inventoryTickets,renderInventoryEquipment,renderInventoryDetails} from '../prototype/src/inventory.js';
const row=(id,serial,status='ENTREGADO')=>({id,source_row:Number(id),serial_number:serial,model:'ESE 340 CW/AS MPP',extraction_ref:'2001',product_line:'PREMIUM POWER',equipment_type:'GENERADORES A DIESEL',quantity:1,status,archived:false,source_snapshot:{serial_number:serial}});
test('inventory keeps duplicate serials as two editable cards, not one device',()=>{
 const inventory=[row('1','89331070/0004'),row('2','89331070/0004')];
 const {html,total,page}=(()=>{const r=renderInventoryEquipment({inventory});return {...r,total:inventory.length};})();
 assert.equal(total,2);assert.equal(page,1);
 assert.equal((html.match(/data-action="inventory-detail"/g)||[]).length,2);
 assert.match(html,/Serie repetida ×2/);
 assert.match(renderInventoryDetails(inventory[0],inventory,[]),/aparece 2 veces/);
});
test('can view archived and counts status without losing active equipment',()=>{
 const old={...row('1','333331/0078'),archived:true};
 assert.doesNotMatch(renderInventoryEquipment({inventory:[old]}).html,/data-action="inventory-detail"/);
 assert.match(renderInventoryEquipment({inventory:[old],archiveMode:'archived'}).html,/data-action="inventory-detail"/);
 assert.equal(inventorySerialKey('89331070/0004 '),'89331070/0004');
});
test('ticket matches current or originally imported serial and remains separate',()=>{
 const r={...row('1','CORREGIDO'),source_snapshot:{serial_number:'333331/0078'}};
 const linked=inventoryTickets(r,[{serial:'333331/0078',folio:'1234'},{serial:'INVALID',folio:'2345'}]);
 assert.equal(linked.length,1);
 assert.equal(linked[0].folio,'1234');
});
