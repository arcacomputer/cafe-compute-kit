import test from 'node:test';import assert from 'node:assert/strict';
test('database binding keeps SQL parameterized and executes transaction on binding',async()=>{
 const { databaseFor }=await import('./database.js');const calls=[];
 const binding={query:async(q,p)=>{calls.push([q,p]);return [{ok:true}]},transaction:async statements=>{calls.push(statements);return []}};
 const sql=databaseFor({TEST_DATABASE:binding});await sql`SELECT ${'untrusted'} AS value`;assert.deepEqual(calls[0],['SELECT $1 AS value',['untrusted']]);
 await sql.transaction([sql`SELECT ${1}`,sql`SELECT ${2}`]);assert.equal(calls.length,2);assert.deepEqual(calls[1],[{text:'SELECT $1',values:[1]},{text:'SELECT $1',values:[2]}]);
});
