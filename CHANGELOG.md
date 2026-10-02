# Changelog

All notable changes to the GreenTrafo prototype are documented here.

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
