# Project Maturity Model

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
| Repository quality foundation | `implemented` | Versioned validator, tests, and brand renderer | CI evidence is added later in the same foundation milestone |
| Academy | `learning` | A1.1 is the active unit | No unit has passed assessment |
| Platform | `planned` | Vision, scope, architecture, and roadmap | No runtime implementation exists |
| Agent Environment Harness | `planned` | Defined target boundary | No executable environment harness exists |
| Production adoption | not claimed | None | Requires external organizational evidence |

## State transition rule

A state advances only when the evidence is committed, linked, reproducible, and still valid. If evidence is removed, becomes stale, or no longer supports the claim, the state must be downgraded or explicitly qualified.
