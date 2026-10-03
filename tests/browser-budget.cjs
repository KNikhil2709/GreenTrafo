// Install playwright-core separately, or set PLAYWRIGHT_MODULE to an existing copy.
// Start the local server and Chrome with --remote-debugging-port=9222 first.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  try {
    const context = browser.contexts()[0];
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:3000');
    await page.getByRole('button', {name: 'Start planning', exact: true}).click();
    const summary = page.getByTestId('budget-summary');
    async function run() {
      await page.getByRole('button', {name: /^(Run optimiser|Re-optimise plans)$/}).click();
      await summary.waitFor({state: 'visible'});
    }
    async function cap(lakhs) {
      const slider = page.locator('#capex-budget');
      await slider.focus();
      await slider.press('Home');
      for (let i = 0; i < lakhs; i++) await slider.press('ArrowRight');
      assert.equal(await slider.inputValue(), String(lakhs * 100000));
      assert.equal(await summary.count(), 0, 'budget change clears old results');
    }
    await run();
    for (const scenario of ['Normal summer', 'Hot summer', 'High EV growth']) {
      await page.getByRole('button', {name: scenario, exact: true}).click();
      await run();
      for (const name of ['Lowest cost', 'Balanced', 'Most reliable']) {
        await page.locator('.rc').filter({has: page.getByText(name, {exact: true})}).click();
        const text = await summary.innerText();
        const values = [...text.matchAll(/₹([\d.]+)L/g)].map(m => Number(m[1]));
        assert.equal(values.length, 4);
        assert.ok(values.every(v => v >= 0 && v <= 24));
        assert.ok(Math.abs(values[0] + values[1] - 24) < 0.11);
        assert.ok(Math.abs(values[2] + values[3] - 24) < 0.11);
      }
    }
    await cap(0); await run();
    assert.match(await summary.innerText(), /Zero budget: both policies take no action/);
    assert.ok((await page.locator('.rc .cv').allTextContents()).filter(t => t.includes('L')).every(t => t.startsWith('0.0L')));
    await cap(1); await run();
    assert.match(await summary.innerText(), /80\/90 rule: ₹0.0L spent/);
    await page.locator('#upgrade-limit').focus();
    await page.locator('#upgrade-limit').press('Home');
    assert.equal(await summary.count(), 0);
    await page.locator('#mobile-limit').focus();
    await page.locator('#mobile-limit').press('Home');
    await run();
    await page.getByRole('button', {name: '📋 Copy', exact: true}).click();
    await page.getByRole('button', {name: '✓ Copied', exact: true}).waitFor();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(copied, /Budget cap: ₹1.0L/);
    assert.match(copied, /Simulated data/);
    await page.getByRole('button', {name: 'Validate', exact: true}).click();
    await page.getByRole('button', {name: 'Run validation', exact: true}).click();
    await page.getByText('5/5 passed', {exact: true}).waitFor();
    await page.getByRole('button', {name: 'Protect', exact: true}).click();
    await page.getByRole('heading', {name: 'Hot-spot temperature tonight'}).waitFor();
    await page.getByRole('button', {name: 'Plan', exact: true}).click();
    await page.getByRole('button', {name: 'Hot summer', exact: true}).click();
    await cap(10); await run();
    await page.locator('.rc').filter({has: page.getByText('Most reliable', {exact: true})}).click();
    await page.setViewportSize({width: 1440, height: 1000});
    await page.locator('#app-root').scrollIntoViewIfNeeded();
    await page.screenshot({path: '/tmp/greentrafo-budget-desktop.png', fullPage: true});
    await page.setViewportSize({width: 390, height: 844});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile has no horizontal overflow');
    await summary.scrollIntoViewIfNeeded();
    await page.screenshot({path: '/tmp/greentrafo-budget-mobile.png'});
    await page.setViewportSize({width: 1440, height: 1000});
    await page.locator('#app-root').evaluate(el => el.scrollIntoView({block: 'start'}));
    assert.deepEqual(errors, []);
    console.log('PASS: visible Chrome; 3 scenarios × 3 profiles; zero/small budgets; stale-result clearing; clipboard; Validate 5/5; Protect; mobile layout; no runtime exceptions.');
    console.log(await summary.innerText());
  } finally {
    await browser.close(); // Disconnect from the separately launched desktop browser.
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
