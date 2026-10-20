import {databaseFor} from '../database.js';
import {getConfig} from '../config.js';
import {readBounded} from '../feedback.js';
import {renderMagic} from './template.js';
export async function authorizedMagic(env,to,link){
 if(!env.DATABASE_URL)return null;
 const token=new URL(link).hash.slice(1);
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),x=>x.toString(16).padStart(2,'0')).join('');
 const sql=databaseFor(env),rows=await sql`SELECT * FROM cc_authorize_mail(${digest},${to})`;
 return rows.length===1?rows[0]:null;
}
const deliveryReply=(body,status,state='not-sent')=>new Response(body,{status,headers:{'X-Magic-Delivery':state,'Cache-Control':'no-store'}});
export async function sendMagic(request,env,transport=fetch,authorize=authorizedMagic){
 let attempted=false;
 if(env.MAIL_SEND_ENABLED!=='true'||!env.AGENTMAIL_SEND_KEY||!env.APPROVED_INBOX||!env.REPLY_TO)return deliveryReply('Disabled',503);
 if(request.method!=='POST'||new URL(request.url).pathname!=='/magic-link')return deliveryReply('Not found',404);
 try{
  const config=getConfig(env);let body;try{body=JSON.parse(new TextDecoder().decode(await readBounded(request,4096)));}catch{return deliveryReply('Invalid or oversized body',400);}
  if(!body||typeof body!=='object'||Array.isArray(body))return deliveryReply('Invalid',400);
  const {to,template,link,lang}=body;
  if(!['es','en'].includes(lang)||typeof to!=='string'||to!==to.trim().toLowerCase()||to.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)||template!=='cafe-compute-magic-link'||typeof link!=='string')return deliveryReply('Invalid',400);
  let url;try{url=new URL(link);}catch{return deliveryReply('Invalid',400);}
  if(url.origin!==config.origin||url.username||url.password||url.search||url.pathname!==(lang==='en'?'/en/feedback/sign-in':'/feedback/sign-in')||!/^#[a-f0-9]{64}$/.test(url.hash)||url.href!==link)return deliveryReply('Invalid',400);
  const person=await authorize(env,to,link);if(!person||typeof person!=='object')return deliveryReply('Not authorized',403);
  attempted=true;
  const response=await transport(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(env.APPROVED_INBOX)}/messages/send`,{method:'POST',headers:{Authorization:`Bearer ${env.AGENTMAIL_SEND_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({to:[to],...renderMagic(lang,person.name,link,config),reply_to:[env.REPLY_TO],track_opens:false}),signal:AbortSignal.timeout(10000)});
  return deliveryReply(response.ok?'Accepted':'Unavailable',response.ok?202:503,response.ok?'accepted':'ambiguous');
 }catch{return deliveryReply('Unavailable',503,attempted?'ambiguous':'not-sent');}
}
export default {fetch(request,env){return sendMagic(request,env);}};
