import {httpsOrigin,validServiceToken} from './environment.mjs';
import {readBounded} from '../apps/feedback/feedback.js';

export function createMagicMailer(source,{transport=fetch}={}) {
 const endpoint=httpsOrigin(source.SENDER_ORIGIN)+'/magic-link',secret=source.MAILER_SERVICE_TOKEN;
 if(!validServiceToken(secret))throw Error('A 32-byte hex service token is required');
 return {async fetch(request) {
  const url=new URL(request.url);
  if(request.method!=='POST'||url.pathname!=='/magic-link'||url.search)throw Error('Constrained mail only');
  const body=await readBounded(request,4096);
  const response=await transport(endpoint,{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body,redirect:'manual',signal:AbortSignal.timeout(15000)});
  const accepted=response.status===202&&response.headers.get('X-Magic-Delivery')==='accepted';
  const notSent=!response.ok&&(response.status<300||response.status>=400)&&response.headers.get('X-Magic-Delivery')==='not-sent';
  // Do not propagate provider bodies or trust redirect/success claims without the
  // sender's explicit contract. A network failure throws and stays ambiguous.
  await response.body?.cancel();
  return new Response(null,{status:accepted?202:503,headers:{'Cache-Control':'no-store','X-Magic-Delivery':accepted?'accepted':notSent?'not-sent':'ambiguous'}});
 }};
}
