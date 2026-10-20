import test from 'node:test';import assert from 'node:assert/strict';
import {loginView} from './login-view.js';import {authPage} from './auth.js';import {getConfig,creditValue} from './config.js';
const env={PUBLIC_ORIGIN:'https://feedback.example.test',EVENT_NAME:'Synthetic & private event',PROVIDER_NAME:'Example sponsor',BENEFIT_DESCRIPTION:'Synthetic benefit only',AUTH_SECRET:'synthetic'};
test('configured bilingual UI escapes event text, has no provider assets and requires honest feedback',async()=>{
 const c=getConfig(env);for(const es of [true,false]){
 const login=loginView(es,c);assert.match(login,/Synthetic &amp; private event/);assert.ok(!/loom|cerebras\.svg|Codex|SANTIAGO/.test(login));
 const r=await authPage(new Request(env.PUBLIC_ORIGIN+(es?'':'/en')+'/feedback/',{headers:{Cookie:'__Host-cc_session='+'a'.repeat(64)}}),env,{session:async()=>({name:'Guest',email:'guest@example.test',id:'synthetic'})});
 const html=await r.text();for(const key of ['name','email','affiliation','role','feedback','improvements'])assert.match(html,new RegExp('name="'+key+'"[^>]*required'));
 assert.match(html,/name="photoConsent" value="true"/);assert.ok(!html.includes('checked'));assert.match(html,/N\/A/);
 }
});
test('code values and allowed exact HTTPS links have distinct validation',()=>{
 assert.equal(creditValue('SYNTHETIC_ABC-123','code',{}),true);for(const v of [' ABC','a b','javascript:alert(1)','https://x.test/'])assert.equal(creditValue(v,'code',{}),false);
 assert.equal(creditValue('https://credits.example.test/exact?a=1','link',{CREDIT_LINK_ORIGINS:'https://credits.example.test'}),true);
 for(const v of ['http://credits.example.test/a','https://credits.example.test.evil/a','https://u:p@credits.example.test/a'])assert.equal(creditValue(v,'link',{CREDIT_LINK_ORIGINS:'https://credits.example.test'}),false);
});
