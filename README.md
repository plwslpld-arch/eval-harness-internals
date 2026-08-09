<!-- evalorium-progress current=A1.2 current_status=in_progress last_completed=A1.1 last_status=artifact_validated -->

<p align="center">
  <img src="docs/assets/brand/evalorium-logo.svg" alt="Evalorium" width="420">
</p>

<p align="center"><strong>Evidence before release.</strong></p>

<p align="center">
  Open-source enterprise AI quality engineering for models, RAG systems, agents, and multi-agent systems.
</p>

<p align="center">
  English · <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://github.com/plwslpld-arch/evalorium/actions/workflows/docs-quality.yml"><img src="https://github.com/plwslpld-arch/evalorium/actions/workflows/docs-quality.yml/badge.svg" alt="Documentation Quality"></a>
</p>

> **Current status — Academy foundation.** The learning and evidence system is under construction. The Platform described below is a target architecture, not a claim that production software is already available.

## What Evalorium is

Evalorium is an open-source quality engineering platform that turns AI requirements and risks into reproducible evaluations, release gates, production monitoring, governance evidence, and improvement data.

Most evaluation tools answer a narrow question: *how did a model score on this dataset?* Evalorium is designed around the broader enterprise decision: *is there enough reliable evidence to release this AI system, keep it in production, and improve it safely?*

## Principles

- **Evidence before release** — quality claims must be traceable to tests, measurements, and limitations.
- **Uncertainty-aware** — estimates include sampling, model, judge, and execution uncertainty.
- **System-level** — evaluate the complete model, retrieval, tools, memory, environment, and policy boundary.
- **Risk-driven** — capability, reliability, safety, bias, security, cost, and operational risks share one decision model.
- **Reproducible** — tasks, environments, versions, traces, and gates are replayable and auditable.
- **No maturity without proof** — planned, implemented, validated, and production-proven are different states.

## Two connected tracks

| Track | Purpose | Current state |
|---|---|---|
| **Academy** | Publish validated learning artifacts and support separate competency evidence | Learning |
| **Platform** | Implement the methods as an enterprise evaluation and quality control plane | Planned |

Public Academy artifacts follow a strict unit gate:

```text
study → explain with cases → curate publishable artifacts → verify → commit → next unit
```

Curriculum maps may be planned in advance. A unit is published only when its formal course, engineering templates, examples, HTML, and validation contract are committed and verified. Artifact delivery does not claim personal mastery; competency claims require separate evidence at the claimed level.

## Target capability map

| Capability | Responsibility |
|---|---|
| Standards | Quality models, risk taxonomy, baselines, and release policy |
| Eval Core | Tasks, datasets, runners, solvers, scorers, judges, and reports |
| Measurement | Sampling, uncertainty, confidence intervals, effect sizes, and significance |
| LLM-as-Judge | Calibration, bias detection, reliability, and human comparison |
| Human Evaluation | Annotation design, sampling, adjudication, and agreement |
| Agent Environment Harness | Controlled environments, tools, state assertions, traces, and fault injection |
| Security and Red Team | Threat models, adversarial generation, permissions, and regression suites |
| Quality Gates | Pull-request, CI/CD, canary, release, and exception decisions |
| Observability | Quality drift, hallucination, bias, latency, cost, and incident signals |
| Governance | Ownership, approvals, evidence chains, audit, and risk acceptance |
| Eval-to-RL | Failure mining, preference data, verifiers, rewards, and training exports |
| Academy | Formal lessons, experiments, assessments, and capstones |

See the [target architecture](docs/ARCHITECTURE.md) and [scope boundary](docs/SCOPE.md).

## Agent Environment Harness

The Agent Environment Harness is a deep core capability inside Evalorium. It will provision and reset environments, expose controlled tools, capture trajectories, inject failures, inspect final state, and score whether an agent truly completed a task safely and reliably.

It evaluates agent products. It is not itself a Claude Code-style general coding-agent runtime.

## Eval-to-RL loop

```text
evaluations and production incidents
  → failure clusters and hard cases
  → human preferences, verifiers, and reward signals
  → training or policy improvement
  → regression evaluation and release gates
```

## Current maturity

| Area | State | Evidence |
|---|---|---|
| Repository and brand foundation | Implemented | Versioned assets and local validation |
| Academy curriculum | Learning | A1.1 public artifact contract validated; A1.2 is active |
| Platform runtime | Planned | Design and roadmap only |
| Production adoption | Not claimed | Requires external organizational evidence |

Read the [project maturity model](docs/PROJECT_MATURITY.md) before interpreting any capability claim.

## Learning scope

The full program targets:

- 8 phases
- 29 core chapters
- at least 138 knowledge units
- 8 phase capstones
- 1 enterprise capstone

The scope is not reduced to fit a one-month learning rhythm. Time is a pacing constraint, not a reason to remove content or evidence.

## Documentation

- [Documentation index](docs/README.md)
- [Vision](docs/VISION.md)
- [Scope and non-goals](docs/SCOPE.md)
- [Target architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Project maturity](docs/PROJECT_MATURITY.md)
- [Mastery standard](docs/MASTERY_STANDARD.md)
- [Job competency map](docs/JD_COMPETENCY_MAP.md)
- [Brand guide](docs/BRAND.md)
- [Resume work on another computer](START_HERE.md)
- [Cross-device GitHub execution protocol](docs/workflows/cross-device-github.md)

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes. Report security issues through the process in [SECURITY.md](SECURITY.md). Community participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

Apache License 2.0. See [LICENSE](LICENSE).
