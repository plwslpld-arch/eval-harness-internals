# Project Maturity Model

<!-- evalorium-progress current=A2.2 current_status=not_started last_completed=A2.1 last_status=artifact_validated -->

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
| Academy | `learning` | Chapter A1 and [A2.1 — 从抽象质量到可测量构念](../academy/phase-a/chapter-a2/unit-a2-1/README.md) public artifact contracts validated. Chapter A2 is 《测量理论、效度与可靠性》; A2.1 has eight templates, three synthetic cases, 188 local tests, and exact-candidate [remote run 31492987925](https://github.com/plwslpld-arch/evalorium/actions/runs/31492987925) for [`9e5f8c7`](https://github.com/plwslpld-arch/evalorium/commit/9e5f8c722b83560517709eb90ca383719f28d580) | The gate proves only the public measurement-design, construct, proxy, error, reliability/validity planning, and trace contract. It does not prove real measurement, observed reliability or validity, production readiness, release authorization, or personal competency; A2.2 is not started and has no placeholder |
| Platform | `planned` | Vision, scope, architecture, and roadmap | No runtime implementation exists |
| Agent Environment Harness | `planned` | Defined target boundary | No executable environment harness exists |
| Production adoption | not claimed | None | Requires external organizational evidence |

## State transition rule

A state advances only when the evidence is committed, linked, reproducible, and still valid. If evidence is removed, becomes stale, or no longer supports the claim, the state must be downgraded or explicitly qualified.
