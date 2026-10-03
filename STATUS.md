# Project status: done vs. left

This file tracks what the **prototype in this repo** implements, measured against the full
**production design** in [`docs/TDD.md`](docs/TDD.md) and [`docs/PRD.md`](docs/PRD.md).

The prototype is a self-contained browser demo that proves the method end to end. The
production system in the TDD is a Python + FastAPI + React stack. So a large part of the
TDD is deliberately **not yet built** — that is expected for a hackathon prototype.

**Legend:** ✅ done · 🟡 partial · ⬜ not started

## Required workflow after every feature

- Read/review the source and its interactions with the rest of the application.
- Rebuild both HTML entry points and run all engine and feature regression tests.
- Run the whole website in visible desktop Chrome: hero navigation, all Plan scenarios
  and profiles, transformer details, Pareto selection, budget controls, clipboard, all
  Protect scenarios/selection/modes/replay, Method FAQs and Validate. Check responsive
  layouts, runtime/console errors and failed requests. Use `tests/browser-budget.cjs`
  and `tests/browser-full.cjs` as the repeatable walkthroughs, plus feature-specific
  browser checks such as `tests/browser-warm-start.cjs`.
- Fix discovered UI regressions and rerun affected checks; document remaining model gaps.
- Only after verification, provide commit/push commands, then stop until the user asks
  for the next feature. Do not commit or push on the user's behalf.

## Overall

The prototype has working Plan and Protect screens, five browser smoke checks,
a 3-curve Protect comparison (Unmanaged / ToU / Managed), and a fitted p10/p50/p90
load-growth forecast that Plan uses conservatively. The earlier 60% estimate was informal:
remaining work includes algorithm constraints, independent forecasting evaluation and
full TDD validation, as well as power flow, API, persistence and deployment.

## Current checkpoint — v0.7.0 warm-start re-planning, 2026-10-04

- Budget/resource changes retain a compatible Pareto archive and offer **Re-plan from
  previous plans**: 20 generations instead of the fresh search's 60.
- Reused actions are cloned, repaired under the new money/count limits, deduplicated and
  evaluated again. At most half the population comes from the archive; the baseline and
  fresh random candidates remain. Scenario/network/seed/version mismatches are rejected.
- UI reports measured search time, reused plans and how many reused plans needed repair.
  Removed the cosmetic generation counter; compute remains synchronous. Errors recover
  to an enabled fresh-run button; pending runs are cancelled when leaving Plan.
- Archive exists only while Plan stays mounted. Scenario changes and reruns with unchanged
  settings start fresh. A warm run is deterministic for fixed inputs and archive, but is
  not guaranteed to outperform a longer fresh search.
- Engine regression and budget tests passed. Warm-start checks passed 45 re-plans across
  three seeds × three scenarios, including zero-to-high budgets, count constraints,
  archive immutability, actual reuse, mismatch rejection and non-dominance. Slowest warm
  engine run in this test was 182 ms, below the 5-second target on this machine.
- Feature browser checks passed budget decrease/zero/increase, both resource limits,
  scenario/tab reset, fresh reruns, clipboard and error recovery. Measured warm click-to-result
  times were 139–155 ms in this run; desktop/mobile screenshots inspected.
- Full visible-Chrome budget and website suites passed on the final build: 120 detail
  views, all scenarios/profiles, Pareto/export, Protect selection/modes/replay, FAQs,
  repeated validation, all tabs at three screen widths and both HTML entry points.
  No console/runtime errors or failed network requests in the completed full walkthrough.
- Next candidate feature: Plan-to-Protect action transfer. Wait for the user's instruction.

## Previous checkpoint — v0.6.0 capex budget, 2026-10-04

- Implemented one feature: a hard INR cap for Plan, covering upgrades, mobile units and
  rebalancing. Upgrade/mobile count limits remain additional resource constraints.
- The 80/90 baseline uses the same cap and resource limits. Actual spend is shown for both
  policies; equal realised spending is not guaranteed with discrete action costs.
- Added budget control, selected-plan/baseline unspent amounts, zero-budget explanation,
  budget-aware clipboard export and invalidation of results when budget inputs change.
- Passed `node tests/plan-budget.cjs` (24 boundary cases plus rebalance-only, independent
  accounting, baseline affordability/fallback and invalid-input checks) and the existing
  regression suite (five seeds, 15 Plan cases, 600 Protect cases, five smoke checks).
- Visible desktop Chrome passed `tests/browser-budget.cjs`: three scenarios × three
  profiles, zero/small budgets, clearing stale results, clipboard, Validate 5/5, Protect
  and mobile overflow checks. Desktop/mobile screenshots inspected; no runtime exceptions.
- Follow-up whole-site review passed `tests/browser-full.cjs`: 120 transformer detail
  views, all Plan scenarios/profiles and custom Pareto export, repeated optimisation,
  Protect selectors/map/modes/replay across all scenarios, all five FAQs, repeated 5/5
  validation, every tab at 390/768/1440px and both HTML entry points. No console/runtime
  errors or failed requests in the completed run. Fixed blocked map nodes and overlapping
  EV chart labels, visually inspected screenshots, then reran full-site and engine checks.
- Demonstration left open at a ₹10L cap: Most reliable spends ₹10L; baseline spends ₹9L.
- Stop here pending the user's instruction. Suggested next feature: warm-start re-planning.
  No commit or push performed.

## Previous checkpoint — v0.5.0 review, 2026-10-03

- Pending changes are the forecasting feature, build script and the review fixes below.
- Fixed simulation-cache contamination between original networks, forecast quantiles and seeds.
- Fixed named-export removal in `build.js`; rebuilt both identical HTML entry points.
- Regression command: `node build.js && node tests/regression.cjs`.
- Passed five seeds, 15 deterministic Plan cases, 600 Protect cases, ordered forecast bands,
  cache isolation and the five seed-42 smoke checks. Protect checks cover aggregate energy,
  reported on-time share and managed vs unmanaged time over the thermal limit.
- Visible Chrome checks passed: Plan and all profiles in three scenarios, transformer
  forecast detail, clipboard export, Validate after p90 Plan (5/5), Protect in three
  scenarios and Method FAQ. No browser runtime exceptions in the completed run.
- Coverage is synthetic calibration, **not independent forecast accuracy**: historical
  training targets are generated from the same latent growth used for evaluation.
- Workflow: read these docs for the next task, update them, demonstrate each completed
  feature in the browser, then provide commit/push commands. Do not commit or push on the
  user's behalf. Wait for the user's instruction before starting the next feature.

## By TDD section

| TDD section | Status | Notes |
| --- | --- | --- |
| 1. Product overview | ✅ | Fully reflected in the prototype and hero. |
| 2. Problem definition | ✅ | Stated in the app's Method tab, PRD and this repo. |
| 3. Goals | 🟡 | Reliability, green and explainability goals met in-sim. "Under 10s Plan" met (~240ms). |
| 4. Non-goals | ✅ | Honoured: no hardware, no real DISCOM integration, no quantum/causal-ML. |
| 5. Users and actors | ✅ | Planner and operator flows both present (Plan, Protect tabs). |
| 6. User journey | 🟡 | Both screens work; Protect does not yet consume the selected Plan actions. |
| 7. System architecture | 🟡 | Prototype is a single-file browser app, not the FastAPI service. Architecture documented for production. |
| 8. Data model | 🟡 | Entities exist in-memory as JS objects; no SQLite/Parquet persistence. |
| 9. Simulation engine | 🟡 | IEEE C57.91 thermal model ✅ in JS. Power flow is a lightweight load approximation, **not pandapower/OpenDSS**. |
| 10. Plan module | 🟡 | Pareto search, profiles, hard rupee/count caps, same-cap baseline and warm-start budget re-planning work. Actual spending may differ; archives are in-memory and search is approximate. |
| 11. Protect module | 🟡 | Valley-filling scheduler with departure-time + comfort constraints ✅. Dual-curve comparison chart + EV charge bar chart added. Not the full cvxpy convex programme. |
| 12. Forecasting | 🟡 | Deterministic p10/p50/p90 quantile regression and p90 Plan inputs work. Coverage is shown; median pinball loss is returned by the engine. Independent evaluation, naive baseline and growth-draw sampling remain. |
| 13. API specification | ⬜ | No REST API; the engine runs in-browser. API is designed in the TDD. |
| 14. Frontend design | ✅ | Three tabs + Validate tab + dark hero + green-outcomes panel (CO₂ metric). Transformer detail panel, FAQ accordion. |
| 15. Testing and validation | 🟡 | Five seed-42 browser smoke checks pass, plus `tests/regression.cjs`. Full TDD experiments and CI remain; the browser Plan check tests a greedy ranking, not the evolutionary optimiser. |
| 16. Deployment, monitoring, security | 🟡 | Runs locally / as a static page. No Docker, monitoring, or auth (none needed for the demo). |
| 17. Implementation plan and risks | ✅ | Documented; risks and honest limits shown in the app's Method tab + FAQ. |

## What works today (demo-ready)

- ✅ Seeded synthetic feeder (~40 transformers), three scenarios with a realistic risk gradient
- ✅ IEEE C57.91 top-oil / hot-spot thermal model → ageing factor → loss-of-life
- ✅ **Plan**: NSGA-II optimiser, Pareto front, Lowest-cost / Balanced / Most-reliable profiles, deltas vs the 80/90 baseline
- ✅ **Plan**: fitted **p10/p50/p90 latent-load-growth forecast** from synthetic historic readings; Plan uses p90 conservatively and the detail panel shows p10/p90 loading and hot-spot bands
- ✅ **Plan**: warm-start budget/resource re-planning with actual elapsed time and archive reuse counts
- 🟡 **Plan**: optimisation runs synchronously with a busy state, not live generation slices
- ✅ **Plan**: 📋 Copy plan summary to clipboard
- ✅ **Plan**: hard INR cap across all actions, same-cap baseline, spend/unspent totals and zero-budget handling
- ✅ **Protect**: evening replay with 3-curve hot-spot chart (Managed / ToU / Unmanaged on same chart)
- ✅ **Protect**: EV charge schedule bar chart with 3 series (red = Unmanaged, amber = ToU, green = Managed)
- ✅ **Protect**: robust scenario handling — never crashes even when no transformers are strictly at-risk (3-tier fallback)
- ✅ **Validate tab** — 5 prototype smoke checks pass at seed 42 (not full TDD acceptance)
- ✅ Green-outcomes accounting: avoided replacements, diesel hours avoided, peak kWh shifted, **CO₂ avoided** (0.82 kgCO₂/kWh CEA 2024)
- ✅ FAQ accordion in Method & limits tab (5 questions covering data, model, algorithms, product fit)
- ✅ Dark command-center UI + cinematic hero, Schneider-green theme
- ✅ Runs entirely on a laptop; reproducible from a seed

## What's left (to reach the production TDD)

1. ⬜ **Real power flow** — port the engine to Python with pandapower; add OpenDSS for LV unbalance.
2. ⬜ **Convex Protect** — replace the greedy scheduler with the cvxpy rolling-horizon programme.
3. ⬜ **FastAPI backend** — expose `/plan`, `/protect`, `/simulate`, `/benchmark`; move compute server-side.
4. ⬜ **Persistence** — SQLite run store + Parquet time series; one YAML config with versioning.
5. ⬜ **Validation suite** — the five experiments in TDD §15, plus unit/regression tests in CI.
6. ⬜ **Calibration to published statistics** — tie synthetic data to CEA/BIS figures formally.
7. ⬜ **Deployment** — Docker Compose; hosted backend + frontend.

## Known gaps to prioritise with the user

- Plan now enforces a true capex constraint, including rebalance costs. Exact equal-spend
  comparisons remain distinct from the implemented same-cap comparison. Warm starts are
  implemented; Plan-to-Protect action transfer is absent.
- Forecast evaluation needs independent historical/current targets and a naive baseline.
- Protect rounds arrival/departure slots, can revisit a session's slot across cap passes,
  and wraps overnight charging into a single day. Per-session power/window checks and
  chronological thermal carry-over are still needed; aggregate regression passes do not prove these.
- Green accounting in Protect uses simplified proxies; shifting kWh alone does not establish
  avoided CO₂ without an off-peak emissions comparison.
- Existing claims about guaranteed thermal safety, live progress, and full validation
  should be reviewed as those features are addressed.

## Honest limits (also shown in the app)

- All data is **synthetic and seeded**; no real DISCOM data.
- Hot-spot temperature is **estimated from load**, not measured.
- Thermal constants are **typical IEEE values**; report relative improvements, not absolute lifetimes.
- The DISCOM→charger control path in Protect is a **proposed demand-response design**, not deployed.
- Green figures depend on **assumed parameters** (diesel share, end-of-life threshold, CO₂ factor), shown on each figure.
