const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const source = html.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
const {buildNetwork, buildGrowthForecast, networkAtForecastQuantile, runPlan, evaluatePlan} =
  vm.runInNewContext(source + '\n({buildNetwork, buildGrowthForecast, networkAtForecastQuantile, runPlan, evaluatePlan})');
const same = (a,b) => assert.equal(JSON.stringify(a), JSON.stringify(b));
const initial = {capexInr: 2400000, upgrades: 8, mobileUnits: 3};
let cases = 0, maxMs = 0;
for (const seed of [1, 42, 2026]) {
  const network = buildNetwork(seed);
  const planning = networkAtForecastQuantile(network, buildGrowthForecast(network));
  for (const scenario of ['normal', 'hot', 'highEV']) {
    let previous = runPlan(planning, scenario, initial, seed);
    assert.equal(previous.search.mode, 'fresh');
    for (const budget of [
      {...initial, capexInr: 1000000}, {...initial, upgrades: 0, mobileUnits: 0},
      {...initial, capexInr: 0}, {...initial, capexInr: 6000000}, initial,
    ]) {
      const snapshot = JSON.stringify(previous);
      const started = performance.now();
      const result = runPlan(planning, scenario, budget, seed, 20, 40, {archive: previous.archive});
      const elapsed = performance.now() - started;
      maxMs = Math.max(maxMs, elapsed);
      assert.ok(elapsed < 5000, `warm re-plan exceeded 5s: ${elapsed}`);
      same(result, runPlan(planning, scenario, budget, seed, 20, 40, {archive: previous.archive}));
      assert.equal(JSON.stringify(previous), snapshot, 'input archive and previous result are immutable');
      assert.equal(result.search.mode, 'warm');
      assert.ok(result.search.reusedPlans > 0 && result.search.reusedPlans <= 20);
      assert.ok(result.search.repairedPlans <= result.search.reusedPlans);
      if (budget.capexInr === 0 && previous.pareto.every(p => p.capexInr > 0))
        assert.ok(result.search.repairedPlans > 0);
      assert.equal(result.history.length, 20);
      for (const p of [...result.pareto, result.baseline]) {
        const evaluation = evaluatePlan(planning, scenario, p.actions);
        assert.equal(p.capexInr, evaluation.capexInr);
        assert.equal(p.lossOfLifeHours, evaluation.lossOfLifeHours);
        assert.equal(p.overloadHours, evaluation.overloadHours);
        assert.ok(p.capexInr <= budget.capexInr);
        assert.ok(Object.values(p.actions).filter(a => a === 'upgrade').length <= budget.upgrades);
        assert.ok(Object.values(p.actions).filter(a => a === 'mobile').length <= budget.mobileUnits);
      }
      for (const p of result.pareto) assert.ok(!result.pareto.some(q =>
        q.capexInr <= p.capexInr && q.lossOfLifeHours <= p.lossOfLifeHours && q.overloadHours <= p.overloadHours &&
        (q.capexInr < p.capexInr || q.lossOfLifeHours < p.lossOfLifeHours || q.overloadHours < p.overloadHours)));
      // The archive is an independent copy, not references to the displayed result.
      same(result.archive.plans, result.pareto.map(p => p.actions));
      assert.notEqual(result.archive.plans[0], result.pareto[0].actions);
      previous = result; cases++;
    }
  }
}
const net = buildNetwork(42);
const cold = runPlan(net, 'hot', initial);
const archive = cold.archive;
for (const [network, scenario, seed] of [
  [buildNetwork(7), 'hot', 42], [net, 'normal', 42], [net, 'hot', 7],
  [networkAtForecastQuantile(net, buildGrowthForecast(net)), 'hot', 42],
  [{...net, transformers: net.transformers.slice().reverse()}, 'hot', 42],
]) assert.throws(() => runPlan(network, scenario, initial, seed, 20, 40, {archive}), /does not match/);
for (const invalid of [
  {...archive, version: 0}, {...archive, plans: []}, {...archive, plans: [{}]},
  {...archive, plans: [{...archive.plans[0], 'T-01': 'free-upgrade'}]},
]) assert.throws(() => runPlan(net, 'hot', initial, 42, 20, 40, {archive: invalid}), /archive/);
// No cached objective data is read from an archive, even if supplied by a caller.
const decorated = {...archive, plans: archive.plans.map(actions => ({...actions})), capexInr: -1};
same(runPlan(net, 'hot', initial, 42, 20, 40, {archive}),
     runPlan(net, 'hot', initial, 42, 20, 40, {archive: decorated}));
// Prove archived actions actually seed the search, rather than only setting metadata.
const single = {seed: 42, transformers: [net.transformers[0]], edges: []};
const one = runPlan(single, 'hot', initial);
const crafted = {...one.archive, plans: [{'T-01': 'rebalance'}]};
const seeded = runPlan(single, 'hot', initial, 42, 1, 2, {archive: crafted});
assert.ok(seeded.pareto.some(p => p.actions['T-01'] === 'rebalance'));
const repaired = runPlan(single, 'hot', {...initial, capexInr: 0}, 42, 1, 2, {archive: crafted});
assert.equal(repaired.search.repairedPlans, 1);
assert.equal(repaired.pareto[0].capexInr, 0);
console.log(`PASS: ${cases} deterministic warm re-plans across 3 seeds × 3 scenarios; repaired caps/counts; zero-to-high recovery; non-dominance; immutable archives; mismatch rejection; actual archive seeding. Slowest warm run ${maxMs.toFixed(0)} ms (<5s).`);
