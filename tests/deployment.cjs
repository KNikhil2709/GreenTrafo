const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.env.BASE_URL||'http://127.0.0.1:8080').replace(/\/$/,'');
const expected=JSON.parse(fs.readFileSync('dist/health.json'));
const headers=process.env.VERCEL_AUTOMATION_BYPASS_SECRET?{'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET}:{};
(async()=>{
 for(const route of ['/','/index.html','/greentrafo.html','/health.json']){
  const res=await fetch(base+route,{headers,signal:AbortSignal.timeout(20000)});
  assert.equal(res.status,200,route);
  assert.equal(res.headers.get('x-content-type-options'),'nosniff');
  assert.equal(res.headers.get('x-frame-options'),'DENY');
  assert.match(res.headers.get('cache-control'),/max-age=0/);
  if(route==='/health.json')assert.deepEqual(await res.json(),expected,'exact tested release');
  else assert.equal(await res.text(),fs.readFileSync('dist/index.html','utf8'),'exact HTML');
 }
 for(const route of ['/missing-page','/.env','/.git/config','/src/app.jsx','/package.json']) {
  assert.equal((await fetch(base+route,{headers,signal:AbortSignal.timeout(20000)})).status,404,route);
 }
 const browser=process.env.CDP_URL?await chromium.connectOverCDP(process.env.CDP_URL):await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try {
  const context=await browser.newContext({extraHTTPHeaders:headers});
  const page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/*',route=>{
   if(new URL(route.request().url()).origin!==new URL(base).origin){external.push(route.request().url());return route.abort();}
   return route.continue();
  });
  await page.goto(base);await page.getByRole('button',{name:'Start planning',exact:true}).click();
  await page.getByRole('button',{name:'Run optimiser',exact:true}).click();
  await page.getByRole('button',{name:'Use this plan in Protect',exact:true}).click();
  const slider=page.getByRole('slider',{name:'Overnight replay time'});await slider.focus();await slider.press('End');
  assert.equal(await page.locator('.clock').innerText(),'+1d 11:45');
  await page.getByTestId('charging-audit').waitFor();
  await page.getByRole('button',{name:'Validate',exact:true}).click();
  await page.getByRole('button',{name:'Run validation',exact:true}).click();
  await page.getByText('5/5 passed',{exact:true}).waitFor();
  assert.deepEqual(external,[],'app works with every external request blocked');assert.deepEqual(errors,[]);
  await context.close();
  console.log('PASS deployment: exact release/HTML, health, security/cache headers, private paths 404; Plan → Protect overnight → Validate with no external network, console errors or CSP failures.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
