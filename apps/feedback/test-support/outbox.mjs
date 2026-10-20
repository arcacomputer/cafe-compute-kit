import {getConfig} from '../config.js';
import {renderMagic} from '../mailer/template.js';
// In-process test capability only. It is not an HTTP inbox or authentication route.
export function createOutbox(env){
 const messages=[];
 return {messages,service:{async fetch(request){
  const x=await request.json(),c=getConfig(env),u=new URL(x.link);
  if(request.method!=='POST'||x.template!=='cafe-compute-magic-link'||u.origin!==c.origin||!/^#[a-f0-9]{64}$/.test(u.hash)||!['en','es'].includes(x.lang)||u.pathname!==(x.lang==='en'?'/en/feedback/sign-in':'/feedback/sign-in'))return new Response('Invalid',{status:400});
  messages.push({...x,...renderMagic(x.lang,'Synthetic guest',x.link,c)});return new Response('Captured; NOT SENT',{status:202});
 }}};
}
