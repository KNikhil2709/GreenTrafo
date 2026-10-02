# GreenTrafo

**Green thermal-life budgeting for grid reliability** — a software-only prototype for the
Schneider Electric Yuva Yodha Energy Tech Hackathon 2026 (Grid Reliability track).

GreenTrafo treats each distribution transformer's thermal life as a budget, and helps a
DISCOM spend it before summer (**Plan**) and protect it during peak evenings (**Protect**).
All data is simulated.

## Links

- **Live demo:** https://claude.ai/code/artifact/JnQzBM7dk13rE81V7pTJ7d
- **Project status (done vs. left):** [STATUS.md](STATUS.md)
- **Design docs:** [docs/TDD.md](docs/TDD.md) · [docs/PRD.md](docs/PRD.md)

## Documentation map

| File | What it is |
| --- | --- |
| [README.md](README.md) | This file — what it is and how to run it |
| [STATUS.md](STATUS.md) | How much of the design is done vs. still to build |
| [docs/TDD.md](docs/TDD.md) | Technical Design Document (production design) |
| [docs/PRD.md](docs/PRD.md) | Product Requirements Document |
| [build.md](build.md) | How the single HTML file is assembled from `src/` |

## Run it locally

The prototype is a single self-contained web page. No build step.

**Option 1 — double-click**
Open `index.html` (same file as `greentrafo.html`) in Chrome, Edge, Firefox or Safari.

**Option 2 — local server (recommended, and makes the root URL work)**
From inside this `greentrafo/` folder:

```bash
python3 -m http.server 3000      # or:  npx serve -l 3000
```

Then open **http://localhost:3000/** — because the file is named `index.html`, the server
serves the prototype directly at the root. You will NOT see a file listing anymore.

> First open needs an internet connection (React and Babel load from a CDN). Ask for an
> offline-bundled build if you need it to run with no network.

## What you'll see

1. A dark landing hero. Click **Start planning** (or scroll) to drop into the app.
2. **Plan** — pick a scenario and budget, press **Run optimiser**, choose a plan from the
   Pareto front, and compare it with the 80% / 90% threshold rule.
3. **Protect** — pick an at-risk transformer, scrub the heatwave evening, toggle
   Unmanaged vs Managed to watch the hot-spot stay under the 110°C limit.
4. **Method & limits** — what is real, what is assumed.

## Source layout

```
index.html / greentrafo.html   the built, runnable prototype (identical files)
src/
  engine.js       synthetic feeder + load shapes + IEEE C57.91 thermal model
  optimize.js     Plan (NSGA-II multi-objective) + Protect (valley-fill scheduler)
  app.jsx         React UI: dark hero + light app (map, Pareto, replay, green panel)
  head.html       HTML shell, Schneider-green theme + dark hero styles, CDN tags
build.md          how the single file is assembled from src/
```

`engine.js` and `optimize.js` are plain ES modules; import and run them in Node directly.

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

A dark, cinematic landing hero in Schneider "Life Green" (#3DCD58), then a clean light app
for the map and charts (chosen for legibility of the risk-coloured feeder). Transformer
risk bands use separate colours (green/amber/orange/red) so "green outcome" never collides
with "healthy transformer".
