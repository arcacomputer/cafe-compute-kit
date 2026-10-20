import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

test('compiled gallery keeps approved AVIF assets and packaging clears stale public output',async()=>{
 const {publicAssetType}=await import('../vercel/assets.mjs');
 const {prepareEmptyOutput}=await import('../vercel/build.mjs');
 assert.equal(publicAssetType('/media/approved-photo.avif'),'image/avif');
 assert.equal(publicAssetType('/media/nested/photo.jpg'),null);
 const root=await mkdtemp(path.join(tmpdir(),'cafe-vercel-empty-'));
 try{await writeFile(path.join(root,'secret.key'),'must be removed');await prepareEmptyOutput(root);const {readdir}=await import('node:fs/promises');assert.deepEqual(await readdir(root),[]);}finally{await rm(root,{recursive:true,force:true});}
});

test('compiled assets exclude private pages and deny source/encoded/original-route aliases',async()=>{
 const {compileAssets}=await import('../vercel/build.mjs');
 const {createAssets}=await import('../vercel/assets.mjs');
 const root=await mkdtemp(path.join(tmpdir(),'cafe-vercel-assets-'));
 try{
  const input=path.join(root,'input');await mkdir(path.join(input,'feedback'),{recursive:true});
  await writeFile(path.join(input,'index.html'),'<h1>Public</h1>');
  await writeFile(path.join(input,'feedback/index.html'),'must never ship');
  await writeFile(path.join(input,'feedback/form.css'),'body{}');
  await writeFile(path.join(input,'_headers'),'platform-specific ignored');
  const manifest=await compileAssets(input),assets=createAssets(manifest);
  assert.equal(Object.hasOwn(manifest,'/feedback/index.html'),false);
  assert.equal(await (await assets.fetch(new Request('https://event.example/'))).text(),'<h1>Public</h1>');
  const head=await assets.fetch(new Request('https://event.example/feedback/form.css',{method:'HEAD'}));assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('Content-Type'),'text/css; charset=utf-8');
  for(const route of ['/feedback/','/feedback/index.html','/feedback/sign-in/index.html','/en/feedback/credit/','/.env','/package.json','/apps/feedback/auth.js','/assets/../auth.js','/%66eedback/index.html','/feedback/%2findex.html','/api/main?__route=/'])assert.equal((await assets.fetch(new Request('https://event.example'+route,{headers:{'X-Original-URL':'/'}}))).status,404,route);
  await writeFile(path.join(input,'.env'),'SECRET=value');await assert.rejects(()=>compileAssets(input),/Unexpected compiled asset/);await rm(path.join(input,'.env'));
  await symlink(path.join(input,'index.html'),path.join(input,'assets'));await assert.rejects(()=>compileAssets(input),/Symlink/);
 }finally{await rm(root,{recursive:true,force:true});}
});
