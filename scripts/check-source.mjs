import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const production = [
  ['cc','.arca.computer'].join(''), ['lf','@arca.computer'].join(''),
  ['cafe-compute','-resources'].join(''), ['cafe-compute','-private-mailer'].join(''),
  ['e320a5a80611f9a3','0148d452929b1fb1'].join(''),
];
export function scanText(name,text){
  const issues=[];
  if (production.some(value=>text.includes(value))) issues.push('production-identity');
  if (/\/(?:root|Users|home)\/[A-Za-z0-9._/-]+/.test(text)) issues.push('private-path');
  if (/gh[pousr]_[A-Za-z0-9]{20,}|sk_(?:live|test)_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) issues.push('credential-shape');
  return issues;
}

export async function checkSource(root){
  const failures=[];
  const skip=new Set(['.git','node_modules','dist','.wrangler','.cache','.scratch','.proof','coverage','test-results','playwright-report']);
  async function visit(dir,prefix=''){
    for(const item of await readdir(dir,{withFileTypes:true})){
      if(skip.has(item.name)) continue;
      const rel=prefix?`${prefix}/${item.name}`:item.name;
      if(item.isSymbolicLink()){failures.push({path:rel,issue:'unexpected-symlink'});continue;}
      if(item.isDirectory()){await visit(path.join(dir,item.name),rel);continue;}
      if(!item.isFile())continue;
      if(/(?:^|\/)(?:\.env|\.dev\.vars)(?:\.|$)/.test(rel)&&!rel.endsWith('.example')) failures.push({path:rel,issue:'private-env-file'});
      if(/(?:^|\/)(?:feedback-verificado[^/]*|datos_verificados|testimonials-diyi)\.json$/.test(rel)) failures.push({path:rel,issue:'private-event-record'});
      if(/\.(?:log|pem|key|p12|pfx|backup|dump)$/.test(rel)) failures.push({path:rel,issue:'private-artifact-file'});
      if(!/\.(?:m?js|jsonc?|md|html|css|svg|sql|ya?ml|csv|txt|py)$/.test(rel)&&!['LICENSE','.gitignore','.dev.vars.example','.env.example','.npmrc','.nvmrc'].includes(item.name))continue;
      const text=await readFile(path.join(dir,item.name),'utf8');
      for(const issue of scanText(rel,text))failures.push({path:rel,issue});
    }
  }
  await visit(root);
  return failures;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const failures=await checkSource(root);
  if(failures.length){console.error(JSON.stringify({status:'failed',failures},null,2));process.exitCode=1;}
  else console.log('Source privacy/production-identity guard passed. This is not a substitute for human review.');
}
