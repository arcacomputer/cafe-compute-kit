import test from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';import {handlePhoto} from './photo-upload.js';
const origin='https://feedback.example.test',session='a'.repeat(64),person={id:'11111111-1111-4111-8111-111111111111'};
const csrf=createHmac('sha256','synthetic').update('csrf:'+session).digest('hex');
const env={PUBLIC_ORIGIN:origin,AUTH_ENABLED:'true',FEEDBACK_ENABLED:'true',AUTH_SECRET:'synthetic',DATABASE_URL:'unused',FEEDBACK_PHOTOS:{put:async()=>{}},PHOTOS_ENABLED:'true',PRIVATE_PHOTO_METADATA_ACK:'true'};
const request=(slot='0',body=Uint8Array.of(255,216,255,224),headers={})=>new Request(origin+'/api/feedback/photo?id=22222222-2222-4222-8222-222222222222&slot='+slot,{method:'POST',headers:{Origin:origin,Cookie:'__Host-cc_session='+session,'X-CSRF-Token':csrf,'Content-Type':'image/jpeg',...headers},body});
const store={session:async()=>person,rate:async()=>true};
test('photos default off until explicit private-original metadata retention acknowledgement',async()=>{for(const flags of [{PHOTOS_ENABLED:undefined},{PRIVATE_PHOTO_METADATA_ACK:undefined},{PHOTOS_ENABLED:'false'}]){let reads=0;const r=await handlePhoto(request(),{...env,...flags},{store,sql:async()=>{reads++;return []}});assert.equal(reads,0);assert.equal(r.status,503);}});
test('photo ownership and CSRF checked before bytes/storage',async()=>{assert.equal((await handlePhoto(request('0',new Uint8Array(),{'X-CSRF-Token':'bad'}),env,{store})).status,403);assert.equal((await handlePhoto(request(),env,{store,sql:async()=>[]})).status,404);});
test('20 slots, MIME and streamed file bounds remain enforced',async()=>{
 assert.equal((await handlePhoto(request('20'),env,{store})).status,400);
 for(const [bytes,type,status]of [[new TextEncoder().encode('<svg/>'),'image/svg+xml',400],[Uint8Array.of(255,216,255),'image/png',400],[new Uint8Array(4194305),'image/jpeg',413]])assert.equal((await handlePhoto(request('19',bytes,{'Content-Type':type}),env,{store,sql:async()=>[{id:person.id}]})).status,status);
});
test('same-digest retry rechecks locked SQL commit without a second storage write',async()=>{
 let writes=0;const calls=[];
 const sql=async(parts)=>{const text=parts.join('');calls.push(text);if(text.includes('cc_reserve_photo'))return[{reservation:{status:'reserved',ready:true}}];if(text.includes('cc_commit_photo'))return[{committed:true}];if(text.includes('SELECT id FROM event_feedback'))return[{id:person.id}];throw Error('Unexpected photo SQL');};
 const r=await handlePhoto(request('19'),{...env,FEEDBACK_PHOTOS:{put:async()=>{writes++}}},{store,sql});assert.equal(r.status,200);assert.equal(writes,0);assert.equal(calls.filter(q=>q.includes('cc_reserve_photo')).length,1);assert.equal(calls.filter(q=>q.includes('cc_commit_photo')).length,1);assert.ok(calls.findIndex(q=>q.includes('cc_reserve_photo'))<calls.findIndex(q=>q.includes('cc_commit_photo')));
});
