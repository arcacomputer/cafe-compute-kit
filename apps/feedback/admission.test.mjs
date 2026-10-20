import test from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';import {handleFeedback} from './feedback.js';
const origin='https://feedback.example.test',session='a'.repeat(64),id='22222222-2222-4222-8222-222222222222';
const person={id:'11111111-1111-4111-8111-111111111111',email:'guest@example.test'};
function request(){const prefix=id+'.'+(Date.now()-3000),f=new FormData();for(const [k,v]of Object.entries({name:'Synthetic',affiliation:'Independent',role:'Student',feedback:'Not good',improvements:'N/A',csrf:createHmac('sha256','synthetic').update('csrf:'+session).digest('hex'),token:prefix+'.'+createHmac('sha256','synthetic').update(prefix+'.192.0.2.1').digest('hex')}))f.set(k,v);return new Request(origin+'/api/feedback',{method:'POST',headers:{Origin:origin,'CF-Connecting-IP':'192.0.2.1',Cookie:'__Host-cc_session='+session},body:f});}
test('feedback save uses one atomic database admission and retry reconciles same receipt',async()=>{
 let calls=0;const env={PUBLIC_ORIGIN:origin,AUTH_ENABLED:'true',AUTH_SECRET:'synthetic',DATABASE_URL:'unused',FEEDBACK_ENABLED:'true',FEEDBACK_SIGNING_KEY:'synthetic',FEEDBACK_RATE:{limit:async()=>({success:true})}};
 const deps={store:{session:async()=>person},sql:async(parts,...values)=>{calls++;assert.match(parts.join('?'),/cc_save_feedback/);assert.equal(values[1],person.id);assert.equal(JSON.parse(values[2]).email,person.email);if(calls===1)throw Error('lost response after commit');return [{receipt:{id,saved:true,created:false}}];}};
 assert.equal((await handleFeedback(request(),env,deps)).status,503);
 const retry=await handleFeedback(request(),env,deps);assert.equal(retry.status,200);assert.equal((await retry.json()).id,id);assert.equal(calls,2);
});
