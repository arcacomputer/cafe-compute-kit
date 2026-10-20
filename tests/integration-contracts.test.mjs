import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
const example=JSON.parse(await readFile(new URL('../config/event.example.json',import.meta.url),'utf8'));
test('private page aliases canonicalize before the assets fallback',async()=>{
  const module=new URL('../apps/feedback/private-routes.js',import.meta.url);
  let ready=true;try{await readFile(module);}catch{ready=false;}
  assert.equal(ready,true,'Private route normalization is missing');
  const {privatePageRoute}=await import(module);
  for(const prefix of ['/feedback','/en/feedback']){
    for(const path of [prefix,prefix+'/',prefix+'/index.html'])assert.equal(privatePageRoute(path),prefix+'/');
    for(const part of ['sign-in','credit'])for(const suffix of ['','/','/index.html'])assert.equal(privatePageRoute(prefix+'/'+part+suffix),prefix+'/'+part);
  }
  for(const path of ['/','/resources/','/feedback/admin','/api/auth/request','/feedback/form.js'])assert.equal(privatePageRoute(path),null);
});
test('root builds explicitly forward a public event configuration',async()=>{
  const {parseBuildArgs}=await import('../scripts/build.mjs');
  assert.equal(typeof parseBuildArgs,'function');
  assert.deepEqual(parseBuildArgs([]),[]);
  assert.deepEqual(parseBuildArgs(['--config','config/custom.json']),['--','--config',new URL('../config/custom.json',import.meta.url).pathname]);
  assert.throws(()=>parseBuildArgs(['--secret','no']),/Usage/);
});
test('static-only deployment can disable all private feedback calls to action',async()=>{
  const {renderSite}=await import('../apps/event-site/src/render.mjs');
  const input=structuredClone(example);input.feedbackUrl=null;
  for(const html of renderSite(input).values())assert.doesNotMatch(html,/href="(?:\/en)?\/feedback\//);
});
test('resource request preserves the executable API-key environment variable',async()=>{
  const {renderSite}=await import('../apps/event-site/src/render.mjs');
  assert.ok(renderSite(example).get('/en/resources/index.html').includes('${CEREBRAS_API_KEY}'));
});
