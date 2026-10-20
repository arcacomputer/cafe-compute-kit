import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {handlePhoto} from './photo-upload.js';
const origin='https://feedback.example.test',session='a'.repeat(64),secret='SYNTHETIC_ONLY';
const person={id:'11111111-1111-4111-8111-111111111111'},id='22222222-2222-4222-8222-222222222222';
const csrf=createHmac('sha256',secret).update('csrf:'+session).digest('hex');
function setup({erased=false,eraseDuringPut=false}={}){
 const objects=new Map(),calls=[];let reads=0;
 const sql=async(parts,...values)=>{const text=parts.join('?');calls.push(text);
  if(text.startsWith('SELECT id FROM event_feedback WHERE'))return erased&&text.includes('deleted')?[]:[{id}];
  if(text.includes('cc_reserve_photo'))return [{reservation:{status:erased?'denied':'reserved',ready:false}}];
  if(text.includes('cc_commit_photo'))return [{committed:!erased}];
  if(text.startsWith('INSERT INTO cc_feedback_uploads'))return [{ready:false}];
  return [];
 };sql.transaction=async()=>{};
 const env={PUBLIC_ORIGIN:origin,AUTH_ENABLED:'true',FEEDBACK_ENABLED:'true',AUTH_SECRET:secret,DATABASE_URL:'synthetic',PHOTOS_ENABLED:'true',PRIVATE_PHOTO_METADATA_ACK:'true',FEEDBACK_PHOTOS:{async put(key,bytes){objects.set(key,bytes);if(eraseDuringPut)erased=true;},async delete(key){objects.delete(key);}}};
 const request=new Request(origin+'/api/feedback/photo?id='+id+'&slot=19',{method:'POST',headers:{Origin:origin,Cookie:'__Host-cc_session='+session,'X-CSRF-Token':csrf,'Content-Type':'image/jpeg'},body:Uint8Array.of(255,216,255,224)});
 const getReader=request.body.getReader.bind(request.body);request.body.getReader=(...args)=>{reads++;return getReader(...args);};
 return {objects,calls,get reads(){return reads;},invoke:()=>handlePhoto(request,env,{sql,store:{session:async()=>person,rate:async()=>true}})};
}
test('erased receipt is rejected before reading any photo bytes',async()=>{const f=setup({erased:true});assert.equal((await f.invoke()).status,404);assert.equal(f.reads,0);assert.equal(f.objects.size,0);});
test('erasure during object put rejects commit and deletes only the attempted key',async()=>{const f=setup({eraseDuringPut:true});f.objects.set('unrelated-owned-key',new Uint8Array());assert.equal((await f.invoke()).status,404);assert.deepEqual([...f.objects.keys()],['unrelated-owned-key']);assert.ok(f.calls.some(x=>x.includes('cc_reserve_photo')));assert.ok(f.calls.some(x=>x.includes('cc_commit_photo')));});
