import test from 'node:test';
import assert from 'node:assert/strict';
import {AuthStore,handleAuth,cookieToken,validateRequired,identity,authPage,hash} from './auth.js';
const origin='https://feedback.example.test',person={id:'11111111-1111-4111-8111-111111111111',email:'guest@example.test',name:'<img src=x>',affiliation:'Independent',role:'Developer',claim_eligible:true};
const env={PUBLIC_ORIGIN:origin,AUTH_ENABLED:'true',AUTH_SECRET:'synthetic',DATABASE_URL:'unused'};
const req=(body={},headers={})=>new Request(origin+'/api/auth/request',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1',...headers},body:JSON.stringify(body)});
test('auth rejects wrong origin, media, missing IP and oversized JSON',async()=>{
 const deps={store:{rate:async()=>true}},ctx={waitUntil(){assert.fail('unexpected work')}};
 for(const [r,status]of [[req({}, {Origin:'https://evil.invalid'}),403],[req({}, {'Content-Type':'text/plain'}),415],[new Request(origin+'/api/auth/request',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'}),503],[req({email:'x'.repeat(9000)}),400]])assert.equal((await handleAuth(r,env,ctx,deps)).status,status);
});
test('known unknown and malformed addresses receive identical responses',async()=>{
 const pending=[],outbox=[],store={rate:async()=>true,recipient:async email=>email===person.email?person:null,issue:async(id,digest)=>{assert.equal(id,person.id);assert.match(digest,/^[a-f0-9]{64}$/)}};
 const responses=[];for(const email of [person.email,'unknown@example.test','bad'])responses.push(await(await handleAuth(req({email}),env,{waitUntil:p=>pending.push(p)},{store,mail:async(to,link)=>outbox.push({to,link})})).text());
 assert.equal(new Set(responses).size,1);await Promise.all(pending);assert.equal(outbox.length,1);assert.equal(new URL(outbox[0].link).search,'');
});
test('cookie duplicates and unrecognized tokens are rejected',async()=>{
 const cookie='__Host-cc_session='+'a'.repeat(64),r=new Request(origin,{headers:{Cookie:cookie+'; '+cookie}});assert.equal(cookieToken(r),null);
 assert.equal(await identity(new Request(origin,{headers:{Cookie:cookie}}),env,{session:async digest=>{assert.equal(digest,await hash('a'.repeat(64)));return null}}),null);
});
test('required answers permit criticism and N/A but never a forged email',()=>{
 const data={name:'A',affiliation:'Student',role:'Student',feedback:'Bad event',improvements:'N/A',email:'attacker@example.test'};assert.equal(validateRequired(data,person).email,person.email);
 for(const key of ['name','affiliation','role','feedback','improvements'])assert.throws(()=>validateRequired({...data,[key]:' '},person));
});
test('GET sign-in is only confirmation; authenticated EN/ES forms escape profile and lock email',async()=>{
 for(const prefix of ['', '/en']){
  const confirm=await authPage(new Request(origin+prefix+'/feedback/sign-in'),env,{});assert.ok((await confirm.text()).includes('id="consume"'));assert.equal(confirm.headers.get('Referrer-Policy'),'no-referrer');
  const page=await authPage(new Request(origin+prefix+'/feedback/',{headers:{Cookie:'__Host-cc_session='+'a'.repeat(64)}}),env,{session:async()=>person});const html=await page.text();assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));assert.match(html,/name="email" readonly required/);for(const key of ['affiliation','role','feedback','improvements'])assert.match(html,new RegExp('name="'+key+'" required'));assert.ok(html.includes('N/A'));
 }
});
test('AuthStore consume delegates one atomic UPDATE + session INSERT statement',async()=>{
 const calls=[],store=new AuthStore(async(q,p)=>{calls.push({q,p});return [{recipient_id:person.id}]});assert.equal((await store.consume('digest','session')).recipient_id,person.id);assert.equal(calls.length,1);assert.match(calls[0].q,/WITH consumed AS.*UPDATE cc_magic_tokens/);assert.match(calls[0].q,/INSERT INTO cc_sessions/);
});
