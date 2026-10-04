const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const api=vm.runInNewContext(html.match(/<script>\n([\s\S]*?)\n<\/script>/)[1]+'\n({buildNetwork,runProtect})');
const {buildNetwork,runProtect}=api;
const near=(a,b,msg)=>assert.ok(Math.abs(a-b)<1e-7,`${msg}: ${a} != ${b}`);
function audit(p){
 for(const mode of ['unmanaged','managed','tou']){
  const total=Array(144).fill(0);let delivered=0,unmet=0,onTime=0;
  for(const s of p.sessionReports){
   assert.equal(s[mode].kw.length,144);let energy=0;
   for(let i=0;i<144;i++){
    const lo=mode==='tou'?22:0,hi=mode==='tou'?30:36;
    const duration=Math.max(0,Math.min((i+1)/4,s.depart,hi)-Math.max(i/4,s.arrive,lo));
    const kw=s[mode].kw[i];assert.ok(Number.isFinite(kw)&&kw>=0);
    assert.ok(kw/4<=s.maxKw*duration+1e-8,`${mode} ${s.id} slot ${i} exceeds power/window capacity`);
    energy+=kw/4;total[i]+=kw;
   }
   assert.ok(energy<=s.energy+1e-8);near(energy,s[mode].deliveredKwh,'delivered');
   near(s.energy-energy,s[mode].unmetKwh,'unmet');
   assert.equal(s[mode].onTime,s.energy-energy<=1e-6);
   delivered+=energy;unmet+=s.energy-energy;onTime+=s[mode].onTime?1:0;
  }
  total.forEach((v,i)=>near(v,p[mode+'Kw'][i],'aggregate'));
  near(delivered,p.energy[mode].deliveredKwh,'total delivered');near(unmet,p.energy[mode].unmetKwh,'total unmet');
  near(onTime/(p.sessions||1),p.sessions?p.energy[mode].onTimeShare:0,'on-time share');
  // Independent first-order oil update across all slots, especially index 96.
  const sim=p[mode];let oil=55*Math.pow(sim.loadingPU[0]**2,.8);
  for(let i=0;i<144;i++){
   const k=Math.max(.02,sim.loadingPU[i]);oil+=(55*Math.pow(k*k,.8)-oil)/12;
   near(sim.topOil[i],p.ambient[i]+oil,'chronological oil');
   near(sim.hotSpot[i],p.ambient[i]+oil+25*Math.pow(k*k,.8),'hot spot');
  }
 }
}
let count=0;
for(const seed of [1,42,2026]){
 const net=buildNetwork(seed);
 for(const scenario of ['normal','hot','highEV'])for(const t of net.transformers){
  const p=runProtect(net,scenario,t.id,seed);audit(p);count++;
  assert.ok(p.sessionReports.every(s=>s.depart>=30));
  assert.ok(p.managedKw.slice(0,68).every(v=>v===0),'no next-day charging before today arrival');
 }
}
const net=buildNetwork(42),id=net.transformers[0].id;
const cases=[
 [{id:'partial',arrive:17.1,depart:17.2,energy:1,maxKw:7}],
 [{id:'deadline',arrive:20.8,depart:21.05,energy:4,maxKw:3.3}],
 [{id:'overnight',arrive:23.9,depart:24.1,energy:1,maxKw:7}],
 [{id:'zero',arrive:17,depart:30,energy:0,maxKw:3.3}],
 [{id:'impossible',arrive:17,depart:18,energy:100,maxKw:3.3}],
 Array.from({length:20},(_,i)=>({id:'crowded'+i,arrive:18.05,depart:19.15,energy:14,maxKw:7})),
 [],
];
for(const sessions of cases){
 const before=JSON.stringify(sessions);const p=runProtect(net,'hot',id,42,{sessions});audit(p);
 assert.equal(JSON.stringify(sessions),before);
 assert.equal(JSON.stringify(p),JSON.stringify(runProtect(net,'hot',id,42,{sessions})));
}
const partial=runProtect(net,'normal',id,42,{sessions:cases[0]});
near(partial.energy.unmanaged.deliveredKwh,.7,'partial physical energy');
near(partial.energy.tou.deliveredKwh,0,'no out-of-window ToU fallback');
const impossible=runProtect(net,'hot',id,42,{sessions:cases[4]});
assert.equal(impossible.onTimeShare,0);assert.ok(impossible.energy.managed.unmetKwh>90);
// Elevated load forces multiple cap passes; limits still hold and unmet demand is explicit.
const stressed={...net,transformers:net.transformers.map(t=>({...t,peakFactor:2}))};
audit(runProtect(stressed,'hot',id,42,{sessions:cases[5]}));
for(const session of [
 {id:'bad',arrive:17,depart:16,energy:1,maxKw:7},
 {id:'bad',arrive:17,depart:37,energy:1,maxKw:7},
 {id:'bad',arrive:17,depart:30,energy:-1,maxKw:7},
 {id:'bad',arrive:17,depart:30,energy:1,maxKw:0},
])assert.throws(()=>runProtect(net,'hot',id,42,{sessions:[session]}),/Invalid Protect session/);
console.log(`PASS: ${count} overnight schedules audited per session/slot; exact fractional windows; power/energy limits; chronological oil recurrence; strict ToU; impossible demand; multiple cap passes; no mutation; determinism.`);
