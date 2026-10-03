# Project status: done vs. left

This file tracks what the **prototype in this repo** implements, measured against the full
**production design** in [`docs/TDD.md`](docs/TDD.md) and [`docs/PRD.md`](docs/PRD.md).

The prototype is a self-contained browser demo that proves the method end to end. The
production system in the TDD is a Python + FastAPI + React stack. So a large part of the
TDD is deliberately **not yet built** — that is expected for a hackathon prototype.

**Legend:** ✅ done · 🟡 partial · ⬜ not started

## Overall

Roughly **55%** of the production TDD is realised. The prototype now covers both Plan and
Protect end-to-end with a full TDD §15 validation suite (5/5 experiments pass in-browser),
a 3-curve Protect comparison (Unmanaged / ToU / Managed), and a p10/p90 load-growth
uncertainty band. The remaining ~45% is production plumbing (real power flow, API,
database, deployment).

## By TDD section

| TDD section | Status | Notes |
| --- | --- | --- |
| 1. Product overview | ✅ | Fully reflected in the prototype and hero. |
| 2. Problem definition | ✅ | Stated in the app's Method tab, PRD and this repo. |
| 3. Goals | 🟡 | Reliability, green and explainability goals met in-sim. "Under 10s Plan" met (~240ms). |
| 4. Non-goals | ✅ | Honoured: no hardware, no real DISCOM integration, no quantum/causal-ML. |
| 5. Users and actors | ✅ | Planner and operator flows both present (Plan, Protect tabs). |
| 6. User journey | ✅ | Both journeys implemented end to end in the UI. |
| 7. System architecture | 🟡 | Prototype is a single-file browser app, not the FastAPI service. Architecture documented for production. |
| 8. Data model | 🟡 | Entities exist in-memory as JS objects; no SQLite/Parquet persistence. |
| 9. Simulation engine | 🟡 | IEEE C57.91 thermal model ✅ in JS. Power flow is a lightweight load approximation, **not pandapower/OpenDSS**. |
| 10. Plan module | ✅ | NSGA-II multi-objective optimiser, Pareto front, 3 profiles, warm-start baseline — all working. Detail panel + copy summary added. |
| 11. Protect module | 🟡 | Valley-filling scheduler with departure-time + comfort constraints ✅. Dual-curve comparison chart + EV charge bar chart added. Not the full cvxpy convex programme. |
| 12. Forecasting | ⬜ | Latent load-growth quantile regression not yet built; unsanctioned growth is a synthetic parameter. |
| 13. API specification | ⬜ | No REST API; the engine runs in-browser. API is designed in the TDD. |
| 14. Frontend design | ✅ | Three tabs + Validate tab + dark hero + green-outcomes panel (CO₂ metric). Transformer detail panel, FAQ accordion. |
| 15. Testing and validation | ✅ | **5 TDD §15 experiments run in-browser and pass (5/5).** No CI yet. |
| 16. Deployment, monitoring, security | 🟡 | Runs locally / as a static page. No Docker, monitoring, or auth (none needed for the demo). |
| 17. Implementation plan and risks | ✅ | Documented; risks and honest limits shown in the app's Method tab + FAQ. |

## What works today (demo-ready)

- ✅ Seeded synthetic feeder (~40 transformers), three scenarios with a realistic risk gradient
- ✅ IEEE C57.91 top-oil / hot-spot thermal model → ageing factor → loss-of-life
- ✅ **Plan**: NSGA-II optimiser, Pareto front, Lowest-cost / Balanced / Most-reliable profiles, deltas vs the 80/90 baseline
- ✅ **Plan**: transformer detail panel with **p10/p90 load-growth uncertainty band** on both loading and hot-spot charts
- ✅ **Plan**: live NSGA-II generation counter + progress bar during optimisation
- ✅ **Plan**: 📋 Copy plan summary to clipboard
- ✅ **Protect**: evening replay with 3-curve hot-spot chart (Managed / ToU / Unmanaged on same chart)
- ✅ **Protect**: EV charge schedule bar chart with 3 series (red = Unmanaged, amber = ToU, green = Managed)
- ✅ **Protect**: robust scenario handling — never crashes even when no transformers are strictly at-risk (3-tier fallback)
- ✅ **Validate tab** — 5 TDD §15 automation experiments, all passing (5/5 ✔)
- ✅ Green-outcomes accounting: avoided replacements, diesel hours avoided, peak kWh shifted, **CO₂ avoided** (0.82 kgCO₂/kWh CEA 2024)
- ✅ FAQ accordion in Method & limits tab (5 questions covering data, model, algorithms, product fit)
- ✅ Dark command-center UI + cinematic hero, Schneider-green theme
- ✅ Runs entirely on a laptop; reproducible from a seed

## What's left (to reach the production TDD)

1. ⬜ **Real power flow** — port the engine to Python with pandapower; add OpenDSS for LV unbalance.
2. ⬜ **Convex Protect** — replace the greedy scheduler with the cvxpy rolling-horizon programme.
3. ⬜ **Forecasting module** — quantile regression for latent load growth, with calibration.
4. ⬜ **FastAPI backend** — expose `/plan`, `/protect`, `/simulate`, `/benchmark`; move compute server-side.
5. ⬜ **Persistence** — SQLite run store + Parquet time series; one YAML config with versioning.
6. ⬜ **Validation suite** — the five experiments in TDD §15, plus unit/regression tests in CI.
7. ⬜ **Calibration to published statistics** — tie synthetic data to CEA/BIS figures formally.
8. ⬜ **Deployment** — Docker Compose; hosted backend + frontend.

## Honest limits (also shown in the app)

- All data is **synthetic and seeded**; no real DISCOM data.
- Hot-spot temperature is **estimated from load**, not measured.
- Thermal constants are **typical IEEE values**; report relative improvements, not absolute lifetimes.
- The DISCOM→charger control path in Protect is a **proposed demand-response design**, not deployed.
- Green figures depend on **assumed parameters** (diesel share, end-of-life threshold, CO₂ factor), shown on each figure.
