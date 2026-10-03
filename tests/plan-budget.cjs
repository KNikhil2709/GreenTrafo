const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const engine = html.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
const { buildNetwork, runPlan, evaluatePlan } = vm.runInNewContext(engine + '\n({buildNetwork, runPlan, evaluatePlan})');

// Independently account for all action types, rather than trusting reported capex.
function check(network, result, budget) {
  assert.equal(JSON.stringify(result.budget), JSON.stringify(budget));
  for (const plan of [...result.pareto, ...Object.values(result.profiles), result.baseline]) {
    let spent = 0, upgrades = 0, mobiles = 0;
    for (const t of network.transformers) {
      const action = plan.actions[t.id];
      assert.ok(['none', 'upgrade', 'mobile', 'rebalance'].includes(action));
      if (action === 'upgrade') { spent += {100: 180000, 200: 240000, 250: 300000}[t.rating]; upgrades++; }
      if (action === 'mobile') { spent += 120000; mobiles++; }
      if (action === 'rebalance') spent += 40000;
    }
    assert.equal(plan.capexInr, spent);
    assert.ok(spent <= budget.capexInr);
    assert.ok(upgrades <= budget.upgrades && mobiles <= budget.mobileUnits);
    if (budget.capexInr < 40000) {
      assert.equal(spent, 0);
      assert.equal(plan.lossOfLifeHours, evaluatePlan(network, 'hot', {}).lossOfLifeHours);
    }
  }
}
let cases = 0;
for (const seed of [1, 42, 2026]) {
  const network = buildNetwork(seed);
  const original = JSON.stringify(network);
  for (const capexInr of [0, 39999, 40000, 119999, 120000, 180000, 2400000, 6000000]) {
    const budget = {capexInr, upgrades: 8, mobileUnits: 3};
    const snapshot = JSON.stringify(budget);
    check(network, runPlan(network, 'hot', budget, seed, 12, 20), budget);
    assert.equal(JSON.stringify(budget), snapshot);
    cases++;
  }
  const rebalanceOnly = {capexInr: 80000, upgrades: 0, mobileUnits: 0};
  const result = runPlan(network, 'hot', rebalanceOnly, seed);
  check(network, result, rebalanceOnly);
  assert.ok(result.pareto.some(p => p.capexInr > 0), 'rebalance remains available within the cap');
  assert.equal(result.baseline.capexInr, 0);
  assert.equal(JSON.stringify(network), original);
}

// Highest-loading unit costs too much: baseline must continue to cheaper units.
const fixture = {seed: 42, transformers: [
  {id: 'T-01', rating: 250, peakFactor: 1.3, acShare: 0.5, unsanctioned: 0.1},
  {id: 'T-02', rating: 100, peakFactor: 1.2, acShare: 0.5, unsanctioned: 0.1},
]};
const budget = {capexInr: 180000, upgrades: 2, mobileUnits: 0};
const baseline = runPlan(fixture, 'hot', budget).baseline;
assert.equal(baseline.actions['T-01'], 'none');
assert.equal(baseline.actions['T-02'], 'upgrade');
assert.equal(baseline.capexInr, 180000);
const mobile = runPlan(fixture, 'hot', {...budget, capexInr: 120000, mobileUnits: 1}).baseline;
assert.equal(mobile.actions['T-01'], 'mobile');
assert.equal(mobile.capexInr, 120000);
for (const key of ['capexInr', 'upgrades', 'mobileUnits']) {
  for (const value of [-1, 0.5, NaN, Infinity, undefined, '2400000']) {
    assert.throws(() => runPlan(fixture, 'hot', {...budget, [key]: value}), /non-negative safe integer/);
  }
}
console.log(`PASS: ${cases} capex boundary cases, rebalance-only plans, independent costs, baseline affordability/fallback, input validation and no mutation.`);
