import test from 'node:test';
import assert from 'node:assert/strict';
import {authPage} from './auth.js';
for (const [lang,path,title] of [['es','/feedback/','Antes de empezar'],['en','/en/feedback/','Before you start']]) {
 test(`public ${lang} guide is available without authentication`,async()=>{
  const response=await authPage(new Request('https://feedback.example.test'+path),{PUBLIC_ORIGIN:'https://feedback.example.test',BENEFIT_DESCRIPTION:'Synthetic benefit'},{});
  const html=await response.text();assert.ok(html.includes(title));
  assert.ok(html.indexOf('id="login"')<html.indexOf('id="before-start"'));
  assert.match(html,/<details class="guide-details">/);assert.match(html,/Synthetic benefit/);
  assert.ok(!html.includes('<iframe'));assert.ok(!html.includes('autoplay'));
  assert.match(response.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
 });
}
