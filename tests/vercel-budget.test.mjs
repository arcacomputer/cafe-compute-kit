import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {compileAssets} from '../vercel/build.mjs';

test('Vercel packaging rejects assets above its response budget before publication',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'vercel-budget-'));
 try{await mkdir(path.join(directory,'media'));await writeFile(path.join(directory,'media/synthetic.png'),'synthetic-data');await assert.rejects(()=>compileAssets(directory,{maxAssetBytes:4}),/Vercel public asset exceeds response budget/);}finally{await rm(directory,{recursive:true,force:true});}
});
test('Vercel packaging bounds the total encoded manifest independently of gallery count',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'vercel-budget-'));
 try{await writeFile(path.join(directory,'index.html'),'<h1>Synthetic</h1>');await assert.rejects(()=>compileAssets(directory,{maxManifestBytes:1}),/Vercel compiled manifest exceeds bundle budget/);}finally{await rm(directory,{recursive:true,force:true});}
});
