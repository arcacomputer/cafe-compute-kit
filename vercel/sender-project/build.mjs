import {mkdir,rm} from 'node:fs/promises';
const output=new URL('public/',import.meta.url);
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
