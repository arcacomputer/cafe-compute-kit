import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {once} from 'node:events';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
import {createPreviewServer} from './preview.mjs';
const require=createRequire(import.meta.url),root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out=path.resolve(process.env.SITE_PROOF_OUTPUT_DIR||path.join(root,'.proof/event-site'));
await mkdir(out,{recursive:true});
let server,origin=process.env.SITE_PROOF_ORIGIN;
if(origin){const target=new URL(origin);if(!['https:','http:'].includes(target.protocol)||!['127.0.0.1','localhost','[::1]'].includes(target.hostname)||target.origin!==origin)throw Error('Site proof refuses non-local/non-origin targets');}
else{server=createPreviewServer(path.join(root,'dist'));server.listen(0,'127.0.0.1');await once(server,'listening');origin=`http://127.0.0.1:${server.address().port}`;}
const rows=[],errors=[],external=[],axeSource=await readFile(require.resolve('axe-core/axe.min.js'),'utf8');
let browser;
try{
 browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:900}});
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){external.push(route.request().url());return route.abort();}return route.continue();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  for(const prefix of ['/','/en/'])for(const part of ['','resources/','slides/','recap/','gallery/','privacy/']){
   const route=prefix+part,response=await page.goto(origin+route);assert.equal(response.status(),200,route);
   assert.equal(await page.locator('html').getAttribute('lang'),prefix==='/en/'?'en':'es');
   assert.equal(await page.locator('main h1').count(),1,route);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow: ${route} at ${width}`);
   const broken=await page.locator('img').evaluateAll(nodes=>nodes.filter(n=>!n.complete||n.naturalWidth===0).map(n=>n.src));assert.deepEqual(broken,[],route);
   await page.evaluate(axeSource);
   const axe=await page.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
   assert.deepEqual(axe.violations.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)})),[],`${route} ${width}`);
   assert.deepEqual(axe.incomplete.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)})),[],`Unresolved a11y: ${route} ${width}`);
   rows.push({route,width,overflow:false,axeViolations:0,axeIncomplete:0});
   if((width===1440&&route==='/en/')||(width===390&&['/','/en/resources/','/en/gallery/'].includes(route))){await page.locator('h1').blur();await page.screenshot({path:path.join(out,`site-${width}-${route.replace(/\//g,'_')||'home'}.png`),fullPage:true});}
  }
  await page.goto(origin+'/en/resources/');await page.locator('.language').click();assert.equal(new URL(page.url()).pathname,'/resources/');
  await page.goto(origin+'/en/slides/');const count=await page.locator('.slide').count();assert.ok(count>1);
  await page.locator('[data-slide-next]').click();assert.ok(page.url().endsWith('#slide-2'));
  await page.locator('h2:visible').focus();await page.keyboard.press('End');assert.ok(page.url().endsWith(`#slide-${count}`));
  await page.keyboard.press('Home');assert.ok(page.url().endsWith('#slide-1'));
  await page.locator('[data-fullscreen]').click();await page.waitForFunction(()=>document.fullscreenElement!==null);await page.evaluate(()=>document.exitFullscreen());
  await page.emulateMedia({media:'print',reducedMotion:'reduce'});
  assert.equal(await page.locator('.slide').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).display!=='none').length),count);
  if(width===1440){const pdf=await page.pdf({path:path.join(out,'slides-en.pdf'),preferCSSPageSize:true,printBackground:true});assert.ok(pdf.subarray(0,4).toString()==='%PDF');assert.ok(pdf.length>1000);}
  await context.close();
 }
 const context=await browser.newContext({ignoreHTTPSErrors:true,javaScriptEnabled:false,viewport:{width:390,height:844}}),page=await context.newPage();await page.goto(origin+'/en/slides/');assert.ok(await page.locator('.slide').count()>1);assert.equal(await page.locator('.slide').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).display==='none').length),0);await context.close();
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 const result={passed:true,routesAndWidths:rows,noJSDeck:true,keyboardDeck:true,fullscreen:true,printPDF:true,externalRequests:external,browserErrors:errors};await writeFile(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));}
