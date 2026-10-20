import {privatePageRoute} from '../apps/feedback/private-routes.js';

const eventAssets=new Set(['site.css','slides.mjs','mark.svg','table-notes.svg']);
const feedbackAssets=new Set(['icon.svg','form.css','admin.css','photo-picker.js','auth-client.js','auth.css','form.js','base.css','steps.js','steps.css','login.css']);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.avif':'image/avif'};
export function publicAssetType(name) {
 if(typeof name!=='string'||name.includes('%')||name.includes('\\')||name.split('/').some(p=>p==='.'||p==='..'||p.startsWith('.')))return null;
 const allowed=/^\/(?:en\/)?(?:(?:resources|slides|recap|gallery|privacy)\/)?index\.html$/.test(name)||name==='/404.html'||name.startsWith('/assets/')&&eventAssets.has(name.slice(8))||name.startsWith('/feedback/')&&feedbackAssets.has(name.slice(10))||/^\/media\/[A-Za-z0-9][A-Za-z0-9_-]*\.(?:jpg|jpeg|png|webp|avif)$/.test(name);
 return allowed?mime[name.slice(name.lastIndexOf('.'))]:null;
}
export function createAssets(manifest) {
 const files=new Map();
 for(const [name,asset]of Object.entries(manifest)){
  const type=publicAssetType(name);
  if(!type||type!==asset.type||typeof asset.base64!=='string')throw Error('Invalid compiled manifest');
  files.set(name,{type,bytes:Buffer.from(asset.base64,'base64')});
 }
 return {async fetch(request) {
  const pathname=new URL(request.url).pathname;
  const missing=()=>new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
  if(!['GET','HEAD'].includes(request.method)||pathname.includes('%')||privatePageRoute(pathname))return missing();
  const name=pathname.endsWith('/')?pathname+'index.html':pathname;
  const file=files.get(name);
  if(!file){
   if(!pathname.endsWith('/')&&files.has(pathname+'/index.html'))return new Response(null,{status:308,headers:{Location:pathname+'/'+new URL(request.url).search,'Cache-Control':'no-store'}});
   return missing();
  }
  return new Response(request.method==='HEAD'?null:file.bytes,{headers:{'Content-Type':file.type,'Content-Length':String(file.bytes.length),'Cache-Control':'no-store'}});
 }};
}
