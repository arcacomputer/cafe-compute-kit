import test from 'node:test';import assert from 'node:assert/strict';
test('static build plans complete bilingual routes and self-hosted original assets',async()=>{
 const {staticPages}=await import('./scripts/static-pages.mjs');const pages=staticPages({PUBLIC_ORIGIN:'https://feedback.example.test',EVENT_NAME:'Synthetic <event>'});
 for(const key of ['feedback/index.html','en/feedback/index.html','feedback/sign-in/index.html','en/feedback/sign-in/index.html','feedback/credit/index.html','en/feedback/credit/index.html']){assert.equal(typeof pages[key],'string');assert.ok(pages[key].includes('<main'));assert.ok(!pages[key].includes('<form id="feedback-form"'));}
 assert.ok(Object.keys(pages).every(k=>k.startsWith('feedback/')||k.startsWith('en/feedback/')));
 assert.ok(pages['feedback/index.html'].includes('Synthetic &lt;event&gt;'));assert.ok(!Object.values(pages).join('').includes('cerebras.svg'));
});
