# Project Maturity Model

<!-- evalorium-progress current=A1.7 current_status=not_started last_completed=A1.6 last_status=artifact_validated -->

Evalorium separates intent from evidence. Every capability uses one of five states.

| State | Required evidence | Claims that remain prohibited |
|---|---|---|
| `planned` | Approved scope or design | Implemented, usable, tested, validated |
| `learning` | Active study, experiments, or implementation work | Completed, stable, production-ready |
| `implemented` | Runnable artifact and relevant automated tests | Scientifically validated, externally adopted |
| `validated` | Reproducible benchmark, statistical analysis, security review, or user validation | Production-proven without real deployment evidence |
| `production-proven` | Real deployment, accountable owner, incident history, and measured outcome | Universal effectiveness outside observed contexts |

## Current status

| Area | State | Evidence | Limitation |
|---|---|---|---|
| Repository quality foundation | `implemented` | Versioned validator, tests, brand renderer, and GitHub Actions quality gate | The gate validates repository contracts; it is not evidence of a production AI runtime |
| Academy | `learning` | A1.1–A1.5 and [A1.6](../academy/phase-a/chapter-a1/unit-a1-6/README.md) public artifact contracts validated; A1.6 has three cases, eight templates, 130 local tests, and exact-candidate [remote run 31393199383](https://github.com/plwslpld-arch/evalorium/actions/runs/31393199383) for [`dfd0c77`](https://github.com/plwslpld-arch/evalorium/commit/dfd0c77ad95f6c1c20f6011454bd626b9e2824f5); A1.7 is not started | The gate proves only the public scorer design, identity, evidence-traceability, and quality-readiness contract. It does not prove materialized A1.5 data, a real scorer implementation or calibration, trials, Scores, Metrics, a Harness, statistical inference, a system Gate, production outcomes, or personal competency; no A1.7 placeholder exists |
| Platform | `planned` | Vision, scope, architecture, and roadmap | No runtime implementation exists |
| Agent Environment Harness | `planned` | Defined target boundary | No executable environment harness exists |
| Production adoption | not claimed | None | Requires external organizational evidence |

## State transition rule

A state advances only when the evidence is committed, linked, reproducible, and still valid. If evidence is removed, becomes stale, or no longer supports the claim, the state must be downgraded or explicitly qualified.
