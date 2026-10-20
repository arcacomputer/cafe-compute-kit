import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import test from 'node:test';

test('localhost preview serves static pages but never simulates private feedback APIs',async()=>{
  let ready=true;try{await readFile(new URL('../scripts/preview.mjs',import.meta.url));}catch{ready=false;}
  assert.equal(ready,true,'Static preview server is not implemented');
  const {createPreviewServer}=await import('../scripts/preview.mjs');
  const dir=await mkdtemp(path.join(process.env.TMPDIR||tmpdir(),'event-kit-preview-'));
  const server=createPreviewServer(dir);
  try{
    await writeFile(path.join(dir,'index.html'),'<h1>Example event</h1>');
    await writeFile(path.join(dir,'.dev.vars'),'SYNTHETIC_PRIVATE_CANARY');
    server.listen(0,'127.0.0.1');await once(server,'listening');
    const origin=`http://127.0.0.1:${server.address().port}`;
    assert.equal(await (await fetch(origin)).text(),'<h1>Example event</h1>');
    assert.equal((await fetch(origin+'/feedback/')).status,503);
    assert.equal((await fetch(origin+'/api/auth/request',{method:'POST',body:'{}'})).status,503);
    assert.equal((await fetch(origin+'/missing')).status,404);
    assert.equal((await fetch(origin+'/.dev.vars')).status,404);
    assert.equal((await fetch(origin+'/%00')).status,400);
  }finally{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
});
