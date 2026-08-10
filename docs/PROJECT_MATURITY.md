# Project Maturity Model

<!-- evalorium-progress current=A1.5 current_status=not_started last_completed=A1.4 last_status=artifact_validated -->

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
| Academy | `learning` | A1.1–A1.3 and [A1.4](../academy/phase-a/chapter-a1/unit-a1-4/README.md) public artifact contracts validated; A1.4 has three cases, six templates, 64 local tests, and [remote run 31361998848](https://github.com/plwslpld-arch/evalorium/actions/runs/31361998848); A1.5 is not started | No executable Harness result, scientific outcome validation, or personal competency assessment is claimed by artifact delivery; no A1.5 placeholder exists |
| Platform | `planned` | Vision, scope, architecture, and roadmap | No runtime implementation exists |
| Agent Environment Harness | `planned` | Defined target boundary | No executable environment harness exists |
| Production adoption | not claimed | None | Requires external organizational evidence |

## State transition rule

A state advances only when the evidence is committed, linked, reproducible, and still valid. If evidence is removed, becomes stale, or no longer supports the claim, the state must be downgraded or explicitly qualified.
