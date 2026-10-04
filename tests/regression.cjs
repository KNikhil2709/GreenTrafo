const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
process.chdir(path.join(__dirname, '..'));

// Exercise the actual shipped engine, including the build's module concatenation.
const html = fs.readFileSync('index.html', 'utf8');
assert.equal(html, fs.readFileSync('greentrafo.html', 'utf8'));
const engine = html.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
const api = vm.runInNewContext(engine + `\n({buildNetwork, buildGrowthForecast,
  networkAtForecastQuantile, simulateTransformer, simulateTransformerBand,
  evaluatePlan, clearSimCache, runPlan, runProtect, runValidation, evSessions})`);
const {buildNetwork, buildGrowthForecast, networkAtForecastQuantile,
  simulateTransformer, simulateTransformerBand, evaluatePlan, clearSimCache,
  runPlan, runProtect, runValidation, evSessions} = api;
const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));
let plans = 0, protects = 0;
const started = performance.now();
for (const seed of [1, 7, 42, 99, 2026]) {
  const network = buildNetwork(seed);
  same(network, buildNetwork(seed));
  const original = JSON.stringify(network);
  const forecast = buildGrowthForecast(network);
  same(forecast, buildGrowthForecast(network));
  assert.equal(forecast.calibration.samples, 240);
  const planning = networkAtForecastQuantile(network, forecast);
  assert.equal(JSON.stringify(network), original);
  for (const t of network.transformers) {
    const {p10, p50, p90} = forecast.byId[t.id];
    assert.ok(0 <= p10 && p10 <= p50 && p50 <= p90 && p90 <= 0.35);
    assert.equal(planning.transformers.find(p => p.id === t.id).unsanctioned, p90);
    const band = simulateTransformerBand(t, 'hot', forecast);
    assert.equal(band.p90Loading.length, 96);
    for (let s = 0; s < 96; s++) {
      assert.ok(band.p10Loading[s] <= band.p50Loading[s] && band.p50Loading[s] <= band.p90Loading[s]);
      assert.ok(band.p10HotSpot[s] <= band.p50HotSpot[s] && band.p50HotSpot[s] <= band.p90HotSpot[s]);
    }
  }
  for (const scenario of ['normal', 'hot', 'highEV']) {
    // No manual cache clearing between seeds, scenarios, or forecast variants.
    evaluatePlan(network, scenario, {});
    const cached = evaluatePlan(planning, scenario, {});
    const expected = planning.transformers.reduce((sum, t) => sum + simulateTransformer(t, scenario).lolHours, 0);
    assert.equal(cached.lossOfLifeHours, expected, 'cache must distinguish p90 from ground truth');
    clearSimCache();
    same(cached, evaluatePlan(planning, scenario, {}));
    const budget = {capexInr: 2400000, upgrades: 8, mobileUnits: 3};
    const result = runPlan(planning, scenario, budget, seed);
    same(result, runPlan(planning, scenario, budget, seed));
    assert.ok(result.pareto.length > 0);
    for (const p of [...result.pareto, result.baseline]) {
      assert.ok(p.capexInr <= budget.capexInr);
      assert.ok([p.capexInr, p.lossOfLifeHours, p.overloadHours].every(Number.isFinite));
      assert.ok(Object.values(p.actions).filter(a => a === 'upgrade').length <= 8);
      assert.ok(Object.values(p.actions).filter(a => a === 'mobile').length <= 3);
      if (p !== result.baseline) assert.ok(!result.pareto.some(q => q.capexInr <= p.capexInr && q.lossOfLifeHours <= p.lossOfLifeHours && q.overloadHours <= p.overloadHours &&
        (q.capexInr < p.capexInr || q.lossOfLifeHours < p.lossOfLifeHours || q.overloadHours < p.overloadHours)));
    }
    plans++;
    for (const t of network.transformers) {
      const pr = runProtect(network, scenario, t.id, seed);
      assert.ok(pr.onTimeShare >= 0.95);
      assert.ok(pr.overLimitManaged <= pr.overLimitUnmanaged);
      const energy = evSessions(t, scenario, seed).reduce((sum, s) => sum + s.energy, 0);
      for (const key of ['managedKw', 'unmanagedKw', 'touKw']) {
        assert.equal(pr[key].length, 144);
        assert.ok(pr[key].every(v => Number.isFinite(v) && v >= 0));
        assert.ok(Math.abs(pr[key].reduce((sum, kw) => sum + kw * 0.25, 0) - energy) < 0.02);
      }
      protects++;
    }
  }
}
const checks = runValidation(buildNetwork(42));
assert.ok(checks.every(c => c.passed), JSON.stringify(checks));
console.log(`PASS: 5 seeds; ${plans} deterministic Plan cases; ${protects} Protect cases; forecast bands; cache isolation; identical HTML; ${checks.length}/5 browser smoke checks. ${(performance.now() - started).toFixed(0)} ms`);
