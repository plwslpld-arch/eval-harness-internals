# Scope and Non-goals

## Target scope

| Area | Included responsibility |
|---|---|
| Standards | Quality dimensions, risk taxonomy, baselines, policy, and ownership |
| Eval Core | Tasks, datasets, execution, scorers, judges, reports, and extensibility |
| Measurement | Sampling, uncertainty, power, confidence intervals, effect sizes, and paired comparisons |
| LLM-as-Judge | Rubrics, calibration, position and length bias, agreement, and human comparison |
| Human Evaluation | Annotation protocols, sampling, blind review, adjudication, and agreement |
| Agent Environment Harness | Provisioning, reset, tool control, state assertions, trajectories, fault injection, and replay |
| Security and Red Team | Threat modeling, adversarial cases, prompt injection, exfiltration, permissions, and regression |
| Quality Gates | Pull request, CI/CD, canary, release, rollback, waiver, and audit evidence |
| Observability | Drift, hallucination, bias, safety, latency, cost, and incident monitoring |
| Governance | Roles, approvals, evidence chains, exceptions, risk acceptance, and review cadence |
| Eval-to-RL | Failure mining, preference data, verifiers, rewards, curriculum data, and exports |
| Integrations | Models, agent frameworks, CI/CD, telemetry, data stores, and reporting systems |
| Academy | Lessons, labs, assessments, capstones, and competency evidence |

## Product boundary

Evalorium owns the path from risk and quality requirements to measured evidence and release decisions. It may integrate with model providers, training systems, agent runtimes, and observability platforms without replacing them.

## Non-goals

Evalorium is not:

- a general model training platform;
- a generic model inference server;
- a consumer chatbot;
- a Claude Code, Codex, or other coding-agent replacement;
- a general-purpose agent runtime;
- a dashboard-only observability product;
- a benchmark leaderboard without release and risk context.

## Current scope state

This document defines the target boundary. At present, the Academy foundation and repository quality system are being implemented; Platform runtime capabilities remain planned until code and validation evidence exist.
