# Project Maturity Model

<!-- evalorium-progress current=A1.9 current_status=not_started last_completed=A1.8 last_status=artifact_validated -->

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
| Academy | `learning` | A1.1–A1.7 and [A1.8](../academy/phase-a/chapter-a1/unit-a1-8/README.md) public artifact contracts validated; A1.8 has three cases, nine templates, 151 local tests, and exact-candidate [remote run 31439279582](https://github.com/plwslpld-arch/evalorium/actions/runs/31439279582) for [`9c4fd46`](https://github.com/plwslpld-arch/evalorium/commit/9c4fd4641dc59c795b270192465ce469c14e3540); A1.9 is not started | The gate proves only the public quality-baseline, Gate DAG, evidence-manifest, decision, waiver, release-disposition, and production-response contracts. It does not prove a real evaluation, AI release gate, deployment authorization, production outcome, or personal competency; no A1.9 placeholder exists |
| Platform | `planned` | Vision, scope, architecture, and roadmap | No runtime implementation exists |
| Agent Environment Harness | `planned` | Defined target boundary | No executable environment harness exists |
| Production adoption | not claimed | None | Requires external organizational evidence |

## State transition rule

A state advances only when the evidence is committed, linked, reproducible, and still valid. If evidence is removed, becomes stale, or no longer supports the claim, the state must be downgraded or explicitly qualified.
