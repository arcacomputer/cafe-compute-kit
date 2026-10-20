import {mkdir,writeFile,rename,stat} from 'node:fs/promises';
import {resolve} from 'node:path';import {createHash} from 'node:crypto';
import {args,privateInput,enforcePrivatePath,fail} from './operator.mjs';
import {getConfig} from '../config.js';
import {parsePhotoKey} from '../photo-reference.js';
try{
 const a=args(['--cookie-file','--out']),origin=getConfig(process.env).origin;
 if(!a['--cookie-file']||!a['--out'])throw Error('Private cookie-file and output directory required');
 enforcePrivatePath(a['--cookie-file']);enforcePrivatePath(a['--out']);
 const cookie=(await privateInput(a['--cookie-file'])).trim();if(!/^__Host-cc_session=[a-f0-9]{64}$/.test(cookie))throw Error('Invalid private session file');
 const out=resolve(a['--out']);try{await stat(out);throw Error('Output exists');}catch(e){if(e.code!=='ENOENT')throw e;}
 const staging=out+'.incomplete';await mkdir(staging,{mode:0o700});await writeFile(staging+'/INCOMPLETE.json',JSON.stringify({classification:'PRIVATE',complete:false}),{mode:0o600});
 const rows=[],digests=[];let cursor=null;
 do{
  const response=await fetch(origin+'/feedback/admin/export'+(cursor?'?cursor='+encodeURIComponent(cursor):''),{headers:{Cookie:cookie},redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Export denied');const page=await response.json();
  for(const row of page.rows){
   if(!/^[a-f0-9-]{36}$/.test(row.id)||rows.some(x=>x.id===row.id))throw Error('Invalid/repeated export row');
   for(const photo of row.photos){
    const ref=parsePhotoKey(row.id,photo.key);
    if(!ref||photo.type!==ref.type||!Number.isInteger(photo.bytes)||photo.bytes<1||photo.bytes>4194304)throw Error('Invalid owned photo manifest');
    const result=await fetch(origin+ref.path,{headers:{Cookie:cookie},redirect:'error',signal:AbortSignal.timeout(20000)});if(!result.ok)throw Error('Photo unavailable');
    if(result.headers.get('Content-Type')!==photo.type)throw Error('Photo type mismatch');
    const bytes=new Uint8Array(await result.arrayBuffer());if(bytes.length!==photo.bytes||bytes.length>4194304)throw Error('Incomplete photo');
    const digest=createHash('sha256').update(bytes).digest('hex');if(digest!==ref.digest)throw Error('Photo digest mismatch');
    const filename=`${row.id}-${ref.slot}-${ref.digest}.${ref.extension}`;await writeFile(staging+'/'+filename,bytes,{mode:0o600,flag:'wx'});digests.push({file:filename,sha256:digest});
   }rows.push(row);
  }
  cursor=page.nextCursor;
 }while(cursor);
 await writeFile(staging+'/feedback.PRIVATE.json',JSON.stringify({classification:'PRIVATE: raw free text and photos; manual review required',complete:true,rows,photos:digests},null,2),{mode:0o600});
 const {unlink}=await import('node:fs/promises');await unlink(staging+'/INCOMPLETE.json');await rename(staging,out);console.log(JSON.stringify({complete:true,responses:rows.length,photos:digests.length,classification:'PRIVATE; no forwarding performed'}));
}catch{fail();}
