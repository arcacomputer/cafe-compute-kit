import test from 'node:test';import assert from 'node:assert/strict';
import {parsePhotoKey} from './photo-reference.js';
const id='22222222-2222-4222-8222-222222222222',digest='a'.repeat(64),key=`feedback/${id}/photo-19-${digest}.jpg`;
test('photo identity parses only canonical complete owned keys',()=>{
 assert.deepEqual(parsePhotoKey(id,key),{slot:19,digest,extension:'jpg',type:'image/jpeg',path:`/feedback/admin/photo/${id}/19-${digest}.jpg`});
 for(const bad of [key+'\n',key+'/x',key.replace('/photo-19-','/photo-20-'),key.replace('/photo-19-','/photo-019-'),key.replace(digest,digest.toUpperCase()),key.replace(id,'11111111-1111-4111-8111-111111111111'),key.replace('.jpg','.jpeg'),null])assert.equal(parsePhotoKey(id,bad),null,String(bad));
 assert.equal(parsePhotoKey(id+'\n',key.replace(id,id+'\n')),null);
});
