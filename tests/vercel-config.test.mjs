import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const json=async name=>JSON.parse(await readFile(new URL('../'+name,import.meta.url),'utf8'));

test('Vercel projects route before filesystem with private compiled assets and isolated sender entry',async()=>{
 const main=await json('vercel.json'),sender=await json('vercel/sender-project/vercel.json');
 assert.deepEqual(main.routes,[{src:'/(.*)',dest:'/api/main'}]);
 assert.deepEqual(sender.routes,[{src:'/(.*)',dest:'/api/magic'}]);
 assert.equal(main.outputDirectory,'vercel/empty-public');
 assert.equal(main.functions['api/main.mjs'].includeFiles,'vercel/generated/public-assets.json');
 assert.equal(main.functions['api/main.mjs'].maxDuration,60);
 assert.equal(sender.functions['api/magic.mjs'].maxDuration,30);
 const entry=await readFile(new URL('../api/main.mjs',import.meta.url),'utf8');
 assert.match(entry,/import \{ipAddress,waitUntil\} from '@vercel\/functions'/);
 assert.match(entry,/env:projectMainEnv\(process.env\)/);
 assert.doesNotMatch(entry,/AGENTMAIL_SEND_KEY|X-Forwarded-Host|X-Original|searchParams/);
 const root=await json('package.json'),senderPackage=await json('vercel/sender-project/package.json');
 assert.equal(root.dependencies['@vercel/functions'],'3.10.1');
 assert.ok(root.workspaces.includes('vercel/sender-project'));
 assert.equal(senderPackage.dependencies['@cafe-compute-kit/feedback'],'0.1.0');
 assert.equal(root.scripts['build:vercel'],'node vercel/build.mjs');
 assert.equal((await json('apps/feedback/package.json')).engines.node,'>=22.22.2 <23');
 const lock=await json('package-lock.json');
 assert.equal(lock.packages['node_modules/@vercel/functions'].version,'3.10.1');
 assert.equal(lock.packages['vercel/sender-project'].name,'@cafe-compute-kit/vercel-sender');
});
