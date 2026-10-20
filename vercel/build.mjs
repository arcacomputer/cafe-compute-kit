import {readdir,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {privatePageRoute} from '../apps/feedback/private-routes.js';
import {publicAssetType} from './assets.mjs';

// Read only the compiled tree, reject symlinks/unexpected files and omit the
// generated login placeholders entirely. No repository-wide copying or env dump.
export async function compileAssets(input) {
 const manifest={};
 async function collect(directory,prefix='') {
  for(const entry of await readdir(directory,{withFileTypes:true})){
   const name=prefix+'/'+entry.name;
   if(entry.isSymbolicLink())throw Error('Symlink compiled asset');
   if(entry.isDirectory()){await collect(path.join(directory,entry.name),name);continue;}
   if(name==='/_headers'||privatePageRoute(name))continue;
   const type=publicAssetType(name);
   if(!entry.isFile()||!type)throw Error(`Unexpected compiled asset: ${name}`);
   manifest[name]={type,base64:(await readFile(path.join(directory,entry.name))).toString('base64')};
  }
 }
 await collect(path.resolve(input));
 return manifest;
}
export async function prepareEmptyOutput(output) {
 await rm(output,{recursive:true,force:true});
 await mkdir(output,{recursive:true});
}
export async function packageAssets(input,output) {
 const manifest=await compileAssets(input);
 await mkdir(path.dirname(output),{recursive:true});
 await writeFile(output,JSON.stringify(manifest));
 return Object.keys(manifest).length;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const root=fileURLToPath(new URL('../',import.meta.url));
 const result=spawnSync(process.execPath,['scripts/build.mjs',...process.argv.slice(2)],{cwd:root,stdio:'inherit'});
 if(result.status!==0)process.exitCode=result.status||1;
 else{
  const count=await packageAssets(path.join(root,'dist'),path.join(root,'vercel/generated/public-assets.json'));
  await prepareEmptyOutput(path.join(root,'vercel/empty-public'));
  console.log(`Vercel private function assets: ${count}; public output directory is intentionally empty.`);
 }
}
