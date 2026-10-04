const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
(async()=>{const browser=await chromium.connectOverCDP(process.env.CDP_URL || 'http://127.0.0.1:9222');try{
 const page=await browser.contexts()[0].newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.setViewportSize({width:1440,height:1000});
 await page.goto((process.env.BASE_URL || 'http://127.0.0.1:3000') + '/?overnight='+Date.now());
 const button=name=>page.getByRole('button',{name,exact:true});
 await button('Start planning').click();await button('Protect').click();
 for(const scenario of ['Normal summer','Hot summer','High EV growth']){
  await button(scenario).click();
  const slider=page.getByRole('slider',{name:'Overnight replay time'});
  assert.equal(await slider.getAttribute('max'),'143');
  await slider.focus();await slider.press('End');
  assert.equal(await page.locator('.clock').innerText(),'+1d 11:45');
  await slider.press('Home');for(let i=0;i<95;i++)await slider.press('ArrowRight');
  assert.equal(await page.locator('.clock').innerText(),'23:45');
  await page.locator('.playbtn').click();
  await page.waitForFunction(()=>document.querySelector('.clock').textContent.startsWith('+1d'));
  await page.locator('.playbtn').click();
  for(const mode of ['unmanaged','managed','tou']){
   assert.match(await page.getByTestId('delivery-'+mode).innerText(),/100% on time/);
   assert.match(await page.getByTestId('delivery-'+mode).innerText(),/0.00 kWh unmet/);
  }
  await page.locator('summary').filter({hasText:'Inspect EV sessions'}).click();
  assert.ok(await page.getByText(/Managed: .*On time/).first().isVisible());
  await page.locator('summary').filter({hasText:'Inspect EV sessions'}).click();
  assert.ok((await page.getByRole('img',{name:'EV charge schedule'}).textContent()).includes('12+1d'));
 }
 // Inject a deliberately infeasible synthetic session to verify honest UI reporting.
 await page.evaluate(()=>{window.originalProtect=window.runProtect;window.runProtect=(n,s,id,seed)=>window.originalProtect(n,s,id,seed,{sessions:[{id:'tight-deadline',arrive:17.1,depart:17.2,energy:10,maxKw:7}]});});
 await button('Plan').click();await button('Protect').click();
 await page.getByRole('alert').waitFor();
 assert.match(await page.getByTestId('delivery-managed').innerText(),/0% on time/);
 assert.match(await page.getByTestId('delivery-tou').innerText(),/10.00 kWh unmet/);
 assert.match(await page.getByTestId('delivery-unmanaged').innerText(),/0.70 \/ 10.00 kWh delivered/);
 await page.locator('summary').filter({hasText:'Inspect EV sessions'}).click();
 await page.getByText(/Managed: .*Unmet demand/).waitFor();
 await page.getByTestId('charging-audit').scrollIntoViewIfNeeded();
 await page.screenshot({path:'/tmp/greentrafo-overnight-shortfall.png'});
 await page.evaluate(()=>{window.runProtect=window.originalProtect;delete window.originalProtect;});
 await button('Plan').click();await button('Protect').click();
 const slider=page.getByRole('slider',{name:'Overnight replay time'});await slider.focus();await slider.press('End');
 assert.equal(await page.getByRole('alert').count(),0);
 await page.locator('#app-root').evaluate(el=>el.scrollIntoView());
 await page.screenshot({path:'/tmp/greentrafo-overnight-desktop.png'});
 await page.getByTestId('charging-audit').scrollIntoViewIfNeeded();
 await page.screenshot({path:'/tmp/greentrafo-overnight-delivery.png'});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.getByTestId('charging-audit').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/greentrafo-overnight-mobile.png'});
 await page.setViewportSize({width:1440,height:1000});await page.locator('#app-root').evaluate(el=>el.scrollIntoView());
 await page.bringToFront();
 assert.deepEqual(errors,[]);console.log('PASS overnight browser: all scenarios, replay through midnight/to noon, all delivery summaries, session disclosure, impossible-demand warning, strict ToU shortfall, restored normal demo, desktop/mobile, no runtime/console errors.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
