const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
(async()=>{
 const browser=await chromium.connectOverCDP(process.env.CDP_URL || 'http://127.0.0.1:9222');
 try {
  const page=await browser.contexts()[0].newPage();
  await page.setViewportSize({width:1440,height:1000});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
  await page.goto((process.env.BASE_URL || 'http://127.0.0.1:3000') + '/?handoff='+Date.now());
  const button=name=>page.getByRole('button',{name,exact:true});
  const tab=name=>page.locator('nav.tabs').getByRole('button',{name,exact:true}).click();
  const handoff=page.getByTestId('transferred-plan');
  const standalone=page.getByTestId('standalone-protect');
  await button('Start planning').click();
  assert.equal(await button('Use this plan in Protect').count(),0);
  await tab('Protect'); await standalone.waitFor();
  let comparisons=0;
  async function transfer(scenario,profile,zero=false) {
   await tab('Plan');
   await button(scenario).click();
   if(zero){await page.locator('#capex-budget').focus(); await page.locator('#capex-budget').press('Home');}
   await button('Run optimiser').click();
   await button('Re-optimise plans').waitFor();
   await page.locator('.rc').filter({has:page.getByText(profile,{exact:true})}).click();
   const cost=(await page.locator('.rc[aria-pressed="true"] .cv').first().innerText()).match(/^[\d.]+L/)[0];
   await button('Use this plan in Protect').click();
   await handoff.waitFor();
   assert.match(await handoff.innerText(),new RegExp(profile));
   assert.ok((await handoff.innerText()).includes(`₹${cost} spent`));
   assert.equal(await button(scenario).getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('#inspect-transformer option').count(),40);
   const count=Number((await handoff.innerText()).match(/(\d+) actions/)[1]);
   assert.equal(await page.locator('svg.feeder circle[r="4.5"]').count(),count);
  }
  for(const [scenario,key] of [['Normal summer','normal'],['Hot summer','hot'],['High EV growth','highEV']]) {
   for(const [label,profile] of [['Lowest cost','lowestCost'],['Balanced','balanced'],['Most reliable','mostReliable']]) {
    await transfer(scenario,label);
    const expected=await page.evaluate(({key,profile})=>{
     const n=buildNetwork(42),p=networkAtForecastQuantile(n,buildGrowthForecast(n));
     const r=runPlan(p,key,{capexInr:2400000,upgrades:8,mobileUnits:3});
     const h=createProtectPlan(p,key,r.profiles[profile].actions);
     const ids=[...new Set(Object.values(h.actions))].map(a=>Object.keys(h.actions).find(id=>h.actions[id]===a));
     return ids.map(id=>({id,action:h.actions[id],before:runProtect(h.before,key,id),after:runProtect(h.after,key,id),
      beforeRating:h.before.transformers.find(t=>t.id===id).rating,afterRating:h.after.transformers.find(t=>t.id===id).rating}));
    },{key,profile});
    for(const e of expected) {
     await page.locator('#inspect-transformer').selectOption(e.id);
     for(const [view,data,rating] of [['Without plan',e.before,e.beforeRating],['Selected plan',e.after,e.afterRating]]) {
      await button(view).click();
      if(view==='Without plan') assert.equal(await page.locator('svg.feeder circle[r="4.5"]').count(),0);
      assert.equal(await page.locator('#inspect-transformer').inputValue(),e.id,'comparison keeps same transformer');
      assert.match(await page.getByTestId('applied-action').innerText(),new RegExp(`${rating} kVA`));
      if(view==='Selected plan') assert.ok((await page.getByTestId('applied-action').innerText()).includes(e.action));
      const numbers=await page.locator('.railR .metric-grid .n').allTextContents();
      assert.deepEqual(numbers,[`${data.overLimitManaged.toFixed(1)} h`,`${Math.round(data.onTimeShare*100)}%`,`${data.lolSaved.toFixed(1)} h`,data.peakKwhShifted.toFixed(0)]);
      await button('Unmanaged').click();
      assert.equal(await page.locator('.railR .metric-grid .n').first().innerText(),`${data.overLimitUnmanaged.toFixed(1)} h`);
      await button('Managed').click(); comparisons++;
     }
    }
   }
   console.log(`PASS handoff ${scenario}: all profiles; actions and before/after metrics match independently simulated networks`);
  }
  await transfer('Hot summer','Balanced',true);
  assert.match(await handoff.innerText(),/0 actions/);
  const zero=await page.locator('.railR .metric-grid').innerText();
  await button('Without plan').click();
  assert.equal(await page.locator('.railR .metric-grid').innerText(),zero);
  await button('Selected plan').click();
  // Snapshot survives unrelated navigation, but scenario/input edits explicitly clear it.
  await tab('Method & limits'); await tab('Protect'); await handoff.waitFor();
  await button('Normal summer').click(); await standalone.waitFor();
  assert.equal(await handoff.count(),0);
  await transfer('Hot summer','Most reliable');
  await button('Remove plan').click(); await standalone.waitFor();
  assert.equal(await page.locator('#inspect-transformer').count(),0);
  await transfer('Hot summer','Balanced');
  await tab('Plan');
  await page.locator('#capex-budget').focus();await page.locator('#capex-budget').press('ArrowLeft');
  await tab('Protect');await standalone.waitFor();
  await transfer('Hot summer','Balanced');
  await tab('Plan');await button('Run optimiser').click();await button('Re-optimise plans').waitFor();
  await tab('Protect');await standalone.waitFor();
  // Custom Pareto selection can also be handed over.
  await tab('Plan');await button('Run optimiser').click();await button('Re-optimise plans').waitFor();
  const point=page.getByRole('img',{name:'Pareto front: capex versus loss of life'}).locator(':scope > circle').last();
  await point.evaluate(el=>el.scrollIntoView({block:'center'}));await point.click();
  await button('Use this plan in Protect').click();await handoff.waitFor();
  assert.match(await handoff.innerText(),/Custom selection/);
  // Handoff also uses the newly selected warm-start result, not the previous archive.
  await tab('Plan'); await button('Run optimiser').click(); await button('Re-optimise plans').waitFor();
  await page.locator('#capex-budget').focus(); await page.locator('#capex-budget').press('ArrowLeft');
  assert.equal(await button('Use this plan in Protect').count(),0);
  await button('Re-plan from previous plans').click(); await button('Re-optimise plans').waitFor();
  assert.match(await page.getByTestId('search-summary').innerText(),/Warm start/);
  const warmCost=(await page.locator('.rc[aria-pressed="true"] .cv').first().innerText()).match(/^[\d.]+L/)[0];
  await button('Use this plan in Protect').click(); await handoff.waitFor();
  assert.ok((await handoff.innerText()).includes(`₹${warmCost} spent`));
  // Leave a useful demonstration of an upgraded transformer.
  await transfer('Hot summer','Most reliable');
  const upgrade=await page.locator('#inspect-transformer option').filter({hasText:/upgrade/}).first().getAttribute('value');
  await page.locator('#inspect-transformer').selectOption(upgrade);
  await button('Without plan').click();
  const before=await page.locator('.railR .metric-grid').innerText();
  await button('Selected plan').click();
  const after=await page.locator('.railR .metric-grid').innerText();
  assert.notEqual(after,before);
  await page.locator('svg.feeder text').filter({hasText:new RegExp(`^${upgrade}$`)}).locator('..').locator('circle').first().click();
  const slider=page.locator('.slider-row input');await slider.focus();await slider.press('Home');
  await page.locator('.playbtn').click();await page.waitForFunction(()=>Number(document.querySelector('.slider-row input').value)>2);await page.locator('.playbtn').click();
  await page.locator('#app-root').evaluate(el=>el.scrollIntoView());
  await page.screenshot({path:'/tmp/greentrafo-handoff-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await handoff.scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/greentrafo-handoff-mobile.png'});
  await page.setViewportSize({width:1440,height:1000});await page.locator('#app-root').evaluate(el=>el.scrollIntoView());
  assert.deepEqual(errors,[]);
  console.log(`PASS: ${comparisons} before/after metric comparisons; 9 scenario/profile handoffs; zero/custom plans; snapshot navigation; clearing on scenario/budget/rerun; removal; map/replay; desktop/mobile; no runtime/console errors.`);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
