// Uses the same visible Chrome / Playwright setup as browser-full.cjs.
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
(async () => {
  const browser = await chromium.connectOverCDP(process.env.CDP_URL || 'http://127.0.0.1:9222');
  try {
    const context = browser.contexts()[0];
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
    await page.setViewportSize({width:1440, height:1000});
    await page.goto((process.env.BASE_URL || 'http://127.0.0.1:3000') + '/?warm=' + Date.now());
    const button = name => page.getByRole('button', {name, exact:true});
    await button('Start planning').click();
    const status = page.getByTestId('search-summary');
    const budgetSummary = page.getByTestId('budget-summary');
    const timings = [];
    async function run(mode) {
      const start = Date.now();
      await page.getByRole('button', {name:/^(Run optimiser|Re-optimise plans|Re-plan from previous plans)$/}).click();
      await button('Re-optimise plans').waitFor();
      const text = await status.innerText();
      assert.ok(text.startsWith(mode), text);
      assert.match(text, mode === 'Warm start' ? /20 generations/ : /60 generations/);
      if (mode === 'Warm start') {
        assert.match(text, /[1-9]\d* previous plans reused/);
        const elapsed = Date.now() - start;
        assert.ok(elapsed < 5000, `warm click-to-result took ${elapsed}ms`);
        timings.push(elapsed);
      }
      assert.equal(await page.getByRole('alert').count(), 0);
    }
    async function change(id, value) {
      const slider = page.locator('#' + id);
      await slider.focus(); await slider.press('Home');
      const step = Number(await slider.getAttribute('step') || 1);
      for (let i=0; i<value/step; i++) await slider.press('ArrowRight');
      assert.equal(await slider.inputValue(), String(value));
      assert.equal(await budgetSummary.count(), 0);
      await button('Re-plan from previous plans').waitFor();
    }
    await run('Fresh search');
    for (const cap of [1000000, 0, 6000000]) {
      await change('capex-budget', cap); await run('Warm start');
      const text = await budgetSummary.innerText();
      const money = [...text.matchAll(/₹([\d.]+)L/g)].map(m => Number(m[1]));
      assert.ok(money.every(n => n >= 0 && n <= cap/100000));
      if (cap === 0) assert.match(text, /both policies take no action/);
    }
    await change('upgrade-limit', 0); await run('Warm start');
    await change('mobile-limit', 0); await run('Warm start');
    await page.getByTitle('Copy plan summary to clipboard').click();
    await button('✓ Copied').waitFor();
    assert.match(await page.evaluate(() => navigator.clipboard.readText()), /Search: Warm start; .*20 generations/);
    await run('Fresh search');
    await button('Normal summer').click();
    assert.equal(await status.count(), 0);
    assert.equal(await button('Re-plan from previous plans').count(), 0);
    await run('Fresh search');
    // Catch-and-recover path: a failed computation must not leave disabled controls.
    await page.evaluate(() => {window.savedRunPlan = window.runPlan; window.runPlan = () => {throw new Error('Test computation failure');};});
    await button('Re-optimise plans').click();
    await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').innerText(), /Test computation failure/);
    assert.ok(await button('Run optimiser').isEnabled());
    await page.evaluate(() => {window.runPlan = window.savedRunPlan; delete window.savedRunPlan;});
    await run('Fresh search');
    await button('Protect').click(); await button('Plan').click();
    assert.equal(await status.count(), 0, 'tab exit clears the session archive');
    await button('Hot summer').click(); await run('Fresh search');
    await change('capex-budget', 1000000); await run('Warm start');
    await page.locator('.rc').filter({has: page.getByText('Most reliable', {exact:true})}).click();
    await page.locator('#app-root').evaluate(el => el.scrollIntoView({block:'start'}));
    await page.screenshot({path:'/tmp/greentrafo-warm-desktop.png'});
    await page.setViewportSize({width:390, height:844});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await status.scrollIntoViewIfNeeded();
    await page.screenshot({path:'/tmp/greentrafo-warm-mobile.png'});
    await page.setViewportSize({width:1440, height:1000});
    await page.locator('#app-root').evaluate(el => el.scrollIntoView({block:'start'}));
    assert.deepEqual(errors, []);
    console.log(`PASS warm browser: decrease/zero/increase, both resource limits, archive reset, fresh rerun, copy, error recovery, desktop/mobile. Click-to-result warm times: ${timings.join(', ')} ms.`);
    console.log(await status.innerText());
  } finally {await browser.close();}
})().catch(e => {console.error(e); process.exitCode=1;});
