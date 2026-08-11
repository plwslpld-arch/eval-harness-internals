# Project Maturity Model

<!-- evalorium-progress current=A2.1 current_status=not_started last_completed=A1.9 last_status=artifact_validated -->

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
| Academy | `learning` | A1.1–A1.8 and [A1.9](../academy/phase-a/chapter-a1/unit-a1-9/README.md) public artifact contracts validated; A1.9 has three synthetic cases, ten contracts, 163 local tests, and exact-candidate [remote run 31451972040](https://github.com/plwslpld-arch/evalorium/actions/runs/31451972040) for [`5e19133`](https://github.com/plwslpld-arch/evalorium/commit/5e191339200528e82ae01c54cc099dbbf6d85631). Chapter A1 is complete; A2.1 is not started | The gate proves only public run-identity, Trial/Attempt, Trace, lineage, recovery, budget, adapter, and audit contracts. It does not prove a live distributed Harness, production integration, release authorization, production outcome, or personal competency; no A2.1 placeholder exists |
| Platform | `planned` | Vision, scope, architecture, and roadmap | No runtime implementation exists |
| Agent Environment Harness | `planned` | Defined target boundary | No executable environment harness exists |
| Production adoption | not claimed | None | Requires external organizational evidence |

## State transition rule

A state advances only when the evidence is committed, linked, reproducible, and still valid. If evidence is removed, becomes stale, or no longer supports the claim, the state must be downgraded or explicitly qualified.
