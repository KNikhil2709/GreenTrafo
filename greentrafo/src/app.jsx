const { useState, useMemo, useEffect, useRef } = React;

// ---------- helpers ----------
const fmtL = (inr) => (inr / 1e5).toFixed(1) + "L";
const BAND_COLOR = { ok: "var(--ok)", watch: "var(--watch)", high: "var(--high)", critical: "var(--critical)" };
const BAND_LABEL = { ok: "Below 80%", watch: "80–90%", high: "90–100%", critical: "Overloaded" };
const SCEN_KEYS = ["normal", "hot", "highEV"];

// ---------- feeder map ----------
const RISK_HEX = { ok: "#2ECC71", watch: "#F2C12E", high: "#F28C28", critical: "#E24C4C" };
function FeederMap({ network, perT, selected, onSelect, mode, hotSpotById, showEdges = true, showLabels = true }) {
  const W = 820, H = 70 + Math.ceil(network.transformers.length / 5) * 78 + 24;
  const colorOf = (t) => {
    if (mode === "thermal" && hotSpotById) {
      const hs = hotSpotById[t.id];
      return hs == null ? "#3A4D42" : hs > 110 ? RISK_HEX.critical : hs > 98 ? RISK_HEX.high : hs > 85 ? RISK_HEX.watch : RISK_HEX.ok;
    }
    const info = perT ? perT[t.id] : null;
    return info ? RISK_HEX[info.band] : "#3A4D42";
  };
  return (
    <svg className="feeder" viewBox={`0 0 ${W} ${H}`} role="img"
         aria-label="Synthetic distribution feeder; transformers glow by risk">
      <defs>
        <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {showEdges && network.edges.map(([a, b], i) => {
        const ta = network.transformers.find(t => t.id === a);
        const tb = network.transformers.find(t => t.id === b);
        if (!ta || !tb) return null;
        // edge tinted by the worse of its two endpoints
        const ca = colorOf(ta), cb = colorOf(tb);
        return <line key={i} x1={ta.x} y1={ta.y} x2={tb.x} y2={tb.y}
                     stroke={ca === RISK_HEX.critical || cb === RISK_HEX.critical ? "rgba(226,76,76,0.35)" : "rgba(175,203,183,0.18)"}
                     strokeWidth="2" />;
      })}
      {/* substation */}
      <g>
        <rect x={network.transformers[0].x - 36} y={network.transformers[0].y - 50} width="72" height="22" rx="6"
              fill="#0D2619" stroke="rgba(61,205,88,0.4)" />
        <text x={network.transformers[0].x} y={network.transformers[0].y - 35} textAnchor="middle"
              fontSize="10.5" fill="var(--green-br)" fontWeight="600">Substation</text>
      </g>
      {network.transformers.map(t => {
        const info = perT ? perT[t.id] : null;
        const fill = colorOf(t);
        const sel = selected === t.id;
        const act = info && info.action && info.action !== "none";
        const glow = sel || fill === RISK_HEX.critical;
        return (
          <g key={t.id} onClick={() => onSelect && onSelect(t.id)} style={{ cursor: onSelect ? "pointer" : "default" }}
             filter={glow ? "url(#glow)" : undefined}>
            <circle cx={t.x} cy={t.y} r={sel ? 13 : 10} fill={fill}
                    stroke={sel ? "#fff" : "rgba(255,255,255,0.25)"} strokeWidth={sel ? 2.5 : 1.5} />
            {act && <circle cx={t.x + 9} cy={t.y - 9} r="4.5" fill="var(--green-br)" stroke="#04120C" strokeWidth="1.5" />}
            {showLabels && <text x={t.x} y={t.y + 25} textAnchor="middle" fontSize="9.5" fill="var(--ink-3)">{t.id}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function MapLegend({ mode }) {
  const items = mode === "thermal"
    ? [[RISK_HEX.ok, "Cool"], [RISK_HEX.watch, "Warm"], [RISK_HEX.high, "Near limit"], [RISK_HEX.critical, "Over 110°C"]]
    : [[RISK_HEX.ok, "Below 80%"], [RISK_HEX.watch, "80–90%"], [RISK_HEX.high, "90–100%"], [RISK_HEX.critical, "Overloaded"]];
  return (
    <div className="maplegend">
      {items.map(([c, l]) => <div className="row" key={l}><i style={{ background: c }} />{l}</div>)}
      <div className="row"><svg width="13" height="13"><circle cx="6.5" cy="6.5" r="4.5" fill="var(--green-br)" stroke="#04120C" strokeWidth="1.5" /></svg>Action applied</div>
    </div>
  );
}

// ---------- Pareto scatter (hand-rolled SVG) ----------
function ParetoChart({ pareto, selIdx, onPick, baseline }) {
  const W = 356, H = 210, pad = 40;
  const xs = pareto.map(p => p.capexInr / 1e5);
  const ys = pareto.map(p => p.lossOfLifeHours);
  const allX = xs.concat([baseline.capexInr / 1e5]);
  const allY = ys.concat([baseline.lossOfLifeHours]);
  const xmin = Math.min(...allX), xmax = Math.max(...allX);
  const ymin = Math.min(...allY), ymax = Math.max(...allY);
  const X = v => pad + (v - xmin) / ((xmax - xmin) || 1) * (W - pad - 14);
  const Y = v => (H - pad) - (v - ymin) / ((ymax - ymin) || 1) * (H - pad - 14);
  const ol = pareto.map(p => p.overloadHours);
  const omax = Math.max(...ol, 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img"
         aria-label="Pareto front: capex versus loss of life">
      <defs><filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="2.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter></defs>
      <line x1={pad} y1={H - pad} x2={W - 8} y2={H - pad} stroke="rgba(255,255,255,0.12)" />
      <line x1={pad} y1="10" x2={pad} y2={H - pad} stroke="rgba(255,255,255,0.12)" />
      <text x={(W + pad) / 2} y={H - 6} textAnchor="middle" fontSize="10.5" fill="var(--ink-3)">Capex (₹ lakh)</text>
      <text x="12" y={(H - pad) / 2} textAnchor="middle" fontSize="10.5" fill="var(--ink-3)"
            transform={`rotate(-90 12 ${(H - pad) / 2})`}>Loss of life (h)</text>
      {/* baseline marker */}
      <g>
        <rect x={X(baseline.capexInr / 1e5) - 5} y={Y(baseline.lossOfLifeHours) - 5} width="10" height="10"
              transform={`rotate(45 ${X(baseline.capexInr / 1e5)} ${Y(baseline.lossOfLifeHours)})`}
              fillOpacity="0" stroke="#9AA7A0" strokeWidth="1.5" />
        <text x={X(baseline.capexInr / 1e5)} y={Y(baseline.lossOfLifeHours) - 9} textAnchor="middle"
              fontSize="9.5" fill="#9AA7A0">baseline</text>
      </g>
      {pareto.map((p, i) => {
        const r = 3 + 5 * (p.overloadHours / omax);
        const sel = i === selIdx;
        return <circle key={i} cx={X(p.capexInr / 1e5)} cy={Y(p.lossOfLifeHours)} r={sel ? r + 2 : r}
                       fill={sel ? "#5FE07A" : "var(--green)"} fillOpacity={sel ? 1 : 0.5}
                       stroke={sel ? "#fff" : "rgba(255,255,255,0.3)"} strokeWidth={sel ? 2 : 1}
                       filter={sel ? "url(#glow)" : undefined}
                       style={{ cursor: "pointer" }} onClick={() => onPick(i)} />;
      })}
    </svg>
  );
}

// ---------- line chart for temperature / loading ----------
function LineChart({ series, limit, ambient, ylabel, markers }) {
  const W = 356, H = 190, pad = 34;
  const n = series[0].data.length;
  const all = series.flatMap(s => s.data).concat(ambient || []).concat(limit ? [limit] : []);
  const ymin = Math.min(...all), ymax = Math.max(...all);
  const X = i => pad + i / (n - 1) * (W - pad - 10);
  const Y = v => (H - pad) - (v - ymin) / ((ymax - ymin) || 1) * (H - pad - 12);
  const path = (data) => data.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
  const hours = [0, 6, 12, 18, 24];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label={ylabel}>
      <defs><filter id="lglow" x="-10%" y="-40%" width="120%" height="180%">
        <feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter></defs>
      {/* evening peak window shading (drawn first, behind) */}
      <rect x={X(18 / 24 * (n - 1))} y="8" width={X(22 / 24 * (n - 1)) - X(18 / 24 * (n - 1))} height={H - pad - 8}
            fill="#F2C12E" fillOpacity="0.09" />
      <line x1={pad} y1={H - pad} x2={W - 6} y2={H - pad} stroke="rgba(255,255,255,0.12)" />
      <line x1={pad} y1="8" x2={pad} y2={H - pad} stroke="rgba(255,255,255,0.12)" />
      {hours.map(h => <text key={h} x={X(h / 24 * (n - 1))} y={H - pad + 13} textAnchor="middle" fontSize="9.5" fill="var(--ink-3)">{h}:00</text>)}
      <text x="10" y={(H - pad) / 2} textAnchor="middle" fontSize="10" fill="var(--ink-3)"
            transform={`rotate(-90 10 ${(H - pad) / 2})`}>{ylabel}</text>
      {limit != null && <>
        <line x1={pad} y1={Y(limit)} x2={W - 6} y2={Y(limit)} stroke="#E24C4C" strokeWidth="1.2" strokeDasharray="4 3" />
        <text x={W - 8} y={Y(limit) - 4} textAnchor="end" fontSize="9.5" fill="#E24C4C">limit {limit}°C</text>
      </>}
      {ambient && <path d={path(ambient)} fill="none" stroke="rgba(175,203,183,0.4)" strokeWidth="1.3" strokeDasharray="3 3" />}
      {series.map((s, i) => <path key={i} d={path(s.data)} fill="none" stroke={s.color} strokeWidth="2.4" filter="url(#lglow)" />)}
    </svg>
  );
}

// ---------- convergence ----------
function Convergence({ history }) {
  const W = 356, H = 120, pad = 30;
  const ys = history.map(h => h.quality);
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const X = i => pad + i / (history.length - 1) * (W - pad - 8);
  const Y = v => (H - pad) - (v - ymin) / ((ymax - ymin) || 1) * (H - pad - 8);
  const d = history.map((h, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(h.quality).toFixed(1)).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Optimiser convergence">
      <line x1={pad} y1={H - pad} x2={W - 6} y2={H - pad} stroke="rgba(255,255,255,0.12)" />
      <path d={d} fill="none" stroke="var(--green-br)" strokeWidth="2.2" />
      <text x={(W + pad) / 2} y={H - 6} textAnchor="middle" fontSize="9.5" fill="var(--ink-3)">Generation</text>
    </svg>
  );
}

// ---------- green strip ----------
function GreenStrip({ green, extra }) {
  const Item = ({ n, u, lab, tip }) => (
    <div>
      <div className="lab">{lab}</div>
      <div className="gstat"><span className="n">{n}</span><span className="u">{u}</span>
        <span className="info" title={tip}>?</span></div>
    </div>
  );
  return (
    <div className="greenstrip"><div className="wrap">
      <Item n={green.avoidedReplacements} u="transformers" lab="Green impact · replacements avoided"
            tip={`Units whose loss-of-life stays below the end-of-life threshold (${green.EOL} h/day, assumed) under the plan but not the baseline.`} />
      <Item n={green.dieselHoursAvoided.toFixed(1)} u="hours" lab="Diesel generator hours avoided"
            tip={`Overload hours prevented × assumed ${Math.round(green.dieselShare * 100)}% served by diesel.`} />
      {extra && <Item n={extra.kwh} u="kWh/evening" lab="Peak energy shifted to greener hours"
            tip="Flexible EV and AC load moved out of the 18:00–22:00 evening peak." />}
    </div></div>
  );
}

// ---------- Plan tab ----------
function PlanTab({ network, scenario, setScenario }) {
  const [budget, setBudget] = useState({ upgrades: 8, mobileUnits: 3 });
  const [result, setResult] = useState(null);
  const [profile, setProfile] = useState("balanced");
  const [selIdx, setSelIdx] = useState(null);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(null);

  const preview = useMemo(() => evaluatePlan(network, scenario, {}), [network, scenario]);

  function run(warm) {
    setBusy(true);
    setTimeout(() => {
      clearSimCache();
      const r = runPlan(network, scenario, budget, network.seed, 60, 40);
      setResult(r);
      const idx = r.pareto.indexOf(r.profiles.balanced);
      setProfile("balanced"); setSelIdx(idx >= 0 ? idx : 0);
      setBusy(false);
    }, 30);
  }

  const chosen = result && selIdx != null ? result.pareto[selIdx] : null;
  const perT = chosen ? chosen.perT : preview.perT;
  const green = useMemo(() => result ? greenOutcomes(network, scenario, chosen, result.baseline) : null,
    [result, chosen, network, scenario]);

  function pickProfile(key) {
    setProfile(key);
    const p = result.profiles[key];
    setSelIdx(result.pareto.indexOf(p));
  }

  // reason for the hovered transformer's action
  const reason = hover && perT[hover] ? perT[hover] : null;

  const steps = [
    { label: "Load feeder", state: "done" },
    { label: "Set scenario & budget", state: "done" },
    { label: "Optimise plans", state: result ? "done" : "active" },
    { label: "Compare vs baseline", state: result ? "active" : "" },
  ];
  const delta = (plan, base) => { if (base === 0) return null; return Math.round((plan - base) / base * 100); };

  return (
    <>
      <StepStrip steps={steps} />
      {green && <GreenStrip green={green} />}
      <div className="wrap"><main><div className="grid">
        {/* LEFT: controls */}
        <div className="railL">
          <div className="card">
            <h2>Plan before summer</h2>
            <div className="sub">Spend a limited upgrade budget.</div>
            <div className="field">
              <label>Scenario</label>
              <div className="seg wrap2">
                {SCEN_KEYS.map(k => <button key={k} aria-pressed={scenario === k}
                  onClick={() => { setScenario(k); setResult(null); }}>{SCENARIOS[k].label}</button>)}
              </div>
            </div>
            <div className="field">
              <label>Upgrades <span className="v">{budget.upgrades}</span></label>
              <input type="range" min="0" max="16" value={budget.upgrades}
                onChange={e => setBudget({ ...budget, upgrades: +e.target.value })} />
            </div>
            <div className="field">
              <label>Mobile units <span className="v">{budget.mobileUnits}</span></label>
              <input type="range" min="0" max="8" value={budget.mobileUnits}
                onChange={e => setBudget({ ...budget, mobileUnits: +e.target.value })} />
            </div>
            <button className="btn" disabled={busy} onClick={() => run(false)}>
              {busy ? "Optimising…" : result ? "Re-optimise plans" : "Run optimiser"}</button>
            {result && <div className="hint" style={{ marginTop: 10 }}>
              Pareto front of {result.pareto.length} plans. Point size = overload hours.</div>}
          </div>
          {result && <div className="card" style={{ marginTop: 14 }}>
            <h2>Optimiser convergence</h2>
            <div className="sub">Pareto quality over generations.</div>
            <Convergence history={result.history} />
          </div>}
        </div>

        {/* CENTER: map */}
        <div className="card mapcard">
          <div className="maphead">
            <div>
              <h2>Distribution feeder</h2>
              <div className="sub">{network.transformers.length} transformers · {SCENARIOS[scenario].label} · tap a node for its reason</div>
            </div>
            <span className="simbadge">Simulated data</span>
          </div>
          <FeederMap network={network} perT={perT} selected={hover} onSelect={setHover} mode="risk" />
          <MapLegend mode="risk" />
          {reason && <div className="maptoggles" style={{ left: "auto", right: 14, top: "auto", bottom: 14, maxWidth: 220 }}>
            {reason.action !== "none"
              ? <span><b style={{ color: "#fff" }}>{hover} · {reason.action}</b><br />peak {(reason.peakLoading * 100).toFixed(0)}%, hot-spot {reason.peakHotSpot.toFixed(0)}°C if untouched</span>
              : <span><b style={{ color: "#fff" }}>{hover}</b><br />no action needed · peak {(reason.peakLoading * 100).toFixed(0)}%</span>}
          </div>}
        </div>

        {/* RIGHT: result cards */}
        <div className="railR">
          {!result && <div className="card"><h2>Route plans</h2>
            <div className="sub">Run the optimiser to see the Pareto-optimal plans, scored against the 80% / 90% baseline.</div>
            <div className="hint">Each plan trades capex against overload hours and transformer loss-of-life.</div>
          </div>}
          {result && <>
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <h2>Plan options</h2><span className="ribbon">{result.pareto.length} Pareto-optimal</span>
              </div>
              <div className="sub">NSGA-II · {result.pareto.length} plans · deltas vs the 80/90 baseline.</div>
              <ParetoChart pareto={result.pareto} selIdx={selIdx} onPick={setSelIdx} baseline={result.baseline} />
            </div>
            {[["lowestCost", "Lowest cost"], ["balanced", "Balanced"], ["mostReliable", "Most reliable"]].map(([k, l]) => {
              const p = result.profiles[k]; const b = result.baseline;
              const dc = delta(p.capexInr, b.capexInr), dl = delta(p.lossOfLifeHours, b.lossOfLifeHours), dov = delta(p.overloadHours, b.overloadHours);
              const D = (v) => v == null ? null : <span className={"d " + (v <= 0 ? "pos" : "neg")}>{v > 0 ? "+" : ""}{v}%</span>;
              return (
                <div key={k} className="rc" aria-pressed={profile === k} onClick={() => pickProfile(k)}>
                  <div className="rh"><span className="nm">{l}</span>
                    {k === "lowestCost" && p.capexInr === result.profiles.balanced.capexInr && <span className="pr">cheapest option</span>}</div>
                  <div className="rg">
                    <div className="cell"><div className="cl">Capex</div><div className="cv">{fmtL(p.capexInr)} {D(dc)}</div></div>
                    <div className="cell"><div className="cl">Loss of life</div><div className="cv">{p.lossOfLifeHours.toFixed(1)}h {D(dl)}</div></div>
                    <div className="cell"><div className="cl">Overload</div><div className="cv">{p.overloadHours.toFixed(0)}h {D(dov)}</div></div>
                    <div className="cell"><div className="cl">Actions</div><div className="cv">{Object.values(p.perT).filter(x => x.action !== "none").length}</div></div>
                  </div>
                </div>
              );
            })}
            <div className="card" style={{ marginTop: 2 }}>
              <h2>This plan vs the 80% / 90% rule</h2>
              <div className="sub">Compared at each policy's own cost.</div>
              <CompareBars plan={chosen} base={result.baseline} />
            </div>
          </>}
        </div>
      </div></main></div>
    </>
  );
}

function CompareBars({ plan, base }) {
  const rows = [
    ["Capex", plan.capexInr / 1e5, base.capexInr / 1e5, "₹L", 1],
    ["Loss of life", plan.lossOfLifeHours, base.lossOfLifeHours, "h", 1],
    ["Overload", plan.overloadHours, base.overloadHours, "h", 1],
  ];
  const fmt = (v, u) => u === "₹L" ? "₹" + v.toFixed(1) + "L" : v.toFixed(1) + " " + u;
  return (
    <div className="cmp">
      {rows.map(([lab, pv, bv, u]) => {
        const max = Math.max(pv, bv, 0.0001);
        return (
          <div key={lab} className="crow">
            <div className="cl"><span>{lab}</span><span className="tag">plan vs baseline</span></div>
            <div className="bar plan"><i style={{ width: (pv / max * 100) + "%" }} /></div>
            <div className="cl" style={{ margin: "3px 0" }}><span className="tag">this plan</span>
              <span style={{ fontWeight: 600 }}>{fmt(pv, u)}</span></div>
            <div className="bar base"><i style={{ width: (bv / max * 100) + "%" }} /></div>
            <div className="cl" style={{ margin: "3px 0 0" }}><span className="tag">80/90 rule</span>
              <span>{fmt(bv, u)}</span></div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Protect tab ----------
function ProtectTab({ network }) {
  const [scenario, setScenario] = useState("highEV");
  const risky = useMemo(() => {
    // rank transformers by how much their EVENING EV load pushes them toward the limit,
    // preferring ones where flexible load is the swing factor (base load alone stays under limit).
    return network.transformers
      .filter(t => t.evCount >= 2)
      .map(t => {
        const un = runProtect(network, scenario, t.id, network.seed);
        return { id: t.id, swing: un.overLimitUnmanaged, base: un.baseOverLimit };
      })
      .filter(x => x.swing > 0 && x.base < 0.6)   // EVs cause the breach, base load does not
      .sort((a, b) => b.swing - a.swing)
      .slice(0, 8).map(x => x.id);
  }, [network, scenario]);
  const [sel, setSel] = useState(risky[0]);
  const [managed, setManaged] = useState(true);
  const [step, setStep] = useState(72); // 18:00
  const playing = useRef(false);
  const [, force] = useState(0);

  useEffect(() => { if (!risky.includes(sel)) setSel(risky[0]); }, [risky]);

  const pr = useMemo(() => runProtect(network, scenario, sel, network.seed), [network, scenario, sel]);
  const hs = managed ? pr.managed.hotSpot : pr.unmanaged.hotSpot;

  function play() {
    if (playing.current) { playing.current = false; force(x => x + 1); return; }
    playing.current = true; force(x => x + 1);
    const tick = () => {
      if (!playing.current) return;
      setStep(s => { const n = s + 1; if (n >= 96) { playing.current = false; force(x => x + 1); return 95; } return n; });
      setTimeout(tick, 60);
    };
    tick();
  }

  const hotSpotNow = {};
  network.transformers.forEach(t => { hotSpotNow[t.id] = null; });
  hotSpotNow[sel] = hs[step];

  const hourLabel = (() => { const h = step * 0.25; const hh = Math.floor(h) % 24; const mm = Math.round((h % 1) * 60); return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0"); })();

  const steps = [
    { label: "Forecast the evening", state: "done" },
    { label: "Flag at-risk transformer", state: "done" },
    { label: "Schedule flexible load", state: managed ? "done" : "active" },
    { label: "Verify under limit", state: managed ? "active" : "" },
  ];

  return (
    <>
      <StepStrip steps={steps} />
      <GreenStrip
        green={{ avoidedReplacements: pr.overLimitManaged < pr.overLimitUnmanaged ? 1 : 0,
                 dieselHoursAvoided: Math.max(0, pr.overLimitUnmanaged - pr.overLimitManaged),
                 EOL: 1.6, dieselShare: 0.4 }}
        extra={{ kwh: pr.peakKwhShifted.toFixed(0) }} />
      <div className="wrap"><main><div className="grid">
        {/* LEFT: controls */}
        <div className="railL">
          <div className="card">
            <h2>Protect the evening</h2>
            <div className="sub">Shift flexible EV & AC load within the thermal limit.</div>
            <div className="field">
              <label>Scenario</label>
              <div className="seg wrap2">
                {SCEN_KEYS.map(k => <button key={k} aria-pressed={scenario === k} onClick={() => setScenario(k)}>{SCENARIOS[k].label}</button>)}
              </div>
            </div>
            <div className="field">
              <label>At-risk transformer</label>
              <div className="seg wrap2">
                {risky.slice(0, 4).map(id => <button key={id} aria-pressed={sel === id} onClick={() => setSel(id)}>{id}</button>)}
              </div>
            </div>
            <div className="field">
              <label>Control</label>
              <div className="seg">
                <button aria-pressed={!managed} onClick={() => setManaged(false)}>Unmanaged</button>
                <button aria-pressed={managed} onClick={() => setManaged(true)}>Managed</button>
              </div>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Evening replay</label>
              <div className="slider-row">
                <button className="playbtn" onClick={play}>{playing.current ? "❚❚" : "▶"}</button>
                <input type="range" min="0" max="95" value={step} onChange={e => setStep(+e.target.value)} />
                <span className="clock">{hourLabel}</span>
              </div>
            </div>
          </div>
          <div className="card" style={{ marginTop: 14 }}>
            <h2>Why it works</h2>
            <div className="hint">{sel} has {pr.sessions} EV sessions tonight. Managed charging fills the cool
              early-morning hours and trims AC in the hottest window, so every vehicle still finishes by its
              departure time while the transformer stays under its thermal limit.</div>
          </div>
        </div>

        {/* CENTER: map */}
        <div className="card mapcard">
          <div className="maphead">
            <div>
              <h2>Peak-evening thermal state</h2>
              <div className="sub">{SCENARIOS[scenario].label} · {sel} selected · {hourLabel}</div>
            </div>
            <span className="simbadge">Simulated data</span>
          </div>
          <FeederMap network={network} perT={null} selected={sel} onSelect={id => { if (risky.includes(id)) setSel(id); }}
                     mode="thermal" hotSpotById={hotSpotNow} />
          <MapLegend mode="thermal" />
        </div>

        {/* RIGHT: temperature + metrics */}
        <div className="railR">
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <h2>Hot-spot temperature tonight</h2>
              <span className="ribbon" style={{ color: managed ? "var(--green-br)" : "var(--neg)", borderColor: managed ? "var(--line-2)" : "rgba(226,76,76,0.4)", background: managed ? "rgba(61,205,88,0.1)" : "rgba(226,76,76,0.1)" }}>{managed ? "Managed" : "Unmanaged"}</span>
            </div>
            <div className="sub">Dashed line is ambient. Shaded band is the evening peak.</div>
            <LineChart ylabel="°C" limit={110} ambient={pr.ambient}
              series={[{ data: hs, color: managed ? "#5FE07A" : "#E24C4C" }]} />
          </div>
          <div className="metric-grid">
            <div className={"mstat " + (managed ? "good" : "bad")}>
              <div className="n">{(managed ? pr.overLimitManaged : pr.overLimitUnmanaged).toFixed(1)} h</div>
              <div className="l">Time over 110°C limit</div></div>
            <div className="mstat good">
              <div className="n">{Math.round(pr.onTimeShare * 100)}%</div>
              <div className="l">EV sessions on time</div></div>
            <div className="mstat good">
              <div className="n">{pr.lolSaved.toFixed(1)} h</div>
              <div className="l">Loss of life saved</div></div>
            <div className="mstat good">
              <div className="n">{pr.peakKwhShifted.toFixed(0)}</div>
              <div className="l">kWh shifted off peak</div></div>
          </div>
        </div>
      </div></main></div>
    </>
  );
}

// ---------- Method tab ----------
function MethodTab() {
  return (
    <div className="wrap"><main><div className="card prose">
      <h2>What GreenTrafo does</h2>
      <p>GreenTrafo treats each distribution transformer's thermal life as a budget, and helps a DISCOM spend it
        before summer (Plan) and protect it during peak evenings (Protect). The goal is a greener, more reliable
        grid: fewer premature transformer failures, fewer diesel-backed outages, and more headroom for rooftop
        solar and EV charging.</p>

      <h2>Why this is a green problem</h2>
      <p>A 2026 CEA advisory says most summer load shedding comes from the distribution network, not generation, and
        that it is largely avoidable if vulnerable assets are found at least six months ahead. Keeping transformers
        alive longer avoids the embodied carbon of replacement units, avoids diesel-generator hours during outages,
        and lets neighbourhoods host more green generation and EVs.</p>

      <h2>How the numbers are produced</h2>
      <ul>
        <li><b>Feeder and loads</b> are generated from a seed: about 40 transformers, with evening air-conditioning
          peaks, EV sessions, and hidden (unsanctioned) load growth.</li>
        <li><b>Thermal model</b> is a discrete form of the IEEE C57.91 top-oil and hot-spot equations, giving an
          ageing acceleration factor and loss-of-life per transformer.</li>
        <li><b>Plan</b> searches action plans (upgrade, rebalance, mobile unit) with a multi-objective evolutionary
          optimiser, trading capex against overload hours and loss-of-life, and returns a Pareto front.</li>
        <li><b>Protect</b> schedules flexible EV and AC load for one evening so the hot-spot stays within limit while
          every EV still finishes by its departure time.</li>
      </ul>

      <h2>Assumptions and honest limits</h2>
      <table>
        <tr><th>Item</th><th>In this demo</th></tr>
        <tr><td>Data</td><td>All synthetic and seeded. No real DISCOM data is used.</td></tr>
        <tr><td>Hot-spot temperature</td><td>Estimated from load with the thermal model, not measured.</td></tr>
        <tr><td>Thermal constants</td><td>Typical IEEE C57.91 values; absolute loss-of-life is approximate, so compare against the baseline rather than reading absolute lifetimes.</td></tr>
        <tr><td>Power flow</td><td>A lightweight load approximation, not full unbalanced power flow. The real system uses pandapower / OpenDSS.</td></tr>
        <tr><td>Control path</td><td>Protect is a proposed demand-response design; no live signal to chargers exists today.</td></tr>
        <tr><td>Green figures</td><td>Diesel share and end-of-life threshold are assumed parameters, shown on each figure.</td></tr>
      </table>

      <div className="callout">GreenTrafo complements Schneider's ADMS, DERMS and EVlink at the neighbourhood-transformer
        level. It does not duplicate outage restoration, crew dispatch or building-side load management, which those
        products already provide.</div>
    </div></main></div>
  );
}

// ---------- step progress strip ----------
function StepStrip({ steps }) {
  return (
    <div className="steps"><div className="wrap">
      {steps.map((s, i) => (
        <div key={i} className={"step " + s.state}>
          <span className="idx">{s.state === "done" ? "✓" : i + 1}</span>{s.label}
        </div>
      ))}
    </div></div>
  );
}

// ---------- dark cinematic hero ----------
function Particles() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    let raf, W, H, pts;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function resize() {
      W = c.width = c.offsetWidth * devicePixelRatio;
      H = c.height = c.offsetHeight * devicePixelRatio;
      const n = Math.min(90, Math.floor(c.offsetWidth / 16));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.12 * devicePixelRatio,
        vy: (Math.random() - 0.5) * 0.12 * devicePixelRatio,
        r: (Math.random() * 1.6 + 0.4) * devicePixelRatio,
        a: Math.random() * 0.5 + 0.2,
      }));
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7);
        ctx.fillStyle = `rgba(61,205,88,${p.a})`; ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    }
    resize(); window.addEventListener("resize", resize);
    if (reduce) { draw(); cancelAnimationFrame(raf); } else draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="particles" aria-hidden="true" />;
}

function Hero({ onStart }) {
  const stats = [["40", "Transformers"], ["39", "Feeder links"], ["3", "Scenarios"], ["3", "Objectives"]];
  return (
    <section className="hero">
      <Particles />
      <div className="vignette" />
      <div className="hnav">
        <div className="logo"><span className="leaf">G</span><b>Green</b><span>Trafo</span></div>
        <div className="pill"><span className="dot" />Simulated grid · live demo</div>
      </div>
      <div className="hbody">
        <div className="wordmark">
          <div className="big">G</div>
          <h1>Green<i>Trafo</i></h1>
        </div>
        <div className="tagline">Keep the grid on by making every transformer <em>last longer</em></div>
        <p className="sub">GreenTrafo treats each distribution transformer's thermal life as a budget — spending it
          wisely before summer, and protecting it through peak evenings, for a greener, more reliable grid.</p>
        <div className="stats">
          {stats.map(([n, l]) => <div className="st" key={l}><div className="n">{n}</div><div className="l">{l}</div></div>)}
        </div>
        <div className="ctas">
          <button className="cta primary" onClick={onStart}>Start planning
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12l7 7 7-7" stroke="#04120C" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button className="cta ghost" onClick={() => { const el = document.getElementById("method-anchor"); onStart("method"); }}>How it works</button>
        </div>
      </div>
      <div className="scrollcue" onClick={onStart} style={{ cursor: "pointer" }}>
        <span className="chev" />Scroll to optimise
      </div>
    </section>
  );
}

// ---------- shell ----------
function App() {
  const [tab, setTab] = useState("plan");
  const [scenario, setScenario] = useState("hot");
  const network = useMemo(() => buildNetwork(42, 40), []);
  const appRef = useRef(null);

  function start(which) {
    if (which === "method") setTab("method");
    requestAnimationFrame(() => {
      const el = document.getElementById("app-root");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <>
      <Hero onStart={start} />
      <div id="app-root" ref={appRef}>
      <header className="top"><div className="wrap"><div className="brand">
        <div className="mark">G</div>
        <div>
          <h1>GreenTrafo</h1>
          <div className="tag">Green thermal-life budgeting for grid reliability</div>
        </div>
        <div className="right">Yuva Yodha 2026 · Grid Reliability<br /><b>Greener grid, longer-lived transformers</b></div>
      </div></div></header>
      <nav className="tabs"><div className="wrap">
        <button aria-selected={tab === "plan"} onClick={() => setTab("plan")}>Plan</button>
        <button aria-selected={tab === "protect"} onClick={() => setTab("protect")}>Protect</button>
        <button aria-selected={tab === "method"} onClick={() => setTab("method")}>Method &amp; limits</button>
      </div></nav>
      {tab === "plan" && <PlanTab network={network} scenario={scenario} setScenario={setScenario} />}
      {tab === "protect" && <ProtectTab network={network} />}
      {tab === "method" && <MethodTab />}
      <footer>GreenTrafo · simulated prototype · built for the Schneider Electric Yuva Yodha Energy Tech Hackathon 2026</footer>
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
