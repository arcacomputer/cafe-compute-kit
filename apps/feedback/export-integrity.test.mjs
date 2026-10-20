import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const id='22222222-2222-4222-8222-222222222222',bytes=[255,216,255,224],digest=createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
test('actual export CLI rejects equal-length bytes with a different captured digest',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cc-export-integrity-'));
 try{
  const cookie=join(dir,'cookie'),out=join(dir,'export');await writeFile(cookie,'__Host-cc_session='+'a'.repeat(64),{mode:0o600});
  const row={id,photos:[{key:`feedback/${id}/photo-19-${digest}.jpg`,type:'image/jpeg',bytes:4}],payload:{name:'Synthetic'}};
  // No sockets or DB: only the fetch boundary is synthetic. The exporter is the
  // unmodified real CLI, including staging, digest verification and exit code.
  const hook=`globalThis.fetch=async url=>String(url).includes('/admin/export')?new Response(JSON.stringify({rows:[${JSON.stringify(row)}],nextCursor:null}),{headers:{'Content-Type':'application/json'}}):new Response(Uint8Array.of(255,216,255,225),{headers:{'Content-Type':'image/jpeg'}});`;
  const r=spawnSync(process.execPath,['--max-old-space-size=384','--import=data:text/javascript,'+encodeURIComponent(hook),new URL('./scripts/export-private.mjs',import.meta.url).pathname,'--cookie-file',cookie,'--out',out],{encoding:'utf8',timeout:10000,env:{...process.env,PUBLIC_ORIGIN:'https://feedback.example.test'}});
  assert.equal(r.status,1,r.stderr);assert.equal(JSON.parse(await readFile(out+'.incomplete/INCOMPLETE.json','utf8')).complete,false);await assert.rejects(()=>stat(out),{code:'ENOENT'});await assert.rejects(()=>stat(out+'.incomplete/feedback.PRIVATE.json'),{code:'ENOENT'});
 }finally{await rm(dir,{recursive:true,force:true});}
});
