import test from 'node:test';import assert from 'node:assert/strict';
test('inventory preserves exact typed values, records prior assignments and refuses repair',async()=>{
 const {planInventory}=await import('./scripts/inventory.mjs');const env={CREDIT_LINK_ORIGINS:'https://credits.example.test'};
 const csv='type,value,status,recipient_email\ncode,SYNTHETIC_ABC-123,unassigned,\nlink,https://credits.example.test/redeem?exact=1,assigned,guest@example.test\ncode,SYNTHETIC_WITHHELD,withheld,\n';
 const p=planInventory(csv,env);assert.equal(p.rows[1].value,'https://credits.example.test/redeem?exact=1');assert.deepEqual(p.summary,{total:3,unassigned:1,assigned:1,withheld:1});
 for(const value of [' SYNTHETIC_ABC','abc def','https://evil.test/a','javascript:alert(1)'])assert.throws(()=>planInventory('type,value,status,recipient_email\nlink,'+value+',unassigned,',env));
 assert.throws(()=>planInventory('type,value,status,recipient_email\ncode,DUPLICATE,unassigned,\ncode,DUPLICATE,unassigned,',env));
 assert.throws(()=>planInventory('type,value,status,recipient_email\ncode,SHORT_ABC,assigned,',env));
});
