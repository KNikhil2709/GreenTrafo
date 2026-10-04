const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const src = html.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
const {buildNetwork, buildGrowthForecast, networkAtForecastQuantile, createProtectPlan, applyAction,
  evaluatePlan, runPlan, runProtect, evSessions} = vm.runInNewContext(src +
  '\n({buildNetwork, buildGrowthForecast, networkAtForecastQuantile, createProtectPlan, applyAction, evaluatePlan, runPlan, runProtect, evSessions})');
const same = (a,b) => assert.equal(JSON.stringify(a),JSON.stringify(b));
let cases = 0;
for (const seed of [1,42,2026]) {
  const raw = buildNetwork(seed);
  const network = networkAtForecastQuantile(raw, buildGrowthForecast(raw));
  for (const scenario of ['normal','hot','highEV']) {
    const actions = Object.fromEntries(network.transformers.map((t,i) => [t.id,['none','upgrade','rebalance','mobile'][i%4]]));
    const original = JSON.stringify(network), originalActions = JSON.stringify(actions);
    const plan = createProtectPlan(network, scenario, actions);
    same(plan, createProtectPlan(network, scenario, actions));
    same(plan.before, network);
    assert.equal(plan.capexInr, evaluatePlan(network, scenario, actions).capexInr);
    const expected = evaluatePlan(network, scenario, actions), actual = evaluatePlan(plan.after, scenario, {});
    assert.equal(actual.lossOfLifeHours, expected.lossOfLifeHours);
    assert.equal(actual.overloadHours, expected.overloadHours);
    for (const t of network.transformers) {
      const after = plan.after.transformers.find(x=>x.id===t.id);
      same(after, applyAction(t, actions[t.id]));
      assert.equal(after.unsanctioned, t.unsanctioned);
      same(evSessions(after,scenario,seed),evSessions(t,scenario,seed));
      const beforeRun = runProtect(plan.before,scenario,t.id,seed);
      const afterRun = runProtect(plan.after,scenario,t.id,seed);
      const independentlyApplied = {...network,transformers:network.transformers.map(x=>applyAction(x,actions[x.id]))};
      same(afterRun,runProtect(independentlyApplied,scenario,t.id,seed));
      assert.equal(afterRun.sessions,beforeRun.sessions);
      assert.ok(afterRun.onTimeShare>=0.95);
      assert.ok(afterRun.unmanaged.lolHours<=beforeRun.unmanaged.lolHours+1e-9);
      if (actions[t.id]==='none') same(afterRun,beforeRun);
      cases++;
    }
    assert.equal(JSON.stringify(network),original);
    assert.equal(JSON.stringify(actions),originalActions);
    plan.actions['T-01']='mobile'; plan.after.transformers[0].rating=999;
    plan.after.edges[0][0]='changed';
    assert.equal(JSON.stringify(network),original);
    same(plan.before,network);
    // Real optimiser output, including a no-action zero-budget plan.
    for (const capexInr of [0,1000000]) {
      const result=runPlan(network,scenario,{capexInr,upgrades:8,mobileUnits:3},seed,20,20);
      for (const p of Object.values(result.profiles)) {
        const handoff=createProtectPlan(network,scenario,p.actions);
        assert.equal(handoff.capexInr,p.capexInr);
        if(!capexInr) same(handoff.after,handoff.before);
      }
    }
  }
}
const network=buildNetwork(42), actions=Object.fromEntries(network.transformers.map(t=>[t.id,'none']));
for(const invalid of [null,{}, {...actions,unknown:'none'}, {...actions,'T-01':'invalid'}])
 assert.throws(()=>createProtectPlan(network,'hot',invalid),/valid action/);
assert.throws(()=>createProtectPlan(network,'unknown',actions),/scenario/);
console.log(`PASS: ${cases} Plan-to-Protect transformer cases; every action/scenario; exact once-only application; same p90 demand/EV sessions; no mutation; snapshots; zero-budget and optimiser profiles; invalid-input rejection.`);
