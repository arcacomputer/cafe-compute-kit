import {readFile} from 'node:fs/promises';
import {ipAddress,waitUntil} from '@vercel/functions';
import {createMain} from '../vercel/main.mjs';
import {projectMainEnv} from '../vercel/environment.mjs';
import {createAssets} from '../vercel/assets.mjs';

// Exactly one generated allowlisted file, never a request-derived disk path.
let compiled;
const assets={async fetch(request){
 compiled??=readFile(new URL('../vercel/generated/public-assets.json',import.meta.url),'utf8').then(text=>createAssets(JSON.parse(text)));
 return (await compiled).fetch(request);
}};
export default createMain({env:projectMainEnv(process.env),assets,ipAddress,waitUntil});
