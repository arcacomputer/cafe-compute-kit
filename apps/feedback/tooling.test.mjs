import test from 'node:test';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';import {readFile} from 'node:fs/promises';
import {enforcePrivatePath} from './scripts/operator.mjs';
test('operator private paths cannot be elsewhere inside the monorepo',()=>{assert.throws(()=>enforcePrivatePath(new URL('../../private.csv',import.meta.url).pathname));});
test('proof commands fail explicitly without disposable database prerequisites',()=>{
 for(const script of ['proof-postgres.mjs','proof-browser.mjs']){
  const env={...process.env};delete env.PROOF_DATABASE_URL;delete env.PROOF_DISPOSABLE;
  const r=spawnSync(process.execPath,['--max-old-space-size=384',new URL('./scripts/'+script,import.meta.url).pathname],{env,encoding:'utf8',timeout:10000});assert.equal(r.status,1);assert.match(r.stderr,/disposable|PostgreSQL/);assert.ok(!r.stdout.includes('passed'));
 }
});
test('every advertised app script exists and tooling pins match the root contract',async()=>{
 const p=JSON.parse(await readFile(new URL('./package.json',import.meta.url)));
 assert.equal(p.name,'@cafe-compute-kit/feedback');for(const key of ['build','test:unit','test:postgres','test:browser'])assert.equal(typeof p.scripts[key],'string');
 for(const command of Object.values(p.scripts)){for(const x of command.matchAll(/scripts\/[a-z-]+\.mjs/g))await readFile(new URL(x[0],import.meta.url));}
 assert.equal(p.devDependencies.wrangler,'4.151.2');assert.equal(p.devDependencies.playwright,'1.64.1');
});
