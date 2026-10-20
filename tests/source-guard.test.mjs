import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

test('publication guard rejects production bindings, private paths and credential-shaped values',async()=>{
  let ready=true;try{await readFile(new URL('../scripts/check-source.mjs',import.meta.url));}catch{ready=false;}
  assert.equal(ready,true,'Publication source guard is not implemented');
  const {scanText}=await import('../scripts/check-source.mjs');
  assert.equal(scanText('app.js',"const origin='https://"+'cc'+".arca.computer'").some(x=>x==='production-identity'),true);
  assert.equal(scanText('app.js',"const token='ghp_"+'A'.repeat(36)+"'").some(x=>x==='credential-shape'),true);
  assert.equal(scanText('docs.md','See /root/'+'private/data.json').some(x=>x==='private-path'),true);
  assert.deepEqual(scanText('example.json','{"email":"organizer@example.invalid","origin":"https://event.example.invalid"}'),[]);
});
