const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  try {
    const context = browser.contexts()[0];
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [], failures = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('requestfailed', req => failures.push(req.url()));
    const button = name => page.getByRole('button', {name, exact: true});
    async function tab(name) { await page.locator('nav.tabs').getByRole('button', {name, exact: true}).click(); }
    async function healthy() {
      assert.ok(!/NaN|undefined|Infinity/.test(await page.locator('#app-root').innerText()));
      assert.equal(await page.locator('svg [d*="NaN"], svg [cx="NaN"], svg [cy="NaN"]').count(), 0);
    }
    async function run() {
      await page.getByRole('button', {name: /^(Run optimiser|Re-optimise plans|Re-plan from previous plans)$/}).click();
      await button('Re-optimise plans').waitFor();
    }
    await page.setViewportSize({width: 1440, height: 1000});
    await page.goto('http://127.0.0.1:3000/?review=' + Date.now());
    await button('How it works').click();
    await page.getByRole('heading', {name: 'What GreenTrafo does'}).waitFor();
    const faq = page.locator('.prose button');
    assert.equal(await faq.count(), 5);
    for (let i = 0; i < 5; i++) {
      await faq.nth(i).click();
      assert.ok(await faq.nth(i).locator('..').locator('p').isVisible());
      await faq.nth(i).click();
      assert.equal(await faq.nth(i).locator('..').locator('p').count(), 0);
    }
    await tab('Plan');
    await button('Start planning').click();
    let details = 0, points = 0, protectSelections = 0;
    for (const scenario of ['Normal summer', 'Hot summer', 'High EV growth']) {
      await button(scenario).click();
      // Every transformer, in every scenario; click its actual visible map node.
      for (let i = 1; i <= 40; i++) {
        const id = `T-${String(i).padStart(2, '0')}`;
        await page.locator('svg.feeder g').filter({has: page.locator('text', {hasText: new RegExp(`^${id}$`)})}).locator('circle').first().click();
        await page.getByRole('heading', {name: new RegExp(`^${id} ·`)}).waitFor();
        assert.ok(await page.getByText('Latent-load forecast', {exact: true}).isVisible());
        await healthy(); details++;
      }
      await run();
      for (const profile of ['Lowest cost', 'Balanced', 'Most reliable']) {
        await page.locator('.rc').filter({has: page.getByText(profile, {exact: true})}).click();
        assert.equal(await page.locator('.rc[aria-pressed="true"]').count(), 1);
      }
      const circles = page.getByRole('img', {name: 'Pareto front: capex versus loss of life'}).locator(':scope > circle');
      // Select the topmost rendered point with a real pointer click, then check export.
      await circles.last().evaluate(el => el.scrollIntoView({block: 'center'}));
      await circles.last().click(); points++;
      await page.getByTitle('Copy plan summary to clipboard').click();
      await button('✓ Copied').waitFor();
      assert.match(await page.evaluate(() => navigator.clipboard.readText()), /Profile: custom/);
      const before = await page.locator('.rc').allTextContents();
      await run();
      assert.deepEqual(await page.locator('.rc').allTextContents(), before, 're-run is deterministic');
      await healthy();
      console.log(`PASS Plan ${scenario}: all 40 detail cards, profiles, Pareto selection, copy and repeat run`);
    }
    await tab('Protect');
    for (const scenario of ['Normal summer', 'Hot summer', 'High EV growth']) {
      await button(scenario).click();
      const ids = await page.locator('.railL .seg button').filter({hasText: /^T-\d+$/}).allTextContents();
      for (const id of ids) {
        await button(id).click();
        assert.match(await page.locator('.maphead .sub').innerText(), new RegExp(id));
        await button('Unmanaged').click();
        assert.ok(await page.getByText('Unmanaged highlighted', {exact: true}).isVisible());
        await button('Managed').click();
        const slider = page.locator('.slider-row input');
        await slider.focus(); await slider.press('Home');
        assert.equal(await page.locator('.clock').innerText(), '00:00');
        await slider.press('End');
        assert.equal(await page.locator('.clock').innerText(), '+1d 11:45');
        await healthy(); protectSelections++;
      }
      // At-risk map selection, including entries not shown in the four buttons.
      const riskIds = await page.evaluate(() => {
        const net = buildNetwork(42);
        return net.transformers.filter(t => t.evCount >= 2).map(t => ({id:t.id, p:runProtect(net,
          document.querySelector('.railL .seg button[aria-pressed="true"]').textContent === 'Normal summer' ? 'normal' :
          document.querySelector('.railL .seg button[aria-pressed="true"]').textContent === 'Hot summer' ? 'hot' : 'highEV', t.id)}));
      });
      const strict = riskIds.filter(x => x.p.overLimitUnmanaged > 0 && x.p.baseOverLimit < 0.6);
      const fallback = riskIds.filter(x => x.p.overLimitUnmanaged > 0);
      const selectable = (strict.length ? strict : fallback).sort((a,b) => b.p.overLimitUnmanaged-a.p.overLimitUnmanaged).slice(0,8);
      for (const {id} of selectable) {
        await page.locator('svg.feeder text').filter({hasText: new RegExp(`^${id}$`)}).locator('..').locator('circle').first().click();
        assert.match(await page.locator('.maphead .sub').innerText(), new RegExp(id));
      }
      const slider = page.locator('.slider-row input');
      await slider.focus(); await slider.press('Home');
      await page.locator('.playbtn').click();
      await page.waitForFunction(() => Number(document.querySelector('.slider-row input').value) >= 3);
      await page.locator('.playbtn').click();
      const paused = await slider.inputValue();
      await page.waitForTimeout(180);
      assert.equal(await slider.inputValue(), paused, 'pause stops replay');
      await slider.focus(); await slider.press('End');
      await page.locator('.playbtn').click();
      await page.waitForFunction(() => document.querySelector('.playbtn').textContent === '▶');
      assert.equal(await slider.inputValue(), '143');
      console.log(`PASS Protect ${scenario}: selectors, map, both modes, slider endpoints, play/pause/end`);
    }
    await tab('Validate');
    for (let i=0;i<2;i++) {
      await button('Run validation').click();
      await page.getByText('5/5 passed', {exact: true}).waitFor();
    }
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({width, height: 1000});
      for (const name of ['Plan', 'Protect', 'Method & limits', 'Validate']) {
        await tab(name);
        await healthy();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} overflow at ${width}`);
        await page.locator('#app-root').evaluate(el => el.scrollIntoView());
        await page.screenshot({path: `/tmp/greentrafo-full-${width}-${name.split(' ')[0]}.png`});
      }
    }
    await page.goto('http://127.0.0.1:3000/greentrafo.html?review=' + Date.now());
    await button('Start planning').click(); await run();
    await healthy();
    assert.deepEqual(errors, [], 'browser console/runtime errors');
    assert.deepEqual(failures, [], 'failed network requests');
    console.log(`PASS full site: hero/FAQ, ${details} details, ${points} Pareto clicks, ${protectSelections} Protect button selections, replay, repeat validation, all tabs at 3 widths, alternate HTML entry. No console/runtime/network errors.`);
  } finally { await browser.close(); }
})().catch(e => {console.error(e); process.exitCode = 1;});
