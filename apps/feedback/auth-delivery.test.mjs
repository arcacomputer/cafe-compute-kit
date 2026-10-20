import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAuth} from './auth.js';
import {sendMagic} from './mailer/worker.js';
const origin='https://feedback.example.test',email='synthetic@example.test';
const request=()=>new Request(origin+'/api/auth/request',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.77'},body:JSON.stringify({email,lang:'en'})});
async function exercise(service){
 const tasks=[],updates=[],issued=[];
 const store={rate:async()=>true,recipient:async()=>({id:'11111111-1111-4111-8111-111111111111',email}),issue:async(id,digest)=>issued.push(digest),query:async(q,p)=>{updates.push({q,p});return[];}};
 const response=await handleAuth(request(),{PUBLIC_ORIGIN:origin,AUTH_ENABLED:'true',AUTH_SECRET:'SYNTHETIC',DATABASE_URL:'unused',MAGIC_EMAIL_ENABLED:'true',MAGIC_MAILER:service},{waitUntil:p=>tasks.push(p)},{store});
 assert.equal(response.status,200);await Promise.all(tasks);return{updates,issued};
}
test('main preserves potentially delivered tokens after ambiguous sender acceptance',async()=>{
 const sender={PUBLIC_ORIGIN:origin,MAIL_SEND_ENABLED:'true',AGENTMAIL_SEND_KEY:'SYNTHETIC_NO_SEND',APPROVED_INBOX:email,REPLY_TO:'organizer@example.test'};let attempts=0;
 const result=await exercise({fetch:r=>sendMagic(r,sender,async()=>{attempts++;throw Error('Synthetic accepted then connection lost');},async()=>({name:'Synthetic Guest'}))});
 assert.equal(attempts,1);assert.equal(result.issued.length,1);assert.equal(result.updates.length,0,'Ambiguous delivery cannot consume the issued token');
});
test('main preserves issued tokens when the private service itself times out',async()=>{
 const result=await exercise({fetch:async()=>{throw Error('Synthetic service timeout');}});assert.equal(result.updates.length,0);
});
test('explicit definitely-not-sent sender responses revoke only the issued token',async()=>{
 const result=await exercise({fetch:r=>sendMagic(r,{PUBLIC_ORIGIN:origin})});assert.equal(result.updates.length,1);assert.deepEqual(result.updates[0].p,result.issued);assert.match(result.updates[0].q,/consumed_at/);
});
