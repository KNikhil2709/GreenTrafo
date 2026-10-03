# Changelog

All notable changes to the GreenTrafo prototype are documented here.

## [v0.5.0] — 2026-10-03

### Added
- **Forecasting module (TDD §12):** deterministic in-browser quantile regression for latent
  load growth, trained on six synthetic historical seasonal readings for every transformer.
  - Uses prior summer peak, cooling share, EV count and a neighbourhood-growth proxy; the
    current season's synthetic truth remains held out from feature inputs.
  - Produces ordered p10 / p50 / p90 load-growth predictions, calibration coverage and
    median pinball-loss metrics. Seed 42 produces 240 historical readings and 98% held-out
    p10–p90 coverage.
  - **Plan now evaluates p90 growth** to make its recommendation explicitly conservative.
  - Each transformer detail card reveals its p10, median and p90 forecasts; the loading and
    hot-spot uncertainty bands now derive from those fitted quantiles rather than fixed
    multipliers.
- **Forecast transparency:** a Plan-side forecast card states the training-set size,
  held-out interval coverage and how the conservative p90 decision is applied. Method &
  limits now documents the model and its synthetic-data limitation.

### Verified
- Engine checks confirm deterministic, ordered, bounded quantiles; 96-step forecast bands;
  p90 Plan inputs; and finite thermal-plan evaluation.
- Headless Chrome user-flow verification: Plan optimises, transformer detail displays the
  forecast, and the existing in-browser TDD §15 suite still passes 5/5 without console errors.

### Review fixes — 2026-10-03
- Fixed a cache collision between original and p90 networks, and between network seeds.
  Seed 42 Hot summer could reuse 272.1 loss-of-life hours instead of the correct p90
  value of 361.4, depending on evaluation order.
- Fixed named-export stripping in the new build script and aligned `build.md`.
- Added `tests/regression.cjs`: five seeds, 15 deterministic Plan cases and 600 Protect
  cases, forecast bands, cache isolation, aggregate charging energy and HTML parity.
- Clarified that forecast coverage is synthetic calibration, not independent held-out
  accuracy; the synthetic history shares latent growth with evaluation targets.
- Labelled transformer detail charts/metrics as median demand before plan actions.
- Corrected the Validate screen and STATUS: five smoke checks do not complete TDD §15.
  Recorded missing capex constraints, warm starts, independent forecast evaluation and
  other existing gaps for a later user-approved feature.
- Rechecked the rebuilt demo in visible Chrome: three-scenario Plan/profile and Protect
  flows, forecast detail, clipboard, Validate (5/5), and FAQ passed with no runtime exceptions.

## [v0.4.0] — 2026-10-03

### Added
- **Validate tab (TDD §15):** 4th nav tab running 5 automated in-browser validation experiments:
  - *Physics sanity* — IEEE C57.91 step-load convergence to exact rated temperature
  - *Determinism* — bit-exact match across two calls with identical inputs
  - *Plan beats 80/90 baseline* — thermal-informed (LoL-ranked) upgrade selection vs loading-threshold at equal budget
  - *Protect on-time ≥ 95%* — scheduler on-time share across all 3 scenarios
  - *Protect hot-spot bound* — managed time-over-110°C ≤ unmanaged in Hot summer and High EV growth
  - All 5 experiments pass (5/5 ✔)
- **ToU baseline in Protect (TDD §11):** third comparison curve added to the hot-spot chart
  - Amber = Time-of-Use (charge EVs only during off-peak 22:00–06:00)
  - EV bar chart updated to 3 series: Unmanaged (red) · ToU (amber) · Managed (green)
  - `runProtect` now returns `tou` thermal result + `touKw` schedule alongside managed/unmanaged

---

## [v0.3.1] — 2026-10-03

### Added
- **Load-growth uncertainty band (Plan tab):** The transformer detail panel now shows both
  a loading chart and a hot-spot temperature chart, each with a shaded p10/p90 envelope.
  - `simulateTransformerBand()` added to `engine.js`: runs the IEEE C57.91 thermal model
    at 0.5× (p10 — conservative) and 1.7× (p90 — pessimistic) unsanctioned growth
    multipliers to produce a quantile-style envelope.
  - `LineChart` updated with an optional `band` prop: `{ low[], high[], color }`. Renders
    a filled SVG polygon between p10 and p90 bounds, with dashed outline curves.
  - A worst-case hint at the bottom of the detail card shows e.g.
    "p90 peak: 105% loading · 97°C hot-spot (assumes +70% hidden load growth)".

---

## [v0.3.0] — 2026-10-03

### Added
- **Dual hot-spot curve chart (Protect tab):** Both Managed (green) and Unmanaged (red)
  temperature curves are now shown simultaneously on the same chart. The highlighted mode
  gets full opacity; the other is semi-transparent, making the thermal benefit immediately
  visible without toggling.
- **EV charge schedule bar chart (Protect tab):** New `ChargeBar` SVG component below the
  temperature chart comparing EV charging kW per 15-min slot between Unmanaged (red) and
  Managed (green) from 16:00–24:00. A vertical cursor tracks the current replay time.
- **Transformer detail panel (Plan tab):** Clicking any transformer node on the feeder map
  opens a detail card in the right rail showing the full-day loading curve, peak loading %,
  peak hot-spot °C, daily loss-of-life, and overload hours. Implemented as a proper
  `TransformerDetail` React component.
- **CO₂ avoided metric (green strip):** Fourth green-outcome metric showing estimated
  carbon avoided = peak kWh shifted × 0.82 kgCO₂/kWh (CEA 2024 Indian average grid
  emission factor, assumed). Visible across both Plan and Protect tabs.
- **Live generation counter + progress bar (Plan tab):** The "Run optimiser" button now
  shows "Optimising… gen X / 60" with an animated gradient progress bar while NSGA-II runs.
- **Copy plan summary button (Plan tab):** A 📋 Copy button appears next to the Pareto
  badge after optimisation. Clicking it copies a structured text summary (scenario, profile,
  capex, loss-of-life, overload hours, actions, green metrics) to the clipboard. Flashes
  ✓ Copied on success.
- **FAQ accordion (Method & limits tab):** Five collapsible FAQ items added at the bottom
  covering: synthetic data rationale, thermal model accuracy, NSGA-II vs greedy heuristics,
  valley-filling vs cvxpy, and GreenTrafo's fit alongside Schneider products (ADMS, DERMS,
  EVlink).

### Fixed
- **Protect tab crash on "Normal summer" scenario:** The `risky` transformer list was empty
  for the Normal summer scenario (EV load alone does not drive any unit over the strict
  hot-spot threshold), causing `sel = undefined` and a null-dereference crash in
  `runProtect`. Fixed with a 3-tier fallback in the `risky` memoisation:
  1. Strict: transformers where EV swing pushes hot-spot above the limit
  2. Fallback: any transformers with overload hours > 0
  3. Ultimate fallback: top-8 busiest transformers by EV session count
  `sel` is now derived from `risky` so it can never be stale or undefined. `runProtect` is
  guarded with a null check. A yellow contextual banner is shown when the fallback is active.

### Changed
- Green strip now shows 4 metrics (was 3): added CO₂ avoided.
- Protect tab hot-spot chart subtitle updated to reflect dual-curve display.
- Feeder map subtitle in Plan tab updated to hint at the new detail panel.

---

## [v0.2.0] — 2026-09-28 (initial prototype)

### Added
- Seeded synthetic feeder with ~40 transformers and three load scenarios
  (Normal summer, Hot summer, High EV growth).
- IEEE C57.91 top-oil / hot-spot thermal model and ageing loss-of-life calculation.
- NSGA-II multi-objective Plan optimiser with Pareto front and three named profiles
  (Lowest cost, Balanced, Most reliable). Compared against 80%/90% threshold baseline.
- Valley-filling Protect scheduler with departure-time and comfort constraints.
- Green outcomes panel: avoided replacements, diesel generator hours avoided, peak kWh shifted.
- Dark command-center UI with Schneider "Life Green" theme, cinematic hero, animated feeder map.
- Method & limits tab with assumptions table and product-fit explanation.
