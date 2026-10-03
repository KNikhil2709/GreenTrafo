// GreenTrafo simulation engine (browser, lightweight).
// NOT real power flow. A transparent approximation of the PRD's engine:
// seeded synthetic feeder + load shapes + a discrete IEEE C57.91 thermal model.
// Every number is reproducible from a seed. All data is simulated.

// ---- seeded RNG (mulberry32) ----
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r, mu, sd) {
  const u = Math.max(1e-9, r()), v = r();
  return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---- constants (assumed IEEE C57.91 typical values, see Method tab) ----
const RATINGS = [100, 200, 250];           // kVA
const TOP_OIL_RISE_RATED = 55;             // deg C at rated load
const HOT_SPOT_RISE_RATED = 25;            // deg C gradient at rated load
const TAU_OIL_H = 3.0;                      // oil time constant (hours)
const N_EXP = 0.8, M_EXP = 0.8;             // oil / winding exponents
const HOT_SPOT_LIMIT = 110;                // deg C, thermal limit
const STEP_H = 0.25;                        // 15-minute steps
const DAY_STEPS = 96;

// upgrade cost per rating (INR, placeholder config values)
const UPGRADE_COST = { 100: 180000, 200: 240000, 250: 300000 };
const MOBILE_COST = 120000;

// ---- feeder ----
export function buildNetwork(seed, n = 40) {
  const r = rng(seed * 2654435761);
  const transformers = [];
  // radial layout: trunk down the middle, laterals left/right
  const perRow = 5;
  for (let i = 0; i < n; i++) {
    const rating = RATINGS[Math.floor(r() * RATINGS.length)];
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const peakFactor = 0.62 + r() * 0.55;   // base peak as fraction of rating
    const acShare = 0.3 + r() * 0.5;
    const evCount = Math.round((peakFactor - 0.4) * 6 + r() * 3);
    // These are synthetic versions of features a DISCOM could already hold.  They
    // drive latent growth, rather than exposing it as a direct forecast input.
    const neighbourhoodGrowth = 0.02 + r() * 0.10;
    const unsanctioned = clamp(
      0.025 + 0.10 * (peakFactor - 0.62) + 0.07 * (acShare - 0.30) +
      0.025 * (evCount / 6) + 0.25 * neighbourhoodGrowth + gauss(r, 0, 0.018),
      0.015, 0.30
    );
    transformers.push({
      id: "T-" + String(i + 1).padStart(2, "0"),
      rating,
      x: 90 + col * 150 + (r() - 0.5) * 24,
      y: 70 + row * 78 + (r() - 0.5) * 18,
      // intrinsic demand profile params
      peakFactor,
      acShare,                           // share of load that is cooling
      // more EVs on busier transformers, so risk and EV load correlate
      evCount,
      neighbourhoodGrowth,              // public synthetic growth proxy
      lastSummerPeak: peakFactor * (1 + unsanctioned) * (0.93 + r() * 0.10),
      unsanctioned,                     // synthetic truth; also anchors synthetic historical targets
      ageClass: r() < 0.3 ? "old" : r() < 0.7 ? "mid" : "new",
    });
  }
  // edges: trunk + lateral to each
  const edges = [];
  for (let row = 0; row * perRow < n; row++) {
    const a = transformers[row * perRow];
    const prev = transformers[(row - 1) * perRow];
    if (prev && a) edges.push([prev.id, a.id]);
    for (let col = 1; col < perRow; col++) {
      const idx = row * perRow + col;
      if (transformers[idx]) edges.push([transformers[idx - 1].id, transformers[idx].id]);
    }
  }
  return { seed, transformers, edges };
}

// ---- latent-load-growth forecasting ----
// A small, deterministic quantile-regression model is trained on synthetic historic
// observations.  It deliberately uses only planning features, never `unsanctioned`
// as a direct feature. Synthetic historical targets below share this latent truth,
// so the reported coverage is not an independent out-of-sample accuracy estimate.
function growthFeatures(t) {
  return [t.lastSummerPeak, t.acShare, t.evCount / 8, t.neighbourhoodGrowth];
}

function fitQuantileRegression(rows, quantile) {
  const width = rows[0].x.length;
  const mean = Array.from({ length: width }, (_, j) =>
    rows.reduce((sum, row) => sum + row.x[j], 0) / rows.length);
  const scale = mean.map((m, j) => Math.sqrt(rows.reduce((sum, row) =>
    sum + Math.pow(row.x[j] - m, 2), 0) / rows.length) || 1);
  const x = rows.map(row => row.x.map((v, j) => (v - mean[j]) / scale[j]));
  const yMean = rows.reduce((sum, row) => sum + row.y, 0) / rows.length;
  let intercept = yMean;
  const weights = new Array(width).fill(0);
  const learningRate = 0.035;
  // Batch sub-gradient descent on the pinball loss.  Small data + fixed iterations
  // keep it transparent, fast, and exactly reproducible in the browser.
  for (let step = 0; step < 900; step++) {
    let gi = 0;
    const gw = new Array(width).fill(0);
    for (let i = 0; i < rows.length; i++) {
      const prediction = intercept + weights.reduce((sum, w, j) => sum + w * x[i][j], 0);
      const gradient = prediction >= rows[i].y ? (1 - quantile) : -quantile;
      gi += gradient;
      for (let j = 0; j < width; j++) gw[j] += gradient * x[i][j];
    }
    intercept -= learningRate * gi / rows.length;
    for (let j = 0; j < width; j++) weights[j] -= learningRate * gw[j] / rows.length;
  }
  return {
    predict(features) {
      return intercept + weights.reduce((sum, w, j) => sum + w * ((features[j] - mean[j]) / scale[j]), 0);
    }
  };
}

export function buildGrowthForecast(network) {
  const r = rng(network.seed * 1597334677);
  const history = [];
  // Six historical seasonal readings for every transformer gives a compact but
  // meaningful calibration set.  The final current-season target stays held out.
  for (const t of network.transformers) {
    for (let year = 0; year < 6; year++) {
      const drift = (year - 2.5) * t.neighbourhoodGrowth * 0.010;
      history.push({
        x: [
          t.lastSummerPeak * (0.94 + r() * 0.12),
          clamp(t.acShare + gauss(r, 0, 0.025), 0.20, 0.90),
          clamp((t.evCount + gauss(r, 0, 0.8)) / 8, 0, 1.5),
          clamp(t.neighbourhoodGrowth + gauss(r, 0, 0.012), 0.005, 0.16),
        ],
        y: clamp(t.unsanctioned + drift + gauss(r, 0, 0.020), 0.005, 0.35),
      });
    }
  }
  const models = { p10: fitQuantileRegression(history, 0.10), p50: fitQuantileRegression(history, 0.50), p90: fitQuantileRegression(history, 0.90) };
  const byId = {};
  let pinball = 0, covered = 0;
  for (const t of network.transformers) {
    const predictions = ["p10", "p50", "p90"].map(key => clamp(models[key].predict(growthFeatures(t)), 0, 0.35)).sort((a, b) => a - b);
    const [p10, p50, p90] = predictions;
    byId[t.id] = { p10, p50, p90 };
    covered += t.unsanctioned >= p10 && t.unsanctioned <= p90 ? 1 : 0;
    const err = t.unsanctioned - p50;
    pinball += err >= 0 ? 0.5 * err : -0.5 * err;
  }
  return {
    byId,
    calibration: {
      samples: history.length,
      coverage: covered / network.transformers.length,
      medianPinballLoss: pinball / network.transformers.length,
    },
  };
}

export function networkAtForecastQuantile(network, forecast, quantile = "p90") {
  return {
    ...network,
    transformers: network.transformers.map(t => ({
      ...t,
      unsanctioned: forecast.byId[t.id]?.[quantile] ?? t.unsanctioned,
    })),
  };
}

// ---- scenarios ----
export const SCENARIOS = {
  normal: { label: "Normal summer", ambientPeak: 34, acGain: 1.0, evGain: 1.0 },
  hot: { label: "Hot summer", ambientPeak: 42, acGain: 1.35, evGain: 1.1 },
  highEV: { label: "High EV growth", ambientPeak: 38, acGain: 1.15, evGain: 2.2 },
};

// ambient temperature over a day (deg C): cool pre-dawn, hot mid-afternoon
function ambientAt(step, peak) {
  const h = step * STEP_H;
  const base = peak - 10;
  return base + (peak - base) * Math.max(0, Math.sin((h - 5) / 24 * 2 * Math.PI * 0.75));
}

// solar generation shape (fraction of a notional cap), zero after ~18:30
function solarAt(step) {
  const h = step * STEP_H;
  if (h < 6.5 || h > 18.5) return 0;
  return Math.max(0, Math.sin((h - 6.5) / 12 * Math.PI));
}

// per-transformer day load in per-unit of rating, before any flexible control
function dayLoadPU(t, scenario, withGrowth = true) {
  const sc = SCENARIOS[scenario];
  const growth = withGrowth ? 1 + t.unsanctioned : 1;
  const out = [];
  for (let s = 0; s < DAY_STEPS; s++) {
    const h = s * STEP_H;
    // base residential/commercial double-hump
    const morning = Math.exp(-Math.pow((h - 9) / 2.2, 2)) * 0.55;
    const evening = Math.exp(-Math.pow((h - 20) / 2.0, 2)) * 1.0;
    const baseShape = 0.3 + morning + evening;
    // cooling load tracks ambient, strongest in the evening
    const ac = t.acShare * sc.acGain * Math.max(0, (ambientAt(s, sc.ambientPeak) - 28) / 14)
      * (0.6 + 0.6 * evening);
    const pu = t.peakFactor * growth * (baseShape + ac) / 1.55;
    out.push(pu);
  }
  return out;
}

// EV sessions on a transformer for the evening (arrive 17:00-21:00)
export function evSessions(t, scenario, seed) {
  const sc = SCENARIOS[scenario];
  const r = rng((seed ^ parseInt(t.id.slice(2))) * 40503);
  const count = Math.round(t.evCount * sc.evGain);
  const sessions = [];
  for (let i = 0; i < count; i++) {
    const arrive = 17 + r() * 4;                   // hour
    const depart = 6 + r() * 3;                     // next morning
    const energy = 6 + r() * 8;                     // kWh needed
    const maxKw = 3.3 + (r() < 0.3 ? 3.7 : 0);      // 3.3 or 7 kW
    sessions.push({ id: t.id + "-ev" + i, arrive, depart, energy, maxKw });
  }
  return sessions;
}

// ---- IEEE C57.91 discrete thermal model ----
// returns {hotSpot[], topOil[], loadingPU[], lolHours, overloadHours}
export function thermal(loadingPU, ambientSeries) {
  const hotSpot = [], topOil = [];
  let dTO = TOP_OIL_RISE_RATED * Math.pow(Math.max(0.05, loadingPU[0]), 2 * N_EXP) /
    Math.pow(1, 2 * N_EXP); // seed oil rise near steady state of first point
  dTO = TOP_OIL_RISE_RATED * Math.pow(loadingPU[0] * loadingPU[0], N_EXP);
  let lol = 0, overload = 0;
  const alpha = STEP_H / TAU_OIL_H;
  for (let s = 0; s < loadingPU.length; s++) {
    const K = Math.max(0.02, loadingPU[s]);         // per-unit load
    const dTOu = TOP_OIL_RISE_RATED * Math.pow(K * K, N_EXP);   // ultimate oil rise
    dTO = dTO + alpha * (dTOu - dTO);               // first-order lag
    const dHS = HOT_SPOT_RISE_RATED * Math.pow(K * K, M_EXP);   // winding gradient (fast)
    const amb = ambientSeries[s % ambientSeries.length];
    const theta = amb + dTO + dHS;                  // hot-spot temperature
    hotSpot.push(theta);
    topOil.push(amb + dTO);
    // ageing acceleration factor (IEEE, 110C reference)
    const faa = Math.exp(15000 / 383 - 15000 / (theta + 273));
    lol += faa * STEP_H;
    if (K > 1.0) overload += STEP_H;
  }
  return { hotSpot, topOil, loadingPU, lolHours: lol, overloadHours: overload };
}

// run one transformer for a day, no flexible control
export function simulateTransformer(t, scenario, withGrowth = true) {
  const sc = SCENARIOS[scenario];
  const amb = Array.from({ length: DAY_STEPS }, (_, s) => ambientAt(s, sc.ambientPeak));
  const pu = dayLoadPU(t, scenario, withGrowth);
  const res = thermal(pu, amb);
  const peakLoading = Math.max(...pu);
  const peakHotSpot = Math.max(...res.hotSpot);
  return { ...res, peakLoading, peakHotSpot, ambient: amb };
}

// p10 / p90 loading band for the detail panel.  When a fitted forecast is supplied,
// the band comes from its quantile predictions; the fallback keeps standalone calls
// backwards-compatible.
export function simulateTransformerBand(t, scenario, growthForecast) {
  const sc = SCENARIOS[scenario];
  const amb = Array.from({ length: DAY_STEPS }, (_, s) => ambientAt(s, sc.ambientPeak));
  const predicted = growthForecast?.byId?.[t.id];
  const p10Growth = predicted?.p10 ?? t.unsanctioned * 0.5;
  const p50Growth = predicted?.p50 ?? t.unsanctioned;
  const p90Growth = predicted?.p90 ?? t.unsanctioned * 1.7;
  const runAt = (growth) => {
    const tMod = { ...t, unsanctioned: growth };
    return dayLoadPU(tMod, scenario, true);
  };
  const p10pu = runAt(p10Growth);
  const p50pu = runAt(p50Growth);
  const p90pu = runAt(p90Growth);
  const p10hs = thermal(p10pu, amb).hotSpot;
  const p50hs = thermal(p50pu, amb).hotSpot;
  const p90hs = thermal(p90pu, amb).hotSpot;
  return { p10Loading: p10pu, p50Loading: p50pu, p90Loading: p90pu, p10HotSpot: p10hs, p50HotSpot: p50hs, p90HotSpot: p90hs, p10Growth, p50Growth, p90Growth };
}


// risk band from peak loading
export function riskBand(peakLoading) {
  if (peakLoading >= 1.0) return "critical";
  if (peakLoading >= 0.9) return "high";
  if (peakLoading >= 0.8) return "watch";
  return "ok";
}

// ---- apply a Plan action to a transformer (returns a modified copy) ----
export function applyAction(t, action) {
  const c = { ...t };
  if (action === "upgrade") {
    const idx = RATINGS.indexOf(t.rating);
    c.rating = RATINGS[Math.min(RATINGS.length - 1, idx + 1)];
    if (c.rating === t.rating) c.rating = Math.round(t.rating * 1.3); // already top: bump
    c.peakFactor = t.peakFactor * (t.rating / c.rating);
  } else if (action === "rebalance") {
    c.peakFactor = t.peakFactor * 0.88;   // phase rebalancing relieves ~12%
  } else if (action === "mobile") {
    c.peakFactor = t.peakFactor * 0.78;   // mobile unit shares peak-day load
  }
  return c;
}

export function actionCost(t, action) {
  if (action === "upgrade") return UPGRADE_COST[t.rating] ?? 300000;
  if (action === "mobile") return MOBILE_COST;
  if (action === "rebalance") return 40000;
  return 0;
}

// Include every demand/rating input used by applyAction and simulateTransformer.
// Transformer IDs repeat across seeds and forecast quantiles.
const simCache = new Map();
function cachedSim(t, scenario, action) {
  const key = JSON.stringify([scenario, action, t.rating, t.peakFactor, t.acShare, t.unsanctioned]);
  let v = simCache.get(key);
  if (!v) {
    const tt = applyAction(t, action);
    const s = simulateTransformer(tt, scenario);
    v = {
      band: riskBand(s.peakLoading), peakLoading: s.peakLoading,
      peakHotSpot: s.peakHotSpot, lol: s.lolHours, overload: s.overloadHours
    };
    simCache.set(key, v);
  }
  return v;
}
export function clearSimCache() { simCache.clear(); }

// evaluate a whole suburb under a set of actions
export function evaluatePlan(network, scenario, actions) {
  let overload = 0, lol = 0, capex = 0;
  const perT = {};
  for (const t of network.transformers) {
    const a = actions[t.id] ?? "none";
    capex += actionCost(t, a);
    const sim = cachedSim(t, scenario, a);
    overload += sim.overload;
    lol += sim.lol;
    perT[t.id] = {
      band: sim.band, peakLoading: sim.peakLoading,
      peakHotSpot: sim.peakHotSpot, lol: sim.lol, action: a
    };
  }
  return { overloadHours: overload, lossOfLifeHours: lol, capexInr: capex, perT };
}

export { DAY_STEPS, STEP_H, HOT_SPOT_LIMIT, RATINGS, solarAt };
