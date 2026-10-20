import { handleAdmin } from './admin.js';
import { handlePhoto } from './photo-upload.js';
import { handleFeedback } from './feedback.js';
import { handleAuth, authPage, reply } from './auth.js';
import { getConfig } from './config.js';
import {privatePageRoute} from './private-routes.js';
export default {
 async fetch(request,env,ctx){
  try {
   const config=getConfig(env),url=new URL(request.url);
   if(url.origin!==config.origin)return reply({error:'Invalid host'},421);
   if(url.pathname==='/feedback/admin'||url.pathname.startsWith('/feedback/admin/'))return handleAdmin(request,env);
   if(url.pathname==='/api/feedback/photo')return handlePhoto(request,env);
   if(url.pathname.startsWith('/api/auth/'))return handleAuth(request,env,ctx);
   const privatePage=privatePageRoute(url.pathname);
   if(privatePage){
    if(request.method!=='GET')return reply({error:'Method not allowed'},405);
    if(url.pathname!==privatePage)return new Response(null,{status:302,headers:{Location:privatePage+url.search,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'}});
    if(env.AUTH_ENABLED!=='true'||!env.AUTH_SECRET||!env.DATABASE_URL)return reply({error:'Sign-in unavailable'},503);
    return authPage(request,env);
   }
   if(url.pathname==='/api/feedback'||url.pathname.startsWith('/api/feedback/'))return handleFeedback(request,env);
   if(request.method!=='GET'&&request.method!=='HEAD')return reply({error:'Method not allowed'},405);
   const asset=await env.ASSETS.fetch(request),response=new Response(asset.body,asset);
   response.headers.set('Content-Security-Policy',"default-src 'none'; style-src 'self'; font-src 'self'; script-src 'self'; img-src 'self' blob:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
   response.headers.set('Referrer-Policy','no-referrer');response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('X-Robots-Tag','noindex');response.headers.set('Strict-Transport-Security','max-age=31536000');
   return response;
  } catch { return reply({error:'Unavailable'},503); }
 }
};
