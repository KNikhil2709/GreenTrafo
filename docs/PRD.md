# GreenTrafo PRD: Green Thermal-Life Budgeting for Grid Reliability

> Product requirements. For what the prototype implements, see [`../STATUS.md`](../STATUS.md).
> Rendered version with diagrams:
> https://claude.ai/code/artifact/676d1b22-a7f9-429e-8c7a-693f21ad72d1

## 1. Overview and vision

GreenTrafo treats each distribution transformer's thermal life as a budget, and helps a
DISCOM spend that budget before summer and protect it during peak evenings.

**One-line pitch:** *Make India's grid greener and more reliable by making every distribution
transformer last longer.*

Two modules on one shared simulation engine:
- **Plan (pre-summer):** which transformers to upgrade, load-balance or back up with a mobile
  unit, under a fixed capex budget.
- **Protect (peak evening):** shift flexible EV and AC load so unfixed transformers stay
  inside their loss-of-life budget, without breaking users' departure-time needs.

**Why it is green** (each measured in-sim, not assumed): fewer premature failures → fewer
replacement units; fewer overload outages → fewer diesel-generator hours; more rooftop solar
and EV hosting headroom; flexible charging moved off the (least-green) evening peak.

**Status:** hackathon prototype for Yuva Yodha Energy Tech Hackathon 2026, Grid Reliability.
All data is synthetic.

## 2. Problem and green rationale

Most Indian summer outages originate in the distribution network, not generation. A 2026 CEA
advisory names overloaded distribution transformers and feeders, inadequate capacity,
overloaded LT networks, voltage drop and ageing equipment as the main causes.

**The advisory asks DISCOMs to** review loading by February and flag DTs/feeders above 80%
(power transformers above 75%); upgrade assets above 90% without delay; identify vulnerable
assets ≥ 6 months ahead; and account for growing AC use beyond sanctioned load.

**Where it breaks down:** before summer, a fixed threshold ignores unsanctioned growth and
load shape, and doesn't prioritise under a limited budget; during summer, unfixed
transformers run unprotected as evening AC peaks meet falling solar and rising EV load.

**Existing tools** (ADMS, One Digital Grid Platform, EVlink) work on digitised networks or
building-side load. No public tool treats a neighbourhood transformer's thermal life as one
shared budget across planning and operations — the gap GreenTrafo targets.

**Green rationale:** premature failure wastes manufactured material and triggers diesel use,
and caps solar/EV hosting. An older BIS document estimates DT failure at 12–15% (2021,
indicative).

## 3. Goals, non-goals and success metrics

**Success:** on a simulated suburb, thermal-life-aware decisions beat the 80/90 threshold
policy at equal cost.

**Goals:** reliability (fewer overload hours and loss-of-life at equal capex); green
(quantify avoided replacements, diesel hours, peak kWh shifted); user fairness (EV on-time
share ≥ 95%); explainability (plain-language reason per recommendation).

**Non-goals:** no hardware/sensors/real integration; no claim of real-network validity; no
real-time charger control; no tariff/billing; no quantum/causal-ML claims.

**Success metrics** (vs threshold baseline): overload hours ↓, loss-of-life ↓, capex to
equal reliability ↓, EV on-time share ≥ 95%, evening-peak kWh shifted ↑, diesel hours
avoided ↑. Report measured deltas only.

## 4. Users and personas

Primary: DISCOM planning engineer (annual summer-preparedness list + capex defence) and
control-room operator (get through peak evenings). Secondary: sustainability/regulatory lead
(report outcomes), EV owner (vehicle ready by departure), and the hackathon judge (usefulness
and credibility).

## 5. User journeys

**Plan (Jan–Feb):** load suburb → set budget + scenario → run optimiser → pick a profile →
compare with 80/90 plan → change budget, watch warm-start re-plan.

**Protect (peak evening):** replay from 5pm → at-risk transformers flagged → Protect proposes
a flexible-load schedule → operator sees trade-offs → summary reports green outcomes. A
feedback loop feeds realised hot runs into the next Plan.

## 6. MVP scope

One synthetic suburb (~40 transformers), one Plan flow, one Protect flow, one baseline
comparison. **Must:** feeder + loads + IEEE C57.91 thermal model, threshold baseline,
multi-objective Plan optimiser, Protect scheduler, map dashboard + Pareto + replay + green
panel. **Should:** warm-start re-plan, load-growth uncertainty, plain-language explanations.
**Could:** OpenDSS LV validation, CSV/PDF export, rooftop-solar scenario. **Out of scope:**
LT topology inference, cold storage, irrigation, flexibility baselines.

## 7. Functional requirements

**Engine (ENG-1..5):** reproducible feeder; 15-min load + EV profiles; loading via power
flow; IEEE C57.91 thermal + ageing + loss-of-life; deterministic per seed.
**Plan (PLN-1..5):** accept budget + scenario; Pareto front over 3 objectives; name 3
profiles; run 80/90 baseline at equal budget; warm-start re-plan < 5s.
**Protect (PRT-1..4):** schedule within thermal limit; respect departure/energy; handle
departure uncertainty; compare vs unmanaged and ToU.
**UI (UI-1..5):** risk-coloured map + time slider; interactive Pareto; green-outcomes panel;
assumptions/limits panel; label every result as simulated.

## 8–15. Technical design, data, validation, build, risks, demo, Schneider fit

These sections (technical design, synthetic-data spec, validation plan, non-functional
requirements, build plan, risks, 4-minute demo script, and Schneider ecosystem fit) are in
the rendered PRD artifact linked at the top. The key points:

- **Stack:** Python + pandapower (power flow), own IEEE C57.91 model, NSGA-II (Plan), cvxpy
  (Protect), scikit-learn (forecasting), FastAPI, React + Vite.
- **Data:** all synthetic and seeded, calibrated to CEA/BIS statistics; one config file.
- **Validation:** physics check, calibration, Plan vs baseline (30 seeds), Protect vs
  unmanaged/ToU, robustness.
- **Risks:** synthetic-data realism (biggest), runtime, Schneider overlap, scope creep.
- **Demo (4 min):** hook → Plan + baseline → re-plan → Protect replay → green outcomes →
  honest limits.
- **Schneider fit:** complements ADMS, DERMS and EVlink at the transformer level; does not
  duplicate outage restoration or building-side load management.

See [`../STATUS.md`](../STATUS.md) for which of these are built in the prototype.
