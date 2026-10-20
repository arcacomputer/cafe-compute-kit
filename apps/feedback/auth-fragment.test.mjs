import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
test('same-document magic fragments reload confirmation without consuming credentials',async()=>{
 const events={};let reloads=0,requests=0;
 const location={hash:'#synthetic-first',pathname:'/en/feedback/sign-in',search:'',reload(){reloads++;}};
 const script=await readFile(new URL('./public/feedback/auth-client.js',import.meta.url),'utf8');
 vm.runInNewContext(script,{location,history:{replaceState(){location.hash='';}},document:{documentElement:{lang:'en'},querySelector(){return null;},querySelectorAll(){return[];}},addEventListener:(name,fn)=>events[name]=fn,fetch(){requests++;throw Error('No automatic consume');}});
 assert.equal(location.hash,'');assert.equal(typeof events.hashchange,'function');
 location.hash='#synthetic-second';events.hashchange();assert.equal(reloads,1);assert.equal(requests,0);
 location.hash='';events.hashchange();assert.equal(reloads,1);
});
