import test from 'node:test';
import assert from 'node:assert/strict';
const token='a'.repeat(64),origin='https://sender.example',event='https://event.example';
const env={PUBLIC_ORIGIN:event,SENDER_ORIGIN:origin,MAILER_SERVICE_TOKEN:token,MAIL_SEND_ENABLED:'true',AGENTMAIL_SEND_KEY:'sender-key',APPROVED_INBOX:'approved@example.test',REPLY_TO:'reply@example.test',DATABASE_URL:'unused',TEST_DATABASE:'not-a-capability'};
const request=(auth='Bearer '+token,path='/magic-link')=>new Request(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:auth},body:JSON.stringify({to:'guest@example.test',template:'cafe-compute-magic-link',link:event+'/feedback/sign-in#'+'b'.repeat(64),lang:'es'})});

test('separate sender authenticates before DB/provider and preserves constrained magic semantics',async()=>{
 const {createSender}=await import('../vercel/sender.mjs');
 let queries=0,sends=0;
 const database={query:async(q,p)=>{queries++;assert.match(q,/cc_authorize_mail/);assert.equal(p[1],'guest@example.test');return [{name:'Guest'}]}};
 const transport=async(url,options)=>{sends++;assert.match(url,/^https:\/\/api.agentmail.to\/v0\/inboxes\/approved%40example.test\/messages\/send$/);assert.equal(options.redirect,'error');const payload=JSON.parse(options.body);assert.deepEqual(payload.to,['guest@example.test']);return new Response(null,{status:200})};
 const sender=createSender({env,database,transport});
 for(const auth of ['', 'Bearer wrong', 'Bearer '+token+', Bearer '+token])assert.equal((await sender.fetch(request(auth))).status,401);
 assert.equal(queries,0);assert.equal(sends,0);
 assert.equal((await sender.fetch(request('Bearer '+token,'/generic-send'))).status,404);
 assert.equal((await sender.fetch(request('Bearer '+token,'/magic-link?to=attacker@example.test'))).status,404);
 const wrongHost=new Request('https://evil.example/magic-link',{method:'POST',headers:{Authorization:'Bearer '+token}});
 assert.equal((await sender.fetch(wrongHost)).status,421);
 const response=await sender.fetch(request());assert.equal(response.status,202);assert.equal(response.headers.get('X-Magic-Delivery'),'accepted');assert.equal(queries,1);assert.equal(sends,1);
 const ambiguous=await createSender({env,database,transport:async()=>{throw Error('timeout')}}).fetch(request());
 assert.equal(ambiguous.headers.get('X-Magic-Delivery'),'ambiguous');
 const denied=await createSender({env,database:{query:async()=>[]},transport}).fetch(request());
 assert.equal(denied.status,403);assert.equal(denied.headers.get('X-Magic-Delivery'),'not-sent');
 let fenced=false,fenceSends=0;
 const oneAttempt=createSender({env,database:{query:async()=>{if(fenced)return [];fenced=true;return [{name:'Guest'}];}},transport:async()=>{fenceSends++;throw Error('ambiguous timeout')}});
 const attempts=await Promise.all([oneAttempt.fetch(request()),oneAttempt.fetch(request())]);
 assert.deepEqual(attempts.map(r=>r.headers.get('X-Magic-Delivery')).sort(),['ambiguous','not-sent']);
 assert.equal(fenceSends,1);
 for(const value of ['https://evil.example/feedback/sign-in#'+'b'.repeat(64),event+'/feedback/sign-in?redirect=evil#'+'b'.repeat(64)]){
  const invalid=request();const payload=await invalid.json();payload.link=value;
  const result=await sender.fetch(new Request(origin+'/magic-link',{method:'POST',headers:invalid.headers,body:JSON.stringify(payload)}));
  assert.equal(result.status,400);
 }
 assert.equal((await createSender({env:{...env,MAILER_SERVICE_TOKEN:'short'},database,transport}).fetch(request())).status,503);
});
