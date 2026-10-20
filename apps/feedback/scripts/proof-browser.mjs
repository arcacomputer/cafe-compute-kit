import assert from 'node:assert/strict';
import {mkdir,writeFile,mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {resolve,join} from 'node:path';
if(!process.env.PROOF_DATABASE_URL||process.env.PROOF_DISPOSABLE!=='yes')throw Error('Browser proof requires disposable PostgreSQL. Run npm run proof; no live-host fallback exists');
const {chromium}=await import('playwright');
const {default:AxeBuilder}=await import('@axe-core/playwright');
const {fixture}=await import('../test-support/postgres.mjs');
const platform=process.env.PROOF_PLATFORM||'cloudflare';
if(!['cloudflare','vercel'].includes(platform))throw Error('Unsupported proof platform');
const {proofServer}=await import(platform==='vercel'?'../test-support/vercel-server.mjs':'../test-support/server.mjs');
const {hash}=await import('../auth.js');
const f=await fixture();let server,browser;const report=[],external=[],errors=[];
const out=resolve(process.env.PROOF_OUTPUT_DIR||'.proof');await mkdir(out,{recursive:true});
// App fetch must never reach any external mail, Neon HTTP or object-storage API.
globalThis.fetch=()=>{throw Error('External HTTP forbidden in browser proof server');};
try{
 server=await proofServer(f);await f.stock(16);const owner=await f.person({email:'owner@example.test',claim:false});
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 let caseNo=0;
 async function context(){const c=await browser.newContext({ignoreHTTPSErrors:true});await c.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==server.origin){external.push(u.origin+u.pathname);return route.abort();}return route.continue();});return c;}
 async function capture(page,label){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal document overflow');await page.screenshot({path:resolve(out,label+'.png'),fullPage:true,animations:'disabled'});}
 async function signIn(page,p,lang){
  const base=lang==='en'?'/en/feedback/':'/feedback/';const before=f.outbox.messages.length;
  await page.goto(server.origin+base);await page.locator('#email').fill(p.email);await page.locator('#login button').click();
  await page.waitForFunction(()=>document.querySelector('#auth-status')?.dataset.state==='success');await server.drain();
  assert.equal(f.outbox.messages.length,before+1);const link=f.outbox.messages.at(-1).link,token=new URL(link).hash.slice(1),digest=await hash(token);
  const opened=new URL(link);if(caseNo===1)opened.pathname+='/';
  await page.goto(opened.href);assert.equal(await page.evaluate(()=>location.hash),'');assert.equal((await f.operator.query('SELECT consumed_at FROM cc_magic_tokens WHERE hash=$1',[digest])).rows[0].consumed_at,null,'Scanner GET cannot consume');
  await capture(page,`confirm-${caseNo}-${lang}`);
  if(caseNo===1){await page.locator('[data-auth-language]').first().click();await page.waitForURL('**/feedback/sign-in');await page.locator('[data-auth-language]').last().click();await page.waitForURL('**/en/feedback/sign-in');assert.equal(await page.evaluate(()=>location.hash),'');}
  await page.locator('#consume').click();await page.waitForURL(server.origin+base);await page.waitForFunction(()=>document.querySelector('#fields')?.disabled===false);
  assert.notEqual((await f.operator.query('SELECT consumed_at FROM cc_magic_tokens WHERE hash=$1',[digest])).rows[0].consumed_at,null);return base;
 }
 for(const lang of ['en','es'])for(const width of [390,1280]){
  caseNo++;server.setIP('192.0.2.'+(caseNo+10));const c=await context(),page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height:844});
  if(caseNo===1){await page.goto(server.origin+'/en/feedback/sign-in');await page.locator('#consume').click();await page.waitForFunction(()=>document.querySelector('#auth-status').textContent.includes('Open the link'));await page.goto(server.origin+'/en/feedback/sign-in#synthetic-invalid');await page.waitForFunction(()=>location.hash==='');await page.locator('#consume').click();await page.waitForFunction(()=>document.querySelector('#consume').hidden===true);assert.match(await page.locator('#auth-status').innerText(),/expired/);}
  const guest=await f.person(),base=await signIn(page,guest,lang);
  await capture(page,`form-${lang}-${width}`);assert.equal(await page.locator('[name=photoConsent]').isChecked(),false);assert.equal(await page.locator('#photos').isDisabled(),true);
  await page.locator('#name').fill('Synthetic Guest');await page.locator('#affiliation').fill('Independent');await page.locator('#role').fill('Developer');await page.locator('#next').click();
  await page.locator('#feedback').fill('The session was disappointing; less pitching please.');await page.locator('#improvements').fill('N/A');await page.locator('#next').click();
  let lostOnce=true,committed;
  await page.route('**/api/feedback',async route=>{if(!lostOnce)return route.continue();lostOnce=false;const actual=await route.fetch();assert.equal(actual.status(),201);committed=await actual.json();await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic lost-response after real commit'})});});
  await page.locator('#next').click();await page.waitForFunction(()=>document.querySelector('#fields').disabled===false&&/confirm|confirmar/.test(document.querySelector('#status').textContent));assert.ok(committed?.saved);
  const beforeRetry=(await f.operator.query('SELECT total FROM cc_feedback_account_daily WHERE recipient_id=$1',[guest.id])).rows[0].total;assert.equal(beforeRetry,1);
  await page.locator('#next').click();await page.waitForURL(server.origin+base+'credit');
  assert.equal((await f.operator.query('SELECT total FROM cc_feedback_account_daily WHERE recipient_id=$1',[guest.id])).rows[0].total,1);
  const rows=(await f.operator.query("SELECT id,payload FROM event_feedback WHERE payload->>'recipientId'=$1",[guest.id])).rows;assert.equal(rows.length,1);assert.equal(rows[0].id,committed.id);assert.equal(rows[0].payload.photoConsent,false);assert.equal(rows[0].payload.improvements,'N/A');
  await page.locator('#claim').click();await page.locator('#credit-link code').waitFor();const value=await page.locator('#credit-link code').innerText();assert.match(value,/^SYNTHETIC_/);assert.equal(await page.locator('#credit-link a').count(),0);await capture(page,`credit-${lang}-${width}`);
  const csrf=await page.locator('#claim').getAttribute('data-csrf');const denied=await page.request.get(server.origin+'/feedback/admin');assert.equal(denied.status(),403);
  assert.equal(await page.evaluate(async csrf=>(await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csrf})})).status,csrf),200);
  await signIn(page,guest,lang);await page.goto(server.origin+base+'credit');await page.locator('#claim').click();await page.locator('#credit-link code').waitFor();assert.equal(await page.locator('#credit-link code').innerText(),value);
  const axe=await new AxeBuilder({page}).analyze();assert.deepEqual(axe.violations.map(x=>({id:x.id,impact:x.impact,nodes:x.nodes.map(n=>n.target)})),[]);assert.ok(!axe.incomplete.some(x=>x.id==='aria-prohibited-attr'));
  report.push({lang,width,actualWorker:true,actualPostgres:true,criticalFeedback:true,na:true,photoConsent:false,lostResponseRetry:true,reauthSameCode:true,attendeeAdminDenied:true,axeViolations:axe.violations.length,axeIncomplete:axe.incomplete.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)}))});await c.close();
 }
 caseNo++;server.setIP('192.0.2.99');const c=await context(),page=await c.newPage();await page.setViewportSize({width:390,height:844});await signIn(page,owner,'en');await page.goto(server.origin+'/feedback/admin');await page.locator('article').first().waitFor();await capture(page,'owner-admin-390');
 const exported=await page.request.get(server.origin+'/feedback/admin/export');assert.equal(exported.status(),200);const body=await exported.json();assert.equal(body.rows.length,4);assert.ok(body.classification.startsWith('PRIVATE'));assert.equal(body.inventory,undefined);
 // Exercise the private export CLI against the actual HTTPS Worker adapter.
 const privateDir=await mkdtemp(join(tmpdir(),'cc-proof-export-'));
 try{
  const cookie=(await c.cookies()).find(x=>x.name==='__Host-cc_session');assert.ok(cookie);const cookieFile=join(privateDir,'cookie.txt'),destination=join(privateDir,'export');
  await writeFile(cookieFile,cookie.name+'='+cookie.value,{mode:0o600});
  await new Promise((done,reject)=>{const child=spawn(process.execPath,[new URL('./export-private.mjs',import.meta.url).pathname,'--cookie-file',cookieFile,'--out',destination],{env:{...process.env,PUBLIC_ORIGIN:server.origin,NODE_EXTRA_CA_CERTS:server.caFile},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Export CLI timeout'));},30000);child.once('error',e=>{clearTimeout(timeout);reject(e);});child.once('exit',code=>{clearTimeout(timeout);if(code===0)done();else reject(Error('Export CLI failed: '+output));});});
  const artifact=JSON.parse(await readFile(join(destination,'feedback.PRIVATE.json'),'utf8'));assert.equal(artifact.complete,true);assert.equal(artifact.rows.length,4);report.push({privateExportCLI:true,completeArtifact:true});
 }finally{await rm(privateDir,{recursive:true,force:true});}
 // An access-only owner has no invented attendance or claim eligibility.
 const ownerRow=(await f.operator.query('SELECT * FROM cc_recipients WHERE id=$1',[owner.id])).rows[0];assert.equal(ownerRow.claim_eligible,false);assert.equal(ownerRow.checked_in_at,null);
 await page.goto(server.origin+'/en/feedback/credit');await page.locator('#claim').click();await page.waitForFunction(()=>document.querySelector('#auth-status').dataset.state==='error');assert.equal((await f.operator.query('SELECT count(*)::int n FROM cc_credit_codes WHERE recipient_id=$1',[owner.id])).rows[0].n,0);
 await c.close();assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 if(platform==='vercel'){assert.ok(server.calls.provider>=9);assert.equal(server.calls.denied,1);}
 const result={passed:true,platform,actualVercelAdapter:platform==='vercel',authenticatedSeparateSender:platform==='vercel',externalRequests:external,uncaughtBrowserErrors:errors,actualWorkerFetch:true,noSendOutbox:true,nativePostgres:true,ownerDashboardExport:true,report,accessibilityNote:'Incomplete axe checks are reported for manual review, not claimed as automated passes.'};
 await writeFile(resolve(out,'browser-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser?.close();await server?.close();await f.close();}
