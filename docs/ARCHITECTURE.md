# Target Architecture

> This is a target architecture. It describes intended module boundaries and does not claim that the Platform runtime is already implemented.

## Evidence flow

```text
risk and requirements
  → standards and test design
  → datasets, tasks, environments, solvers, scorers
  → statistical measurement and uncertainty
  → quality gate and release decision
  → production telemetry and incidents
  → regression cases, preference data, verifiers, and RL exports
```

## Module boundaries

### Standards

Consumes business context, user harm analysis, regulatory constraints, and system architecture. Produces quality dimensions, risk classes, minimum baselines, ownership, and gate policy. It depends on governance decisions but not on a specific model provider.

Failure modes include vague requirements, unowned risks, metrics without decisions, and universal thresholds that ignore use-case severity.

### Eval Core

Consumes versioned tasks, datasets, system adapters, environments, and scorers. Produces structured samples, traces, metrics, artifacts, and execution metadata. Extension boundaries include model adapters, solvers, scorers, storage, environments, and reporters.

Failure modes include hidden nondeterminism, data leakage, non-reproducible dependencies, invalid retries, and incomplete provenance.

### Measurement

Consumes sample-level outcomes and experimental design metadata. Produces estimates, uncertainty intervals, paired comparisons, effect sizes, power analysis, and sensitivity results.

Failure modes include treating correlated samples as independent, ignoring judge variance, reporting only means, and using significance without practical effect.

### Judge and Human Evaluation

Consumes rubrics, candidate outputs, reference context, and blind comparison designs. Produces calibrated judgments, agreement measures, bias studies, adjudicated labels, and limitation reports.

Failure modes include position bias, verbosity bias, evaluator leakage, ambiguous rubrics, low agreement, and circular self-preference.

### Agent Environment Harness

Consumes agent builds, task definitions, environment images, tool policies, budgets, and state assertions. Produces provisioned sandboxes, trajectories, tool events, final-state evidence, failure injection results, and replay artifacts.

Extension boundaries include environment providers, tool protocols, approval policies, state inspectors, and trajectory scorers. Failure modes include state leakage, unsafe tools, incomplete reset, observation gaps, and scoring only the final message instead of the environment.

### Security and Red Team

Consumes threat models, attack grammars, protected assets, permissions, and known incidents. Produces adversarial suites, attack traces, exploitability evidence, mitigations, and security regression gates.

Failure modes include unrealistic attacks, missing asset definitions, tests that expose secrets, and measuring refusal while ignoring tool-side effects.

### Quality Gates

Consumes baselines, candidate results, uncertainty, risk severity, waivers, and release context. Produces pass, fail, warn, require-review, or exception decisions with evidence.

Failure modes include brittle single thresholds, silent exceptions, unverifiable baselines, and gates disconnected from rollback capability.

### Observability and Governance

Consumes production traces, feedback, incidents, sampled outputs, deployment versions, and ownership metadata. Produces drift signals, incident records, audit trails, risk reviews, and new regression cases.

Failure modes include unrepresentative sampling, alert fatigue, privacy leakage, missing version correlation, and metrics without accountable owners.

### Eval-to-RL

Consumes failure clusters, adjudicated preferences, verifier outcomes, traces, and policy constraints. Produces training datasets, reward or verifier exports, curricula, and post-training regression suites.

Failure modes include reward hacking, biased preference data, contaminated holdouts, and optimizing a proxy without regression protection.

## Academy relationship

Academy establishes the reasoning and empirical evidence behind Platform decisions. Units are not mass-generated in advance. Each completed unit follows learning, explanation, practice, assessment, post-pass documentation, verification, and commit.
