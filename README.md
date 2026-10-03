# GreenTrafo

**Green thermal-life budgeting for grid reliability** — a software-only prototype for the
Schneider Electric Yuva Yodha Energy Tech Hackathon 2026 (Grid Reliability track).

GreenTrafo treats each distribution transformer's thermal life as a budget, and helps a
DISCOM spend it before summer (**Plan**) and protect it during peak evenings (**Protect**).
All data is simulated.

## Links


- **Project status (done vs. left):** [STATUS.md](STATUS.md)
- **Design docs:** [docs/TDD.md](docs/TDD.md) · [docs/PRD.md](docs/PRD.md)

## Documentation map

| File | What it is |
| --- | --- |
| [README.md](README.md) | This file — what it is and how to run it |
| [STATUS.md](STATUS.md) | How much of the design is done vs. still to build |
| [CHANGELOG.md](CHANGELOG.md) | History of changes to the prototype |
| [docs/TDD.md](docs/TDD.md) | Technical Design Document (production design) |
| [docs/PRD.md](docs/PRD.md) | Product Requirements Document |
| [build.md](build.md) | How the single HTML file is assembled from `src/` |

## Run it locally

The prototype is a single self-contained web page. No build step needed to run it.

**Option 1 — double-click**
Open `index.html` (same file as `greentrafo.html`) in Chrome, Edge, Firefox or Safari.

**Option 2 — local server (recommended)**
From inside this folder:

```bash
python3 -m http.server 3000      # or:  npx serve -l 3000
```

Then open **http://localhost:3000/**. First load requires an internet connection (React
and Babel load from a CDN).

## What you'll see

1. A dark landing hero. Click **Start planning** (or scroll) to drop into the app.
2. **Plan** — pick a scenario, rupee cap and maximum upgrade/mobile counts, press **Run optimiser**,
   choose a plan from the Pareto front, and compare it with the
   80% / 90% threshold rule under the same cap. Every action counts toward the budget;
   actual spending and unspent amounts are shown for both policies. Changing the budget
   clears the previous result. Plan uses a conservative p90 latent-load-growth forecast; tap
   any transformer on the map for its p10 / p50 / p90 forecast and full detail panel.
   Use the 📋 Copy button to export the plan summary to clipboard.
3. **Protect** — pick an at-risk transformer, scrub the heatwave evening. The chart shows
   both **Managed** and **Unmanaged** hot-spot curves simultaneously, plus an EV charge
   schedule bar chart showing how load is shifted across the evening.
4. **Method & limits** — what is real, what is assumed. Includes a collapsible FAQ.

## Source layout

```
index.html / greentrafo.html   the built, runnable prototype (identical files)
src/
  engine.js       synthetic feeder + load shapes + IEEE C57.91 thermal model
  optimize.js     Plan (NSGA-II multi-objective) + Protect (valley-fill scheduler)
  app.jsx         React UI: dark hero + tabs (Plan, Protect, Method)
  head.html       HTML shell, Schneider-green theme + dark hero styles, CDN tags
build.md          how the single file is assembled from src/
CHANGELOG.md      history of prototype changes
```

## Rebuilding index.html

After editing anything in `src/`, rebuild the HTML:

```bash
node build.js    # see build.md for the exact build script
```

The equivalent build script is documented in [build.md](build.md).

Run the regression checks after rebuilding:

```bash
node build.js
node tests/regression.cjs
node tests/plan-budget.cjs
```

The checks exercise the shipped engine across five seeds and all three scenarios,
including forecast bands, cache isolation, deterministic plans and Protect energy totals.
They do not establish independent forecast accuracy or full TDD acceptance.

The budget checks cover zero/small caps, all action costs, resource limits and baseline
affordability. `runPlan` requires `{capexInr, upgrades, mobileUnits}` as non-negative integers.
The evolutionary repair keeps affordable actions in feeder order; it ensures feasibility,
not a globally optimal selection. Equal budget caps do not guarantee equal actual spending.

For the browser checks, start the server, open a separate Chrome profile with
`google-chrome --user-data-dir=/tmp/greentrafo-budget-chrome --remote-debugging-port=9222`,
and run `node tests/browser-budget.cjs` with `playwright-core` installed (or set
`PLAYWRIGHT_MODULE` to an existing installation). It leaves the tested demo open and writes
desktop/mobile screenshots under `/tmp/greentrafo-budget-*.png`.
Also run `node tests/browser-full.cjs` with the same Playwright setup for the complete
website walkthrough: all transformer details/scenarios, Plan interactions, Protect replay,
Method FAQs, validation, responsive layouts and both HTML entry points. Its screenshots
are written to `/tmp/greentrafo-full-*.png`.

`engine.js` and `optimize.js` use ES module syntax. On Node 18.20, direct imports require
`--experimental-default-type=module`; the build and regression scripts need no flags.

## What is real and what is not

- **Real:** the IEEE C57.91 top-oil/hot-spot thermal model and loss-of-life, a working
  NSGA-II optimiser with a threshold baseline, and a valley-filling evening scheduler with
  a departure-time constraint. All seeded and reproducible.
- **Approximated:** power flow is a lightweight load model, not pandapower/OpenDSS; thermal
  constants are typical IEEE values; hot-spot temperature is estimated from load, not
  measured; the DISCOM-to-charger control path is a proposed demand-response design.

See the **Method & limits** tab for the full list. The PRD and TDD describe the production
architecture (pandapower + cvxpy + FastAPI + React).

## Theme

A dark, cinematic landing hero in Schneider "Life Green" (#3DCD58), then a clean dark app
for the map and charts. Transformer risk bands use separate colours (green/amber/orange/red)
so "green outcome" never collides with "healthy transformer".
