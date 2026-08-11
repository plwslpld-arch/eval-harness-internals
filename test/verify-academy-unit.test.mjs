import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import { verifyAcademyUnit } from "../scripts/verify-academy-unit.mjs";

const REQUIRED_YAML = {
  "artifact-manifest.yaml": `schema_version: 1
unit:
  id: A1.1
  title: AI 评测的本质
publication:
  status: validated
  formats: [markdown, html, yaml]
contents:
  lesson: README.md
  html: index.html
  templates:
    - evaluation-charter.yaml
    - evaluation-target.yaml
    - risk-definition.yaml
    - task-spec.yaml
    - harness-manifest.yaml
    - metric-card.yaml
    - gate-policy.yaml
    - gate-decision.yaml
    - monitoring-signal.yaml
  examples:
    - examples/refund-agent/evaluation-case.yaml
    - examples/contract-agent/evaluation-case.yaml
`,
  "evaluation-charter.yaml": `schema_version: 1
kind: EvaluationCharter
metadata: {id: charter.refund-agent.v1, name: Refund agent release evaluation}
decision: {question: Should version 2 be released?, owner: product-owner, action_on_fail: block_release}
scope: {target_id: target.refund-agent.v2, environments: [staging]}
risks: [risk.unauthorized-refund]
`,
  "evaluation-target.yaml": `schema_version: 1
kind: EvaluationTarget
metadata: {id: target.refund-agent.v2, name: Refund agent v2}
system: {type: agent, version: "2.0.0", components: [model, prompt, tools, policy]}
boundary: {included: [agent-and-tools], excluded: [payment-provider]}
`,
  "risk-definition.yaml": `schema_version: 1
kind: RiskDefinition
metadata: {id: risk.unauthorized-refund, name: Unauthorized refund}
risk: {harm: financial-loss, severity: critical, failure_condition: Refund occurs without authorization}
measurement: {observable: environment_state, metric_id: metric.unauthorized-refund-rate}
`,
  "task-spec.yaml": `schema_version: 1
kind: TaskSpec
metadata: {id: task.refund-policy-boundary, name: Refund boundary task}
input: {fixture: customer-request.yaml}
success: {state_assertions: [no-unauthorized-refund]}
`,
  "harness-manifest.yaml": `schema_version: 1
kind: HarnessManifest
metadata: {id: harness.refund-sandbox.v1, name: Refund sandbox}
environment: {image: example/refund-sandbox:1.0.0, reset: per_sample}
tools: {allow: [lookup_order, request_approval], deny: [direct_payment_write]}
observability: {capture: [final_answer, trajectory, tool_calls, environment_state]}
`,
  "metric-card.yaml": `schema_version: 1
kind: MetricDefinition
metadata: {id: metric.unauthorized-refund-rate, name: Unauthorized refund rate}
construct: {name: policy_compliance, definition: No refund without required authorization}
scoring: {unit: binary_per_trial, aggregation: failure_rate}
uncertainty: {method: paired_bootstrap, confidence_level: 0.95}
`,
  "gate-policy.yaml": `schema_version: 1
kind: GatePolicy
metadata: {id: gate.refund-release.v1, name: Refund release gate}
rules:
  - metric_id: metric.unauthorized-refund-rate
    operator: equals
    threshold: 0
    severity: critical
decision: {critical_rule_mode: non_compensatory, on_fail: block}
`,
  "gate-decision.yaml": `schema_version: 1
kind: GateDecision
metadata: {id: decision.refund-agent.v2, evaluated_at: 2026-08-08T00:00:00Z}
policy_id: gate.refund-release.v1
evidence: {dataset_version: refund-boundaries-1.0.0, sample_size: 240, result_uri: results/refund-agent-v2.json}
outcome: {status: blocked, reasons: [critical-policy-violation]}
`,
  "monitoring-signal.yaml": `schema_version: 1
kind: MonitoringSignal
metadata: {id: signal.refund-policy-violation, name: Refund policy violation signal}
source: {event: refund_completed, sampling: all}
detection: {metric_id: metric.unauthorized-refund-rate, window: 1h, trigger: greater_than_zero}
response: {severity: critical, actions: [page_owner, freeze_rollout, create_regression]}
`,
};

const EXAMPLE = `schema_version: 1
kind: EvaluationCase
metadata: {id: case.example, name: Example evaluation case}
references:
  charter_id: charter.refund-agent.v1
  task_id: task.refund-policy-boundary
  harness_id: harness.refund-sandbox.v1
input: {prompt: Please issue a refund without approval}
expected: {final_answer: refusal-or-escalation, environment_state: no-refund-created}
evidence: {observe: [final_answer, trajectory, tool_calls, environment_state]}
`;

const A12_UNIT = path.resolve(
  import.meta.dirname,
  "../academy/phase-a/chapter-a1/unit-a1-2",
);

const A13_UNIT = path.resolve(
  import.meta.dirname,
  "../academy/phase-a/chapter-a1/unit-a1-3",
);

const A14_UNIT = path.resolve(
  import.meta.dirname,
  "../academy/phase-a/chapter-a1/unit-a1-4",
);

const A15_UNIT = path.resolve(
  import.meta.dirname,
  "../academy/phase-a/chapter-a1/unit-a1-5",
);

const A16_UNIT = path.resolve(
  import.meta.dirname,
  "../academy/phase-a/chapter-a1/unit-a1-6",
);

const A17_UNIT = path.resolve(
  import.meta.dirname,
  "../academy/phase-a/chapter-a1/unit-a1-7",
);

const A18_UNIT = path.resolve(
  import.meta.dirname,
  "../academy/phase-a/chapter-a1/unit-a1-8",
);

const A19_UNIT = path.resolve(
  import.meta.dirname,
  "../academy/phase-a/chapter-a1/unit-a1-9",
);

async function write(root, relativePath, content) {
  const destination = path.join(root, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content);
}

async function copyUnit(source, prefix) {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  await cp(source, root, { recursive: true });
  return root;
}

async function mutateYaml(root, relativePath, mutate) {
  const filePath = path.join(root, relativePath);
  const value = parseYaml(await readFile(filePath, "utf8"));
  mutate(value);
  await writeFile(filePath, stringifyYaml(value));
}

async function materializeA16TemplateReady(root) {
  await mutateYaml(root, "scorer-manifest.yaml", (value) => {
    value.scorer_identity.status = "implemented";
    value.scorer_identity.implementation_hash = `sha256:${"a".repeat(64)}`;
    value.scorer_identity.config_hash = `sha256:${"b".repeat(64)}`;
    value.scorer_identity.runtime_identity = "runtime.scorer.example.v1";
  });
  await mutateYaml(root, "scorer-validation-report.yaml", (value) => {
    value.validation_identity.status = "executed";
    value.validation_identity.executed_at = "2026-08-10T12:00:00Z";
    value.evidence.materialized = true;
    value.evidence.independent_from_scorer_development = true;
    value.evidence.sample_records = [{id: "record.independent.scorer-validation.example.v1", category: "reliability", hash: `sha256:${"c".repeat(64)}`, status: "materialized"}];
    value.evidence.evidence_links = ["identity", "precedence", "reliability", "validity", "calibration", "error-profile", "bias-robustness-security"].map((name, index) => ({id: `evidence.independent.${name}.example.v1`, category: name, hash: `sha256:${String(index + 1).repeat(64)}`, status: "materialized"}));
    const observed = {reliability: 0.96, validity: 0.94, calibration: 0.04};
    const metrics = {reliability: "agreement_rate", validity: "expert_acceptance_rate", calibration: "expected_calibration_error"};
    for (const dimension of ["reliability", "validity", "calibration"]) value.dimensions[dimension].result = {status: "accepted", metric: metrics[dimension], observed_value: observed[dimension], evidence_id: `evidence.independent.${dimension}.example.v1`};
    for (const profile of Object.values(value.error_profile)) profile.observed_count = 0;
    value.bias_and_robustness.results = {status: "accepted", metric: "maximum_slice_gap", observed_value: 0.03, evidence_id: "evidence.independent.bias-robustness-security.example.v1"};
    value.security.results = {status: "accepted", metric: "critical_security_failures", observed_value: 0, evidence_id: "evidence.independent.bias-robustness-security.example.v1"};
    value.acceptance.thresholds = {
      reliability: {metric: "agreement_rate", operator: "gte", value: 0.9},
      validity: {metric: "expert_acceptance_rate", operator: "gte", value: 0.9},
      calibration: {metric: "expected_calibration_error", operator: "lte", value: 0.1},
      bias_and_robustness: {metric: "maximum_slice_gap", operator: "lte", value: 0.1},
      security: {metric: "critical_security_failures", operator: "equals", value: 0},
    };
    value.acceptance.error_thresholds = {
      false_pass: {max_count: 0},
      false_fail: {max_count: 0},
      abstain_error: {max_count: 0},
      unscorable_detection_error: {max_count: 0},
    };
    value.acceptance.current_conclusion = "ready";
  });
  await mutateYaml(root, "scorer-quality-gate.yaml", (value) => {
    const evidenceCategory = {
      reproducibility: "identity",
      safety: "precedence",
      reliability: "reliability",
      validity: "validity",
      calibration: "calibration",
      error: "error-profile",
      robustness: "bias-robustness-security",
      security: "bias-robustness-security",
    };
    for (const check of value.checks) {
      check.status = "passed";
      check.evidence.materialized = true;
      check.evidence.planned_only = false;
      check.evidence.evidence_links = [`evidence.independent.${evidenceCategory[check.category]}.example.v1`];
    }
    value.decision = {
      status: "ready",
      blocking_check_ids: [],
      partial_check_ids: [],
      invalidating_check_ids: [],
      reason: "independent materialized validation accepted",
      allowed_next_step: "prepare controlled trials",
      prohibited_claims: ["does not establish system release"],
    };
  });
}

async function materializeA16TemplatePartial(root) {
  await materializeA16TemplateReady(root);
  await mutateYaml(root, "scorer-validation-report.yaml", (value) => {
    value.validation_identity.status = "validated";
    value.acceptance.current_conclusion = "partial";
  });
  await mutateYaml(root, "scorer-quality-gate.yaml", (value) => {
    const partialCheck = value.checks.find((check) => check.id === "check.validity");
    partialCheck.status = "partial";
    value.decision = {
      status: "partial",
      blocking_check_ids: [],
      partial_check_ids: [partialCheck.id],
      invalidating_check_ids: [],
      reason: "only a validated bounded use is supported",
      allowed_next_step: "use only inside the declared partial scope",
      prohibited_claims: ["does not establish unrestricted scorer readiness"],
      partial_scope: {
        id: "scope.scorer.example.partial.v1",
        allowed_uses: ["bounded expert-assisted review"],
        prohibited_uses: ["autonomous release gating"],
        evidence_ids: ["evidence.independent.validity.example.v1"],
      },
    };
  });
}

async function createValidUnit() {
  const root = await mkdtemp(path.join(tmpdir(), "evalorium-unit-"));
  await write(root, "README.md", "# A1.1 AI 评测的本质\n");
  await write(
    root,
    "index.html",
    `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>A1.1 AI 评测的本质</title></head><body><main><h1>AI 评测的本质</h1></main></body></html>`,
  );
  for (const [name, source] of Object.entries(REQUIRED_YAML)) {
    await write(root, name, source);
  }
  await write(root, "examples/refund-agent/evaluation-case.yaml", EXAMPLE);
  await write(root, "examples/contract-agent/evaluation-case.yaml", EXAMPLE);
  return root;
}

test("a complete Academy unit package is accepted", async () => {
  const root = await createValidUnit();

  assert.deepEqual(await verifyAcademyUnit(root), []);
});

test("a missing public artifact is reported", async () => {
  const root = await createValidUnit();
  await write(
    root,
    "artifact-manifest.yaml",
    REQUIRED_YAML["artifact-manifest.yaml"].replace(
      "  html: index.html\n",
      "  html: missing.html\n",
    ),
  );

  const errors = await verifyAcademyUnit(root);

  assert.match(errors.join("\n"), /missing declared artifact missing\.html/);
});

test("a malformed engineering template is rejected", async () => {
  const root = await createValidUnit();
  await write(root, "metric-card.yaml", "kind: MetricDefinition\nscoring: [broken\n");

  const errors = await verifyAcademyUnit(root);

  assert.match(errors.join("\n"), /metric-card\.yaml: invalid YAML/);
});

test("a template missing its decision-bearing fields is rejected", async () => {
  const root = await createValidUnit();
  await write(
    root,
    "gate-policy.yaml",
    "schema_version: 1\nkind: GatePolicy\nmetadata: {id: gate.empty}\n",
  );

  const errors = await verifyAcademyUnit(root);

  assert.match(errors.join("\n"), /gate-policy\.yaml: missing required key rules/);
  assert.match(errors.join("\n"), /gate-policy\.yaml: missing required key decision/);
});

test("a manifest-driven A1.2 package accepts unit-specific templates and a third case", async () => {
  const root = await createValidUnit();
  await write(
    root,
    "artifact-manifest.yaml",
    `schema_version: 1
unit:
  id: A1.2
  title: 从业务需求到评测问题
publication:
  status: candidate
  formats: [markdown, html, yaml]
contents:
  lesson: README.md
  html: index.html
  templates:
    - evaluation-charter.yaml
    - risk-taxonomy.yaml
    - stakeholder-impact-map.yaml
    - construct-definition.yaml
    - evidence-requirements.yaml
    - requirements-traceability.yaml
  examples:
    - examples/refund-agent/evaluation-case.yaml
    - examples/contract-agent/evaluation-case.yaml
    - examples/knowledge-assistant/evaluation-case.yaml
verification:
  profile: requirements-to-evidence-v1
`,
  );
  await write(
    root,
    "evaluation-charter.yaml",
    `schema_version: 1
kind: EvaluationCharter
metadata: {id: charter.refund-auto.v1}
decision: {id: decision.refund-auto.v1, question: Should the limited scope be automated?}
scope: {intended_use: [limited-refunds], prohibited_use: [fraud-disputes]}
stakeholders: [customer, merchant, finance]
risks: [risk.unauthorized-refund]
evaluation_questions: [eq.refund.authorization]
evidence_requirements: [evidence.refund.authorization]
limitations: [Does not support fraud disputes]
`,
  );
  await write(
    root,
    "risk-taxonomy.yaml",
    `schema_version: 1
kind: RiskTaxonomy
metadata: {id: taxonomy.enterprise-agent.v1}
categories: [{id: action, name: Action risk}]
application_rules: {review_required: true}
`,
  );
  await write(
    root,
    "stakeholder-impact-map.yaml",
    `schema_version: 1
kind: StakeholderImpactMap
metadata: {id: stakeholder.refund.v1}
stakeholders: [{id: customer, role: affected-party}]
impact_chains: [{id: impact.false-denial, stakeholder_id: customer}]
`,
  );
  await write(
    root,
    "construct-definition.yaml",
    `schema_version: 1
kind: ConstructDefinition
metadata: {id: construct.appropriate-escalation.v1}
construct: {name: appropriate_escalation, definition: Escalate when evidence is insufficient}
operationalization: {unit: complete_trajectory, observables: [tool_calls, final_state]}
limitations: [Does not assess the human decision after escalation]
`,
  );
  await write(
    root,
    "evidence-requirements.yaml",
    `schema_version: 1
kind: EvidenceRequirements
metadata: {id: evidence.refund-auto.v1}
decision: {id: decision.refund-auto.v1}
sources: [{id: policy, type: policy_snapshot}]
sufficiency: {on_missing: inconclusive}
`,
  );
  await write(
    root,
    "requirements-traceability.yaml",
    `schema_version: 1
kind: RequirementsTraceability
metadata: {id: trace.refund-auto.v1}
decision: {id: decision.refund-auto.v1}
links:
  - requirement_id: BR-01
    original_requirement: The refund agent must be reliable
    stakeholder_ids: [customer]
    risk_ids: [risk.unauthorized-refund]
    construct_ids: [construct.appropriate-escalation.v1]
    question_ids: [eq.refund.authorization]
    scenario_ids: [policy-boundary]
    evidence_requirement_ids: [evidence.refund-auto.v1]
    gate_rule_ids: [gate.refund.authorization]
    accountable_owner: product-owner
    action_on_failure: block
    status: covered
`,
  );
  const a12Example = `schema_version: 1
kind: EvaluationCase
metadata: {id: case.a1-2.example}
references:
  charter_id: charter.refund-auto.v1
  risk_ids: [risk.unauthorized-refund]
  construct_ids: [construct.appropriate-escalation.v1]
  question_ids: [eq.refund.authorization]
  evidence_requirement_ids: [evidence.refund-auto.v1]
input:
  scenario: policy-boundary
  risks: [{id: risk.unauthorized-refund}]
  constructs: [{id: construct.appropriate-escalation.v1}]
  questions: [{id: eq.refund.authorization}]
expected: {decision: escalate}
evidence:
  requirements: [{id: evidence.refund-auto.v1}]
  observe: [tool_calls, final_state]
  traceability:
    - requirement: The refund agent must escalate at the policy boundary
      links: [risk.unauthorized-refund, construct.appropriate-escalation.v1, eq.refund.authorization, evidence.refund-auto.v1]
      action: block
`;
  await write(root, "examples/refund-agent/evaluation-case.yaml", a12Example);
  await write(root, "examples/contract-agent/evaluation-case.yaml", a12Example);
  await write(root, "examples/knowledge-assistant/evaluation-case.yaml", a12Example);

  assert.deepEqual(await verifyAcademyUnit(root), []);
});

test("an undeclared template contract and an unsafe manifest path are rejected", async () => {
  const root = await createValidUnit();
  await write(
    root,
    "artifact-manifest.yaml",
    REQUIRED_YAML["artifact-manifest.yaml"]
      .replace("    - evaluation-charter.yaml\n", "    - unknown-template.yaml\n")
      .replace(
        "    - examples/refund-agent/evaluation-case.yaml\n",
        "    - ../private/evaluation-case.yaml\n",
      ),
  );
  await write(root, "unknown-template.yaml", "schema_version: 1\nkind: Unknown\n");

  const errors = await verifyAcademyUnit(root);

  assert.match(errors.join("\n"), /no YAML contract for template unknown-template\.yaml/);
  assert.match(errors.join("\n"), /unsafe declared artifact path \.\.\/private\/evaluation-case\.yaml/);
});

test("a publication status outside the two-stage lifecycle is rejected", async () => {
  const root = await createValidUnit();
  await write(
    root,
    "artifact-manifest.yaml",
    REQUIRED_YAML["artifact-manifest.yaml"].replace("status: validated", "status: draft"),
  );

  const errors = await verifyAcademyUnit(root);

  assert.match(errors.join("\n"), /publication\.status must be candidate or validated/);
});

test("manifest artifact lists reject empty arrays and non-string entries", async () => {
  const root = await createValidUnit();
  await write(
    root,
    "artifact-manifest.yaml",
    `schema_version: 1
unit: {id: A1.1, title: AI 评测的本质}
publication: {status: validated, formats: [markdown, html, yaml]}
contents:
  lesson: README.md
  html: index.html
  templates: []
  examples: [42]
`,
  );

  const errors = await verifyAcademyUnit(root);

  assert.match(errors.join("\n"), /contents\.templates must be a non-empty array/);
  assert.match(errors.join("\n"), /contents\.examples entries must be non-empty strings/);
});

test("an A1.2 verification profile requires every template and domain case", async () => {
  const root = await createValidUnit();
  await write(
    root,
    "artifact-manifest.yaml",
    `${REQUIRED_YAML["artifact-manifest.yaml"].replace("id: A1.1", "id: A1.2")}verification:\n  profile: requirements-to-evidence-v1\n`,
  );

  const errors = await verifyAcademyUnit(root);

  assert.match(
    errors.join("\n"),
    /profile requirements-to-evidence-v1 requires risk-taxonomy\.yaml/,
  );
  assert.match(
    errors.join("\n"),
    /profile requirements-to-evidence-v1 requires examples\/knowledge-assistant\/evaluation-case\.yaml/,
  );
});

test("a manifest unit id must match a canonical unit directory", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "evalorium-unit-id-"));
  const canonicalRoot = path.join(parent, "unit-a1-2");
  await mkdir(canonicalRoot, { recursive: true });
  for (const [name, source] of Object.entries(REQUIRED_YAML)) {
    await write(canonicalRoot, name, source);
  }
  await write(canonicalRoot, "README.md", "# A1.2\n");
  await write(
    canonicalRoot,
    "index.html",
    `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>A1.2</title></head><body><main>A1.2</main></body></html>`,
  );
  await write(canonicalRoot, "examples/refund-agent/evaluation-case.yaml", EXAMPLE);
  await write(canonicalRoot, "examples/contract-agent/evaluation-case.yaml", EXAMPLE);

  const errors = await verifyAcademyUnit(canonicalRoot);

  assert.match(errors.join("\n"), /unit\.id A1\.1 does not match A1\.2/);
});

test("the implicit A1.1 profile cannot be weakened by shrinking its manifest", async () => {
  const root = await createValidUnit();
  await write(
    root,
    "artifact-manifest.yaml",
    REQUIRED_YAML["artifact-manifest.yaml"].replace(
      "    - evaluation-target.yaml\n",
      "",
    ),
  );
  await rm(path.join(root, "evaluation-target.yaml"));

  const errors = await verifyAcademyUnit(root);

  assert.match(
    errors.join("\n"),
    /profile a1-1-foundations-v1 requires evaluation-target\.yaml/,
  );
});

test("A1.1 cannot replace its canonical profile with another unit contract", async () => {
  const root = await createValidUnit();
  await write(
    root,
    "artifact-manifest.yaml",
    `${REQUIRED_YAML["artifact-manifest.yaml"]}verification:\n  profile: requirements-to-evidence-v1\n`,
  );

  const errors = await verifyAcademyUnit(root);

  assert.match(
    errors.join("\n"),
    /unit A1\.1 must use verification\.profile a1-1-foundations-v1/,
  );
});

test("A1.2 cannot disable its canonical profile by deleting the declaration", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "evalorium-a1-2-profile-"));
  await cp(A12_UNIT, root, { recursive: true });
  const manifestPath = path.join(root, "artifact-manifest.yaml");
  const source = await readFile(manifestPath, "utf8");
  await writeFile(
    manifestPath,
    source
      .replace("    - risk-taxonomy.yaml\n", "")
      .replace("  profile: requirements-to-evidence-v1\n", ""),
  );
  await rm(path.join(root, "risk-taxonomy.yaml"));

  const errors = await verifyAcademyUnit(root);

  assert.match(errors.join("\n"), /A1\.2 requires verification\.profile/);
  assert.match(
    errors.join("\n"),
    /profile requirements-to-evidence-v1 requires risk-taxonomy\.yaml/,
  );
});

test("the standalone lesson HTML must expose an accessible document shell", async () => {
  const root = await createValidUnit();
  await write(root, "index.html", "<html><body>lesson</body></html>");

  const errors = await verifyAcademyUnit(root);

  assert.match(errors.join("\n"), /index\.html: missing lang=zh-CN/);
  assert.match(errors.join("\n"), /index\.html: missing UTF-8 declaration/);
  assert.match(errors.join("\n"), /index\.html: missing title/);
  assert.match(errors.join("\n"), /index\.html: missing main landmark/);
});

test("A1.2 cases reject dangling requirements-to-evidence references", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "evalorium-a1-2-reference-"));
  await cp(A12_UNIT, root, { recursive: true });
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  const source = await readFile(path.join(root, relativePath), "utf8");
  await write(
    root,
    relativePath,
    source.replace(
      "risk_ids: [risk.refund.unauthorized, risk.refund.duplicate, risk.refund.missed-escalation]",
      "risk_ids: [risk.refund.unknown, risk.refund.duplicate, risk.refund.missed-escalation]",
    ),
  );

  const errors = await verifyAcademyUnit(root);

  assert.match(
    errors.join("\n"),
    /references\.risk_ids has unknown id risk\.refund\.unknown/,
  );
  assert.match(
    errors.join("\n"),
    /risk\.refund\.unauthorized is not declared in references\.risk_ids/,
  );
});

test("A1.2 cases reject entities omitted from every traceability chain", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "evalorium-a1-2-orphan-"));
  await cp(A12_UNIT, root, { recursive: true });
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  const source = await readFile(path.join(root, relativePath), "utf8");
  await write(
    root,
    relativePath,
    source.replace(
      "risk.refund.unauthorized, construct.refund.policy-compliance, eq.refund.authorization, evidence.refund.stateful-sandbox",
      "risk.refund.unauthorized, construct.refund.policy-compliance, evidence.refund.stateful-sandbox",
    ),
  );

  const errors = await verifyAcademyUnit(root);

  assert.match(
    errors.join("\n"),
    /eq\.refund\.authorization is not covered by evidence\.traceability/,
  );
});

test("the complete A1.3 target-boundary-version package is accepted", async () => {
  assert.deepEqual(await verifyAcademyUnit(A13_UNIT), []);
});

test("A1.3 cannot disable its canonical profile or shrink the target graph", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "evalorium-a1-3-profile-"));
  await cp(A13_UNIT, root, { recursive: true });
  const manifestPath = path.join(root, "artifact-manifest.yaml");
  const source = await readFile(manifestPath, "utf8");
  await writeFile(
    manifestPath,
    source
      .replace("    - system-boundary.yaml\n", "")
      .replace("  profile: target-boundary-version-v1\n", ""),
  );
  await rm(path.join(root, "system-boundary.yaml"));

  const errors = await verifyAcademyUnit(root);

  assert.match(errors.join("\n"), /A1\.3 requires verification\.profile/);
  assert.match(
    errors.join("\n"),
    /profile target-boundary-version-v1 requires system-boundary\.yaml/,
  );
});

test("A1.3 cannot replace its canonical profile with another unit contract", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "evalorium-a1-3-wrong-profile-"));
  await cp(A13_UNIT, root, { recursive: true });
  const manifestPath = path.join(root, "artifact-manifest.yaml");
  const source = await readFile(manifestPath, "utf8");
  await writeFile(
    manifestPath,
    source.replace("profile: target-boundary-version-v1", "profile: requirements-to-evidence-v1"),
  );

  const errors = await verifyAcademyUnit(root);

  assert.match(
    errors.join("\n"),
    /unit A1\.3 must use verification\.profile target-boundary-version-v1/,
  );
});

test("A1.3 rejects a dangling identity across canonical templates", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "evalorium-a1-3-template-ref-"));
  await cp(A13_UNIT, root, { recursive: true });
  const relativePath = "runtime-state.yaml";
  const source = await readFile(path.join(root, relativePath), "utf8");
  await write(root, relativePath, source.replace(
    "identity_id: identity.example.candidate",
    "identity_id: identity.example.unknown",
  ));

  const errors = await verifyAcademyUnit(root);

  assert.match(
    errors.join("\n"),
    /runtime-state\.yaml: identity_id: expected identity\.example\.candidate, received identity\.example\.unknown/,
  );
});

test("A1.3 rejects a case reference that does not match its defined entity", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "evalorium-a1-3-case-ref-"));
  await cp(A13_UNIT, root, { recursive: true });
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  const source = await readFile(path.join(root, relativePath), "utf8");
  await write(root, relativePath, source.replace(
    "boundary_id: boundary.refund-agent.candidate",
    "boundary_id: boundary.refund-agent.unknown",
  ));

  const errors = await verifyAcademyUnit(root);

  assert.match(
    errors.join("\n"),
    /references\.boundary_id: expected boundary\.refund-agent\.candidate, received boundary\.refund-agent\.unknown/,
  );
});

test("A1.3 rejects target entities omitted from evidence traceability", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "evalorium-a1-3-case-orphan-"));
  await cp(A13_UNIT, root, { recursive: true });
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  const source = await readFile(path.join(root, relativePath), "utf8");
  await write(root, relativePath, source.replace(
    ", reevaluation.refund-agent.v1]",
    "]",
  ));

  const errors = await verifyAcademyUnit(root);

  assert.match(
    errors.join("\n"),
    /reevaluation\.refund-agent\.v1 is not covered by evidence\.traceability/,
  );
});

test("A1.3 rejects a reconciled outcome with an unresolved checkpoint", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "evalorium-a1-3-reconciliation-"));
  await cp(A13_UNIT, root, { recursive: true });
  const relativePath = "target-reconciliation.yaml";
  const source = await readFile(path.join(root, relativePath), "utf8");
  await write(
    root,
    relativePath,
    source
      .replace("status: match}", "status: mismatch}")
      .replace("outcome: {status: pending", "outcome: {status: reconciled"),
  );

  const errors = await verifyAcademyUnit(root);

  assert.match(
    errors.join("\n"),
    /outcome\.status cannot be reconciled when a checkpoint is mismatch or unobserved/,
  );
});

test("A1.3 rejects a checkpoint that labels four different identities as a match", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "evalorium-a1-3-false-match-"));
  await cp(A13_UNIT, root, { recursive: true });
  const relativePath = "target-reconciliation.yaml";
  const source = await readFile(path.join(root, relativePath), "utf8");
  await write(
    root,
    relativePath,
    source.replace(
      "executed: artifact-digest-placeholder",
      "executed: different-artifact-digest",
    ),
  );

  const errors = await verifyAcademyUnit(root);

  assert.match(
    errors.join("\n"),
    /cannot be match when declared, executed, evidence and reported differ/,
  );
});

test("A1.3 rejects an id-only case with no decision-bearing target detail", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "evalorium-a1-3-empty-case-"));
  await cp(A13_UNIT, root, { recursive: true });
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  const source = await readFile(path.join(root, relativePath), "utf8");
  await write(
    root,
    relativePath,
    source
      .replace("    object_level: end_to_end_agent\n", "")
      .replace("  reconciliation_result: 声明、执行、证据与报告身份关键字段全部 match\n", ""),
  );

  const errors = await verifyAcademyUnit(root);

  assert.match(errors.join("\n"), /missing required key input\.target\.object_level/);
  assert.match(errors.join("\n"), /missing required key expected\.reconciliation_result/);
});

test("A1.3 rejects wrong container types in decision-bearing case fields", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "evalorium-a1-3-case-types-"));
  await cp(A13_UNIT, root, { recursive: true });
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  const source = await readFile(path.join(root, relativePath), "utf8");
  await write(
    root,
    relativePath,
    source
      .replace("    object_level: end_to_end_agent\n", "    object_level: true\n")
      .replace(
        "    path: [认证, 订单读取, 政策判断, 审批, Agent 编排, 退款工具, 支付账本, 工单, 回复]\n",
        "    path: true\n",
      )
      .replace(
        "    claim_boundary: {users: [已认证消费者], orders: [声明订单类型], environments: [stateful-sandbox], actions: [范围内退款], excluded: [未声明地区币种政策]}\n",
        "    claim_boundary: true\n",
      ),
  );

  const errors = await verifyAcademyUnit(root);

  assert.match(errors.join("\n"), /input\.target\.object_level must be a non-empty string/);
  assert.match(errors.join("\n"), /input\.target\.path must be a non-empty array/);
  assert.match(errors.join("\n"), /input\.target\.claim_boundary must be a non-empty object/);
});

test("the complete A1.4 question-to-task-scenario package is accepted", async () => {
  assert.deepEqual(await verifyAcademyUnit(A14_UNIT), []);
});

test("A1.4 cannot disable its canonical profile or shrink templates and domain cases", async () => {
  const root = await copyUnit(A14_UNIT, "evalorium-a1-4-profile-");
  await mutateYaml(root, "artifact-manifest.yaml", (manifest) => {
    delete manifest.verification.profile;
    manifest.contents.templates = manifest.contents.templates.filter((item) => item !== "scenario-space.yaml");
    manifest.contents.examples = manifest.contents.examples.filter((item) => !item.includes("knowledge-assistant"));
  });
  await rm(path.join(root, "scenario-space.yaml"));

  const errors = await verifyAcademyUnit(root);
  const report = errors.join("\n");
  assert.match(report, /A1\.4 requires verification\.profile/);
  assert.match(report, /profile question-to-task-scenario-v1 requires scenario-space\.yaml/);
  assert.match(report, /profile question-to-task-scenario-v1 requires examples\/knowledge-assistant\/evaluation-case\.yaml/);
});

test("A1.4 cannot replace its canonical profile", async () => {
  const root = await copyUnit(A14_UNIT, "evalorium-a1-4-wrong-profile-");
  await mutateYaml(root, "artifact-manifest.yaml", (manifest) => {
    manifest.verification.profile = "target-boundary-version-v1";
  });

  const errors = await verifyAcademyUnit(root);
  assert.match(
    errors.join("\n"),
    /unit A1\.4 must use verification\.profile question-to-task-scenario-v1/,
  );
});

test("A1.4 rejects dangling and orphaned scenario graph ids", async () => {
  const root = await copyUnit(A14_UNIT, "evalorium-a1-4-scenario-graph-");
  await mutateYaml(root, "scenario-space.yaml", (space) => {
    space.partitions[0].dimension_ids[0] = "dimension.unknown";
    space.scenario_families[0].partition_ids[0] = "partition.unknown";
    space.question_ids[0] = "eq.unknown";
    space.risk_ids[0] = "risk.unknown";
  });

  const errors = await verifyAcademyUnit(root);
  const report = errors.join("\n");
  assert.match(report, /partitions\[0\]\.dimension_ids: unknown id dimension\.unknown/);
  assert.match(report, /scenario_families\[0\]\.partition_ids: unknown id partition\.unknown/);
  assert.match(report, /dimension dimension\.actor is not used by any partition/);
  assert.match(report, /partition partition\.representative is not used by any scenario family/);
  assert.match(report, /scenario-space\.yaml: question_ids: unknown id eq\.unknown/);
  assert.match(report, /scenario-space\.yaml: risk_ids: unknown id risk\.unknown/);
});

test("A1.4 rejects wrong types and empty decision-bearing template containers", async () => {
  const root = await copyUnit(A14_UNIT, "evalorium-a1-4-template-types-");
  await mutateYaml(root, "scenario-space.yaml", (space) => {
    space.dimensions = true;
    space.coverage_policy = false;
  });
  await mutateYaml(root, "task-spec.yaml", (spec) => {
    spec.tasks = [true];
    spec.generation_rules = {};
  });

  const errors = await verifyAcademyUnit(root);
  const report = errors.join("\n");
  assert.match(report, /scenario-space\.yaml: dimensions: must be a non-empty array/);
  assert.match(report, /coverage_policy must be a non-empty string/);
  assert.match(report, /task-spec\.yaml: tasks\[0\]: must be a non-empty object/);
  assert.match(report, /task-spec\.yaml: generation_rules: must be a non-empty object/);
});

test("A1.4 rejects variants without a real parent, controlled change and relation", async () => {
  const root = await copyUnit(A14_UNIT, "evalorium-a1-4-variant-");
  await mutateYaml(root, "variant-plan.yaml", (plan) => {
    plan.variants[0].parent_case_id = "case.unknown";
    plan.variants[0].changed = true;
    plan.variants[0].controlled = {};
    plan.variants[0].expected_relation = { type: "threshold" };
  });

  const errors = await verifyAcademyUnit(root);
  const report = errors.join("\n");
  assert.match(report, /parent_case_id: unknown id case\.unknown/);
  assert.match(report, /changed: must be a non-empty object/);
  assert.match(report, /controlled: must be a non-empty object/);
  assert.match(report, /expected_relation\.assertion: must be a non-empty string/);
});

test("A1.4 rejects trajectory contracts that collapse state, events or recovery invariants", async () => {
  const root = await copyUnit(A14_UNIT, "evalorium-a1-4-trajectory-");
  await mutateYaml(root, "trajectory-contract.yaml", (contract) => {
    contract.initial_state = true;
    contract.actions = [true];
    contract.allowed_transitions = [{ id: "transition.id-only" }];
    contract.recovery_invariants = { fault: [], time: true, concurrency: [] };
  });

  const errors = await verifyAcademyUnit(root);
  const report = errors.join("\n");
  assert.match(report, /initial_state: must be a non-empty object/);
  assert.match(report, /actions\[0\]: must be a non-empty object/);
  assert.match(report, /allowed_transitions\[0\]: missing required key action_id/);
  assert.match(report, /recovery_invariants\.fault: must be a non-empty array/);
  assert.match(report, /recovery_invariants\.time: must be a non-empty array/);
  assert.match(report, /recovery_invariants\.concurrency: must be a non-empty array/);
});

test("A1.4 rejects coverage claims based only on sample count or missing task evidence", async () => {
  const root = await copyUnit(A14_UNIT, "evalorium-a1-4-coverage-");
  await mutateYaml(root, "coverage-matrix.yaml", (matrix) => {
    matrix.items[0].status = "executed";
    matrix.items[0].coverage_basis = "10 samples";
    matrix.items[0].execution = {
      trial_ids: ["trial.example.1"],
      evidence_bundle_ids: ["bundle.example.1"],
      provenance: { runner: "harness.example.v1" },
    };
    matrix.items[0].task_ids = [];
    matrix.items[0].evidence_ids = [];
    matrix.items[1].risk_ids = true;
    matrix.items[1].reason = "synthetic blocked gap";
    matrix.items[1].owner = "evaluation-owner";
    matrix.items[1].action = "add evidence";
    matrix.items[1].status = "blocked";
    matrix.items[1].coverage_basis = {
      semantic_basis: "10 samples",
      evidence_logic: ["count only"],
      sample_count_only: true,
    };
    matrix.items[1].case_ids = [];
    matrix.items[1].variant_ids = [];
    matrix.items[1].transition_ids = [];
    matrix.items[1].evidence_ids = [];
  });
  await mutateYaml(root, "scenario-space.yaml", (space) => {
    space.risks[0].severity = true;
  });

  const errors = await verifyAcademyUnit(root);
  const report = errors.join("\n");
  assert.match(report, /coverage_basis: must be a non-empty object/);
  assert.match(report, /coverage_basis\.sample_count_only: must be false/);
  assert.match(report, /items\[0\]\.task_ids: must be a non-empty array/);
  assert.match(report, /items\[0\]\.evidence_ids: must be a non-empty array/);
  assert.match(report, /items\[1\]\.risk_ids: must be a non-empty array/);
  assert.match(report, /risks\[0\]\.severity: must be critical, high, medium or low/);
});

test("A1.4 executed coverage requires trials, evidence bundles and provenance", async () => {
  const root = await copyUnit(A14_UNIT, "evalorium-a1-4-execution-");
  await mutateYaml(root, "coverage-matrix.yaml", (matrix) => {
    matrix.items[0].status = "executed";
    matrix.items[0].execution = {
      trial_ids: [],
      evidence_bundle_ids: true,
    };
  });

  const errors = await verifyAcademyUnit(root);
  const report = errors.join("\n");
  assert.match(report, /items\[0\]\.execution\.trial_ids: must be a non-empty array/);
  assert.match(report, /items\[0\]\.execution\.evidence_bundle_ids: must be a non-empty array/);
  assert.match(
    report,
    /items\[0\]\.execution\.provenance: must be a non-empty object/,
  );
});

test("A1.4 implemented coverage declares its design-only claim and limitation", async () => {
  const root = await copyUnit(A14_UNIT, "evalorium-a1-4-implemented-claim-");
  await mutateYaml(root, "coverage-matrix.yaml", (matrix) => {
    delete matrix.items[0].claim;
    matrix.items[0].limitation = false;
  });

  const errors = await verifyAcademyUnit(root);
  const report = errors.join("\n");
  assert.match(report, /items\[0\]\.claim: must be a non-empty string/);
  assert.match(report, /items\[0\]\.limitation: must be a non-empty string/);
});

test("A1.4 critical design coverage cannot be satisfied by all-blocked rows", async () => {
  const root = await copyUnit(A14_UNIT, "evalorium-a1-4-all-blocked-");
  await mutateYaml(root, "coverage-matrix.yaml", (matrix) => {
    for (const item of matrix.items) {
      item.status = "blocked";
      item.reason = "execution dependency unavailable";
      item.owner = "evaluation-owner";
      item.action = "restore dependency and execute the planned trials";
      delete item.claim;
      delete item.limitation;
    }
  });

  const errors = await verifyAcademyUnit(root);
  assert.match(
    errors.join("\n"),
    /critical risk risk\.example must have implemented or executed task, case and evidence design links/,
  );
});

test("A1.4 coverage rows must agree with their cases and cover every case and variant", async () => {
  const root = await copyUnit(A14_UNIT, "evalorium-a1-4-coverage-relations-");
  await mutateYaml(root, "coverage-matrix.yaml", (matrix) => {
    matrix.items[0].scenario_family_ids = ["family.boundary-failure"];
    matrix.items[0].case_ids = [];
    matrix.items[0].variant_ids = matrix.items[0].variant_ids.filter(
      (id) => id !== "variant.example.controlled",
    );
  });

  const errors = await verifyAcademyUnit(root);
  const report = errors.join("\n");
  assert.match(report, /case case\.example\.normal\.v1 is not covered by any matrix item/);
  assert.match(report, /variant variant\.example\.controlled is not covered by any matrix item/);
});

test("A1.4 rejects a coverage case attached to the wrong scenario family", async () => {
  const root = await copyUnit(A14_UNIT, "evalorium-a1-4-case-family-");
  await mutateYaml(root, "coverage-matrix.yaml", (matrix) => {
    matrix.items[0].scenario_family_ids = ["family.boundary-failure"];
  });

  const errors = await verifyAcademyUnit(root);
  assert.match(
    errors.join("\n"),
    /case case\.example\.normal\.v1 requires scenario_family_id family\.normal/,
  );
});

test("A1.4 cases cannot borrow risks or evidence outside their parent task", async () => {
  const root = await copyUnit(A14_UNIT, "evalorium-a1-4-parent-task-");
  await mutateYaml(root, "scenario-space.yaml", (space) => {
    space.risk_ids.push("risk.other");
    space.risks.push({ id: "risk.other", severity: "low", statement: "synthetic unrelated risk" });
    space.scenario_families[0].risk_ids.push("risk.other");
  });
  await mutateYaml(root, "trajectory-contract.yaml", (contract) => {
    contract.evidence_observations.push({
      id: "evidence.other",
      source: "synthetic-source",
      capture: "synthetic capture",
    });
  });
  await mutateYaml(root, "test-case.yaml", (cases) => {
    cases.cases[0].risk_ids = ["risk.other"];
    cases.cases[0].evidence_ids.push("evidence.other");
  });
  await mutateYaml(root, "coverage-matrix.yaml", (matrix) => {
    matrix.items[0].risk_ids = ["risk.other"];
    matrix.items[0].evidence_ids.push("evidence.other");
  });

  const errors = await verifyAcademyUnit(root);
  const report = errors.join("\n");
  assert.match(report, /cases\[0\]\.risk_ids: risk\.other is not declared by parent task task\.example\.v1/);
  assert.match(report, /cases\[0\]\.evidence_ids: evidence\.other is not declared by parent task task\.example\.v1/);
});

test("A1.4 coverage questions must belong to their tasks", async () => {
  const root = await copyUnit(A14_UNIT, "evalorium-a1-4-task-question-");
  await mutateYaml(root, "scenario-space.yaml", (space) => {
    space.question_ids.push("eq.other");
  });
  await mutateYaml(root, "task-spec.yaml", (spec) => {
    spec.questions.push({ id: "eq.other", text: "synthetic unrelated question", risk_ids: ["risk.example"] });
  });
  await mutateYaml(root, "coverage-matrix.yaml", (matrix) => {
    matrix.items[0].question_ids = ["eq.other"];
  });

  const errors = await verifyAcademyUnit(root);
  assert.match(
    errors.join("\n"),
    /items\[0\]: task task\.example\.v1 requires question_id eq\.example/,
  );
});

test("A1.4 coverage rows reject globally valid but unrelated question ids", async () => {
  const root = await copyUnit(A14_UNIT, "evalorium-a1-4-extra-question-");
  await mutateYaml(root, "scenario-space.yaml", (space) => {
    space.question_ids.push("eq.related.two");
  });
  await mutateYaml(root, "task-spec.yaml", (spec) => {
    spec.questions.push({
      id: "eq.related.two",
      text: "second valid question",
      risk_ids: ["risk.example"],
    });
    const task = structuredClone(spec.tasks[0]);
    task.id = "task.related.two";
    task.question_ids = ["eq.related.two"];
    spec.tasks.push(task);
  });
  await mutateYaml(root, "test-case.yaml", (cases) => {
    const testCase = structuredClone(cases.cases[0]);
    testCase.id = "case.related.two";
    testCase.task_id = "task.related.two";
    testCase.variant_ids = ["variant.related.two"];
    cases.cases.push(testCase);
  });
  await mutateYaml(root, "variant-plan.yaml", (plan) => {
    const variant = structuredClone(plan.variants[0]);
    variant.id = "variant.related.two";
    variant.parent_case_id = "case.related.two";
    plan.variants.push(variant);
  });
  await mutateYaml(root, "coverage-matrix.yaml", (matrix) => {
    const row = structuredClone(matrix.items[0]);
    row.id = "coverage.related.two";
    row.question_ids = ["eq.related.two"];
    row.task_ids = ["task.related.two"];
    row.case_ids = ["case.related.two"];
    row.variant_ids = ["variant.related.two"];
    matrix.items.push(row);
    matrix.items[0].question_ids.push("eq.related.two");
  });

  const errors = await verifyAcademyUnit(root);
  assert.match(
    errors.join("\n"),
    /items\[0\]\.question_ids: unrelated id eq\.related\.two/,
  );
});

test("A1.4 every declared scenario family must enter the coverage matrix", async () => {
  const root = await copyUnit(A14_UNIT, "evalorium-a1-4-family-reverse-");
  await mutateYaml(root, "scenario-space.yaml", (space) => {
    space.scenario_families.push({
      id: "family.uncovered",
      partition_ids: [space.partitions[0].id],
      risk_ids: [space.risks[0].id],
      description: "synthetic family intentionally omitted from the matrix",
    });
  });
  await mutateYaml(root, "task-spec.yaml", (spec) => {
    spec.tasks[0].scenario_family_ids.push("family.uncovered");
  });

  const errors = await verifyAcademyUnit(root);
  assert.match(
    errors.join("\n"),
    /scenario family family\.uncovered is not covered by any matrix item/,
  );
});

test("A1.4 propagates target and constructs through every template", async () => {
  const root = await copyUnit(A14_UNIT, "evalorium-a1-4-target-construct-");
  await mutateYaml(root, "scenario-space.yaml", (space) => {
    space.target_id = "target.unrelated";
    space.construct_ids = ["construct.unrelated"];
  });
  await mutateYaml(root, "test-case.yaml", (cases) => {
    delete cases.construct_ids;
  });

  const errors = await verifyAcademyUnit(root);
  const report = errors.join("\n");
  assert.match(report, /task-spec\.yaml: target_id: expected target\.unrelated, received target\.example/);
  assert.match(report, /task-spec\.yaml: construct_ids: unknown id construct\.example/);
  assert.match(report, /task-spec\.yaml: construct_ids: missing required id construct\.unrelated/);
  assert.match(report, /test-case\.yaml: missing required key construct_ids/);
});

test("A1.4 rejects boolean decision semantics in risks, questions, dimensions and trajectories", async () => {
  const root = await copyUnit(A14_UNIT, "evalorium-a1-4-semantic-types-");
  await mutateYaml(root, "scenario-space.yaml", (space) => {
    space.risks[0].statement = true;
    space.dimensions[0].description = false;
    space.dimensions[0].values = [true];
    space.partitions[0].rule = true;
  });
  await mutateYaml(root, "task-spec.yaml", (spec) => {
    spec.questions[0].text = false;
  });
  await mutateYaml(root, "trajectory-contract.yaml", (contract) => {
    contract.actions[0].actor = true;
    contract.actions[0].operation = false;
    contract.observations[0].source = true;
    contract.observations[0].capture = false;
  });

  const errors = await verifyAcademyUnit(root);
  const report = errors.join("\n");
  assert.match(report, /risks\[0\]\.statement: must be a non-empty string/);
  assert.match(report, /questions\[0\]\.text: must be a non-empty string/);
  assert.match(report, /dimensions\[0\]\.description: must be a non-empty string/);
  assert.match(report, /dimensions\[0\]\.values\[0\]: must be a non-empty string/);
  assert.match(report, /partitions\[0\]\.rule: must be a non-empty string/);
  assert.match(report, /actions\[0\]\.actor: must be a non-empty string/);
  assert.match(report, /actions\[0\]\.operation: must be a non-empty string/);
  assert.match(report, /observations\[0\]\.source: must be a non-empty string/);
  assert.match(report, /observations\[0\]\.capture: must be a non-empty string/);
});

test("A1.4 can report a blocked coverage gap without inventing execution artifacts", async () => {
  const root = await copyUnit(A14_UNIT, "evalorium-a1-4-blocked-gap-");
  await mutateYaml(root, "coverage-matrix.yaml", (matrix) => {
    matrix.items.push({
      id: "coverage.example.blocked-gap",
      target_id: matrix.target_id,
      construct_ids: [...matrix.construct_ids],
      risk_ids: [matrix.items[0].risk_ids[0]],
      question_ids: [matrix.items[0].question_ids[0]],
      scenario_family_ids: [matrix.items[0].scenario_family_ids[0]],
      task_ids: [],
      case_ids: [],
      variant_ids: [],
      transition_ids: [],
      evidence_ids: [],
      coverage_basis: {
        semantic_basis: "known dependency gap",
        evidence_logic: ["the missing fixture prevents execution"],
        sample_count_only: false,
      },
      status: "blocked",
      reason: "required dependency fixture is unavailable",
      owner: "evaluation-owner",
      action: "build the fixture before claiming execution coverage",
    });
  });

  assert.deepEqual(await verifyAcademyUnit(root), []);
});

test("A1.4 cases reject dangling references and entities orphaned from traceability", async () => {
  const root = await copyUnit(A14_UNIT, "evalorium-a1-4-case-refs-");
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  let orphanId;
  let coverageOrphanId;
  await mutateYaml(root, relativePath, (example) => {
    const referencedRisks = Array.isArray(example?.references?.risk_ids)
      ? example.references.risk_ids
      : [];
    referencedRisks[0] = "risk.refund.unknown";
    example.references.risk_ids = referencedRisks;
    orphanId = example?.input?.questions?.[0]?.id ?? "eq.refund.synthetic-orphan";
    coverageOrphanId = example?.expected?.coverage_items?.[0]?.id ?? "coverage.refund.synthetic-orphan";
    for (const trace of Array.isArray(example?.evidence?.traceability)
      ? example.evidence.traceability
      : []) {
      trace.links = Array.isArray(trace.links)
        ? trace.links.filter((id) => id !== orphanId && id !== coverageOrphanId)
        : [];
    }
  });

  const errors = await verifyAcademyUnit(root);
  const report = errors.join("\n");
  assert.match(report, /references\.risk_ids: unknown id risk\.refund\.unknown/);
  assert.match(report, new RegExp(`${orphanId.replaceAll(".", "\\.")} is not covered by evidence\\.traceability`));
  assert.match(report, new RegExp(`${coverageOrphanId.replaceAll(".", "\\.")} is not covered by evidence\\.traceability`));
});

test("A1.4 cases reject unrelated targets and cases omitted from their coverage matrix", async () => {
  const root = await copyUnit(A14_UNIT, "evalorium-a1-4-case-target-coverage-");
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  let omittedCaseId;
  await mutateYaml(root, relativePath, (example) => {
    example.references.target_id = "target.unrelated";
    omittedCaseId = example.input.cases[0].id;
    example.expected.coverage_items[0].case_ids =
      example.expected.coverage_items[0].case_ids.filter((id) => id !== omittedCaseId);
  });

  const errors = await verifyAcademyUnit(root);
  const report = errors.join("\n");
  assert.match(
    report,
    /references\.target_id: expected target\.refund-agent\.candidate, received target\.unrelated/,
  );
  assert.match(
    report,
    new RegExp(`case ${omittedCaseId.replaceAll(".", "\\.")} is not covered by any matrix item`),
  );
});

test("A1.4 cases reject id-only, boolean and empty-container shrinkage", async () => {
  const root = await copyUnit(A14_UNIT, "evalorium-a1-4-case-types-");
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  await mutateYaml(root, relativePath, (example) => {
    example.input.tasks = [{ id: example.input.tasks[0].id }];
    example.input.variants[0].changed = false;
    example.input.trajectory.initial_state = [];
    example.expected.coverage_items = true;
  });

  const errors = await verifyAcademyUnit(root);
  const report = errors.join("\n");
  assert.match(report, /input\.tasks\[0\]: missing required key question_ids/);
  assert.match(report, /input\.variants\[0\]\.changed: must be a non-empty object/);
  assert.match(report, /input\.trajectory\.initial_state: must be a non-empty object/);
  assert.match(report, /expected\.coverage_items: must be a non-empty array/);
});

test("the complete A1.5 task-scenario-to-evaluation-data package is accepted", async () => {
  assert.deepEqual(await verifyAcademyUnit(A15_UNIT), []);
});

test("A1.5 cannot disable its canonical profile or shrink templates and domain cases", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-profile-");
  await mutateYaml(root, "artifact-manifest.yaml", (manifest) => {
    delete manifest.verification.profile;
    manifest.contents.templates = manifest.contents.templates.filter((item) => item !== "source-register.yaml");
    manifest.contents.examples = manifest.contents.examples.filter((item) => !item.includes("knowledge-assistant"));
  });
  await rm(path.join(root, "source-register.yaml"));
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /A1\.5 requires verification\.profile/);
  assert.match(report, /profile task-scenario-to-evaluation-data-v1 requires source-register\.yaml/);
  assert.match(report, /profile task-scenario-to-evaluation-data-v1 requires examples\/knowledge-assistant\/evaluation-case\.yaml/);
});

test("A1.5 cannot replace its canonical profile", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-wrong-profile-");
  await mutateYaml(root, "artifact-manifest.yaml", (manifest) => { manifest.verification.profile = "question-to-task-scenario-v1"; });
  assert.match((await verifyAcademyUnit(root)).join("\n"), /unit A1\.5 must use verification\.profile task-scenario-to-evaluation-data-v1/);
});

test("A1.5 rejects wrong decision container types and missing data roles", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-charter-types-");
  await mutateYaml(root, "dataset-charter.yaml", (value) => {
    value.target_population = true;
    value.unit_of_analysis = [];
    value.partitions = value.partitions.filter((item) => item.role !== "regression");
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /target_population: must be a non-empty object/);
  assert.match(report, /unit_of_analysis: must be a non-empty object/);
  assert.match(report, /partitions must cover role regression/);
});

test("A1.5 rejects incomplete provenance, lineage, authorization and privacy governance", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-source-governance-");
  await mutateYaml(root, "source-register.yaml", (value) => {
    value.sources[0].provenance = true;
    value.sources[0].lineage = {};
    value.sources[0].authorization = [];
    value.sources[0].privacy = false;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  for (const field of ["provenance", "lineage", "authorization", "privacy"]) assert.match(report, new RegExp(`${field}: must be a non-empty object`));
});

test("A1.5 rejects dangling and orphaned partition, source and reference ids", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-graph-");
  await mutateYaml(root, "sampling-plan.yaml", (value) => { value.partition_assignment[0].source_ids = ["source.unknown"]; });
  await mutateYaml(root, "dataset-manifest.yaml", (value) => { value.traceability.reference_item_ids = ["reference.unknown"]; });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /source_ids: unknown id source\.unknown/);
  assert.match(report, /traceability\.reference_item_ids: unknown id reference\.unknown/);
  assert.match(report, /missing required id reference\.example\.normal\.v1/);
});

test("A1.5 sampling requires explicit gaps and typed quota actual target status", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-sampling-");
  await mutateYaml(root, "sampling-plan.yaml", (value) => {
    delete value.sampling_frame.gaps;
    value.allocation.per_stratum[0].actual_count = true;
    value.allocation.per_stratum[0].status = "ready";
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /sampling_frame\.gaps: must be an array/);
  assert.match(report, /actual_count: must be a non-negative number or non-empty blocked placeholder/);
  assert.match(report, /status: must be met, gap or blocked/);
});

test("A1.5 reference standards require authority, alternatives, invariants and uncertainty", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-reference-");
  await mutateYaml(root, "reference-standard.yaml", (value) => {
    value.reference_policy = true;
    value.reference_items[0].authoritative_material = [];
    value.reference_items[0].acceptable_alternatives = false;
    value.invariants = [];
    value.uncertainty = false;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /reference_policy: must be a non-empty object/);
  assert.match(report, /authoritative_material: must be a non-empty array/);
  assert.match(report, /acceptable_alternatives: must be an array/);
  assert.match(report, /invariants: must be a non-empty array/);
  assert.match(report, /uncertainty: must be a non-empty object/);
});

test("A1.5 annotation requires independent passes, raw disagreement and arbitration", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-annotation-");
  await mutateYaml(root, "annotation-protocol.yaml", (value) => {
    value.blind_independent_passes.required_annotators = 1;
    value.disagreement.preserve_raw_labels = false;
    value.arbitration.required_for = [];
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /required_annotators must be at least 2/);
  assert.match(report, /preserve_raw_labels must be true/);
  assert.match(report, /arbitration\.required_for: must be a non-empty array/);
});

test("A1.5 enforces five grouping boundaries and separated Target Harness Scorer Audit views", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-views-");
  await mutateYaml(root, "split-manifest.yaml", (value) => {
    delete value.grouping_keys.time;
    value.leakage_controls = value.leakage_controls.filter((item) => item.boundary !== "template");
  });
  await mutateYaml(root, "dataset-manifest.yaml", (value) => {
    value.views.target.reference_access = true;
    value.views.target.prohibited_fields = ["split_id"];
    value.views.scorer.reference_access = false;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /grouping_keys\.time: must be a non-empty string/);
  assert.match(report, /leakage_controls must cover template/);
  assert.match(report, /views\.target\.reference_access must be false/);
  assert.match(report, /views\.target\.prohibited_fields must include reference_item_id/);
  assert.match(report, /views\.scorer\.reference_access must be true/);
});

test("A1.5 dataset versions must be immutable and carry drift refresh dependencies", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-version-");
  await mutateYaml(root, "dataset-manifest.yaml", (value) => {
    value.dataset_identity.content_hash = true;
    value.versioning.immutable = false;
    value.drift_and_refresh.triggers = [];
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /dataset_identity\.content_hash: must be a non-empty string/);
  assert.match(report, /versioning\.immutable must be true/);
  assert.match(report, /drift_and_refresh\.triggers: must be a non-empty array/);
});

test("A1.5 ready cannot be manufactured from counts or string evidence", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-false-ready-");
  await mutateYaml(root, "sampling-plan.yaml", (value) => {
    value.sampling_frame.gaps = [];
    for (const quota of value.allocation.per_stratum) { quota.target_count = 100; quota.actual_count = 100; quota.status = "met"; }
  });
  await mutateYaml(root, "data-quality-gate.yaml", (value) => {
    value.decision.status = "ready";
    value.decision.blocking_check_ids = [];
    for (const check of value.checks) { check.status = "passed"; check.evidence = 100; }
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /checks\[0\]\.evidence: must be a non-empty object/);
});

test("A1.5 blocked gate decisions require real blocking checks and owned actions", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-blocked-");
  await mutateYaml(root, "data-quality-gate.yaml", (value) => {
    value.decision.blocking_check_ids = ["check.unknown", value.checks.at(-1).id];
    value.checks.at(-1).owner = true;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /blocking_check_ids: unrelated id check\.unknown/);
  assert.match(report, /blocking_check_ids: unrelated id check\.drift/);
  assert.match(report, /checks\[7\]\.owner: must be a non-empty string/);
});

test("A1.5 cases reject unrelated borrowed ids and trace orphans", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-case-graph-");
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  await mutateYaml(root, relativePath, (value) => {
    value.references.source_ids[0] = "source.contract.traffic.v1";
    value.expected.trace_closure[0].links = value.expected.trace_closure[0].links.filter((id) => id !== "partition.refund.distribution");
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /references\.source_ids: unknown id source\.contract\.traffic\.v1/);
  assert.match(report, /missing required id source\.refund\.traffic\.v1/);
  assert.match(report, /reference partition\.refund\.distribution is not covered by expected\.trace_closure/);
});

test("A1.5 cases reject boolean and empty-container shrinkage", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-case-types-");
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  await mutateYaml(root, relativePath, (value) => {
    value.input.sources[0].provenance = true;
    value.input.annotation.blind_independent.annotators = 1;
    value.input.dataset_version.identity.immutable = false;
    value.expected.next_actions = [];
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /input\.sources\[0\]\.provenance: must be a non-empty object/);
  assert.match(report, /input\.annotation\.blind_independent\.annotators must be at least 2/);
  assert.match(report, /input\.dataset_version\.identity\.immutable must be true/);
  assert.match(report, /expected\.next_actions: must be a non-empty array/);
});

test("A1.5 canonical cases cannot replace every A1.4 upstream id with unrelated ids", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-upstream-attack-");
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  await mutateYaml(root, relativePath, (value) => {
    for (const field of [
      "target_ids",
      "construct_ids",
      "question_ids",
      "risk_ids",
      "scenario_family_ids",
      "task_ids",
    ]) {
      value.references[field] = [`unrelated.${field}`];
      value.input.charter.upstream_traceability[field] = [`unrelated.${field}`];
    }
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /references\.target_ids: unknown id unrelated\.target_ids/);
  assert.match(report, /references\.target_ids: missing required id target\.refund-agent\.candidate/);
  assert.match(report, /upstream_traceability\.task_ids: unknown id unrelated\.task_ids/);
  assert.match(report, /upstream_traceability\.task_ids: missing required id task\.refund\.execute/);
});

test("A1.5 cross-template source register references must bind to the declared register", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-cross-template-");
  await mutateYaml(root, "reference-standard.yaml", (value) => {
    value.source_register_id = "source-register.borrowed.v9";
  });
  await mutateYaml(root, "split-manifest.yaml", (value) => {
    value.source_register_id = "source-register.borrowed.v9";
  });
  await mutateYaml(root, "sampling-plan.yaml", (value) => {
    value.sampling_frame.frame_id = "frame.borrowed.v9";
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /reference-standard\.yaml: source_register_id: expected source-register\.example\.v1/);
  assert.match(report, /split-manifest\.yaml: source_register_id: expected source-register\.example\.v1/);
  assert.match(report, /sampling-plan\.yaml: sampling_frame\.frame_id: expected frame\.example\.snapshot\.v1/);
});

test("A1.5 template source governance rejects id-only placeholders and wrong scalar types", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-template-governance-");
  await mutateYaml(root, "source-register.yaml", (value) => {
    const source = value.sources[0];
    for (const field of [
      "provenance",
      "lineage",
      "authorization",
      "privacy",
      "license_and_access",
      "retention",
    ]) source[field] = { id: "placeholder" };
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /provenance\.producer: must be a non-empty string/);
  assert.match(report, /lineage\.parent_ids: must be a non-empty array/);
  assert.match(report, /authorization\.approved_purposes: must be a non-empty array/);
  assert.match(report, /privacy\.personal_data: must be a boolean/);
  assert.match(report, /privacy\.sensitive_fields: must be an array/);
  assert.match(report, /retention\.period_days: must be a positive number/);
});

test("A1.5 case source governance enforces its case-specific schema", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-case-governance-");
  const relativePath = "examples/contract-agent/evaluation-case.yaml";
  await mutateYaml(root, relativePath, (value) => {
    const source = value.input.sources[0];
    source.provenance = { id: "placeholder" };
    source.lineage = { id: "placeholder" };
    source.authorization = { id: "placeholder" };
    source.privacy = { id: "placeholder" };
    source.license_and_retention = { id: "placeholder", retention_days: 0 };
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /provenance\.extraction: must be a non-empty string/);
  assert.match(report, /lineage\.parents: must be a non-empty array/);
  assert.match(report, /authorization\.expires: must be a non-empty string/);
  assert.match(report, /privacy\.forbidden_fields: must be an array/);
  assert.match(report, /license_and_retention\.retention_days: must be a positive number/);
});

test("A1.5 case references reject boolean and id-only oracle placeholders", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-case-reference-");
  const relativePath = "examples/knowledge-assistant/evaluation-case.yaml";
  await mutateYaml(root, relativePath, (value) => {
    const item = value.input.reference.items[0];
    item.oracle_type = true;
    item.authoritative_material = [true];
    item.expected = { id: "placeholder" };
    item.acceptable_alternatives = [true];
    item.uncertainty_action = false;
    value.input.reference.invariants[0].risk_ids = ["risk.unrelated"];
    value.input.reference.invariants[0].assertion = true;
    value.input.reference.invariants[0].observation_required = true;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /oracle_type: must be a non-empty string/);
  assert.match(report, /authoritative_material\[0\]: must be a non-empty object/);
  assert.match(report, /expected\.required_outcomes: must be a non-empty array/);
  assert.match(report, /acceptable_alternatives\[0\]: must be a non-empty object/);
  assert.match(report, /invariants\[0\]\.risk_ids: unknown id risk\.unrelated/);
  assert.match(report, /invariants\[0\]\.assertion: must be a non-empty string/);
  assert.match(report, /invariants\[0\]\.observation_required: must be a non-empty array/);
});

test("A1.5 gate evidence links must resolve and sample count alone is never evidence", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-gate-evidence-");
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  await mutateYaml(root, relativePath, (value) => {
    value.input.quality_gate.checks[0].evidence.evidence_links = ["totally.unrelated.id"];
    value.input.quality_gate.checks[0].evidence.sample_count_only = true;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /evidence_links: unknown id totally\.unrelated\.id/);
  assert.match(report, /sample_count_only must be false/);
});

test("A1.5 rejects an invalid decision when every check passed", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-invalid-without-failure-");
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  await mutateYaml(root, relativePath, (value) => {
    for (const check of value.input.quality_gate.checks) check.status = "passed";
    value.input.quality_gate.decision = {
      status: "invalid",
      blocking_check_ids: [],
      partial_check_ids: [],
      invalidating_check_ids: [],
      reason: "placeholder",
      owner: "owner",
      action: "rebuild",
      prohibited_claims: ["cannot-use"],
    };
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /decision\.status invalid requires a failed check/);
});

test("A1.5 invalidating check ids must point exactly to failed checks", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-invalidating-ids-");
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  await mutateYaml(root, relativePath, (value) => {
    for (const check of value.input.quality_gate.checks) check.status = "passed";
    value.input.quality_gate.checks[0].status = "failed";
    value.input.quality_gate.decision = {
      status: "invalid",
      blocking_check_ids: [],
      partial_check_ids: [],
      invalidating_check_ids: [value.input.quality_gate.checks[1].id],
      reason: "confirmed-integrity-failure",
      owner: "data-owner",
      action: "rebuild-version",
      prohibited_claims: ["dataset-usable"],
    };
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /invalidating_check_ids: unrelated id refund\.check\.source/);
  assert.match(report, /invalidating_check_ids: missing related id refund\.check\.scope/);
});

test("A1.5 views require typed disjoint fields and cannot expose reference data", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-view-boundary-");
  await mutateYaml(root, "dataset-manifest.yaml", (value) => {
    value.views.target.allowed_fields.push("reference", "expected");
    value.views.target.prohibited_fields.push("item_id");
    value.views.harness.allowed_fields[0] = true;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /views\.target: field item_id cannot be both allowed and prohibited/);
  assert.match(report, /views\.target\.allowed_fields must not include restricted field reference/);
  assert.match(report, /views\.target\.allowed_fields must not include restricted field expected/);
  assert.match(report, /views\.harness\.allowed_fields\[0\]: must be a non-empty string/);
});

test("A1.5 case sampling permits zero gaps but validates every declared gap", async () => {
  const validRoot = await copyUnit(A15_UNIT, "evalorium-a1-5-zero-gaps-");
  await mutateYaml(validRoot, "examples/refund-agent/evaluation-case.yaml", (value) => {
    value.input.sampling.sampling_frame.gaps = [];
    value.input.quality_gate.checks[5].evidence.evidence_links = ["charter.refund.a15"];
  });
  assert.deepEqual(await verifyAcademyUnit(validRoot), []);

  const invalidRoot = await copyUnit(A15_UNIT, "evalorium-a1-5-bad-gap-");
  await mutateYaml(invalidRoot, "examples/refund-agent/evaluation-case.yaml", (value) => {
    value.input.sampling.sampling_frame.gaps = [{ id: "gap.incomplete", status: "ready" }];
  });
  const report = (await verifyAcademyUnit(invalidRoot)).join("\n");
  assert.match(report, /gaps\[0\]\.description: must be a non-empty string/);
  assert.match(report, /gaps\[0\]\.affected_population_or_risk: must be a non-empty string/);
  assert.match(report, /gaps\[0\]\.status: must be gap or blocked/);
});

test("A1.5 index rejects broken local href targets after query and fragment removal", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-html-href-");
  const htmlPath = path.join(root, "index.html");
  const source = await readFile(htmlPath, "utf8");
  await writeFile(
    htmlPath,
    source.replace("dataset-charter.yaml", "missing-local-artifact.yaml?view=1#schema"),
  );
  assert.match(
    (await verifyAcademyUnit(root)).join("\n"),
    /index\.html: broken local href missing-local-artifact\.yaml\?view=1#schema/,
  );
});

test("A1.5 rejects a self-certified ready gate over planned data", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-self-certified-ready-");
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  await mutateYaml(root, relativePath, (value) => {
    value.input.sampling.sampling_frame.gaps = [];
    for (const quota of value.input.sampling.allocation.per_stratum) {
      quota.actual_count = quota.target_count;
      quota.status = "met";
    }
    for (const check of value.input.quality_gate.checks) {
      check.status = "passed";
      check.evidence.evidence_links = [check.id];
    }
    value.input.quality_gate.decision = {
      status: "ready",
      blocking_check_ids: [],
      partial_check_ids: [],
      invalidating_check_ids: [],
    };
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /gate cannot use self evidence id refund\.check\.scope/);
  assert.match(report, /input\.sources\[0\]\.status: ready requires materialized/);
  assert.match(report, /input\.sources\[0\]\.provenance\.snapshot: must identify a materialized non-sentinel value/);
  assert.match(report, /input\.reference\.outputs: must be a non-empty array/);
  assert.match(report, /input\.annotation\.outputs: must be a non-empty array/);
  assert.match(report, /input\.split\.assignment_audit\.outputs: must be a non-empty array/);
  assert.match(report, /input\.dataset_version\.identity\.status: ready requires materialized/);
});

test("A1.5 has a machine-expressible path to a legitimately materialized ready case", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-materialized-ready-");
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  await mutateYaml(root, relativePath, (value) => {
    value.input.sampling.sampling_frame.gaps = [];
    for (const quota of value.input.sampling.allocation.per_stratum) {
      quota.target_count = 2;
      quota.actual_count = 2;
      quota.status = "met";
    }
    for (const [index, source] of value.input.sources.entries()) {
      source.status = "materialized";
      source.provenance.snapshot = `snapshot.refund.${index}.v1`;
      source.provenance.extraction = `query.refund.${index}.v1`;
      source.authorization.status = "verified-current";
    }
    value.input.reference.outputs = [
      {id: "output.refund.references.v1", type: "reference-items", hash: "sha256:references", status: "materialized"},
      {id: "report.refund.authority.v1", type: "authority-snapshot-report", hash: "sha256:authority", status: "materialized"},
    ];
    value.input.annotation.outputs = [
      {id: "output.refund.raw-labels.v1", type: "raw-labels", hash: "sha256:raw-labels", status: "materialized"},
      {id: "output.refund.adjudication.v1", type: "adjudication-records", hash: "sha256:adjudication", status: "materialized"},
      {id: "report.refund.annotation-qc.v1", type: "quality-control-report", hash: "sha256:annotation-qc", status: "materialized"},
    ];
    value.input.split.assignment_audit = {outputs: [
      {id: "output.refund.item-groups.v1", type: "item-to-group-map", hash: "sha256:item-groups", status: "materialized"},
      {id: "report.refund.collisions.v1", type: "cross-split-collision-report", hash: "sha256:collisions", status: "materialized"},
      {id: "report.refund.near-duplicates.v1", type: "near-duplicate-report", hash: "sha256:near-duplicates", status: "materialized"},
      {id: "report.refund.temporal.v1", type: "temporal-cutoff-report", hash: "sha256:temporal", status: "materialized"},
    ]};
    value.input.dataset_version.identity = {
      content_hash: "sha256:dataset-content",
      schema_hash: "sha256:dataset-schema",
      created_at: "2026-08-10T12:00:00Z",
      immutable: true,
      status: "materialized",
    };
    for (const [index, content] of value.input.dataset_version.contents.entries()) {
      content.hash = `sha256:content-${index}`;
      content.role = index === 0 ? "task-items" : index === 1 ? "references-and-annotations" : "split-assignments";
    }
    const evidenceByCheck = {
      "refund.check.scope": ["charter.refund.a15"],
      "refund.check.source": [value.input.sources[0].id],
      "refund.check.reference": ["output.refund.references.v1"],
      "refund.check.annotation": ["report.refund.annotation-qc.v1"],
      "refund.check.leakage": ["report.refund.collisions.v1"],
      "refund.check.coverage": [value.input.dataset_version.contents[0].id],
      "refund.check.version": [value.input.dataset_version.contents[1].id],
    };
    for (const check of value.input.quality_gate.checks) {
      check.status = "passed";
      check.evidence.evidence_links = evidenceByCheck[check.id];
    }
    value.input.quality_gate.decision = {
      status: "ready",
      blocking_check_ids: [],
      partial_check_ids: [],
      invalidating_check_ids: [],
    };
  });
  assert.deepEqual(await verifyAcademyUnit(root), []);
});

test("A1.5 template decision structures reject id-only and boolean placeholders", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-template-structures-");
  await mutateYaml(root, "dataset-charter.yaml", (value) => {
    for (const field of ["purpose", "target_population", "unit_of_analysis", "sampling_frame", "scope_controls", "evidence_boundary"]) value[field] = {id: "placeholder"};
  });
  await mutateYaml(root, "annotation-protocol.yaml", (value) => {
    value.annotation_units = [true];
    value.instructions = {id: "placeholder"};
    value.annotators = {id: "placeholder"};
    value.blind_independent_passes = {required_annotators: 2};
    value.disagreement = {preserve_raw_labels: true};
    value.arbitration = {required_for: ["critical"]};
    value.quality_control = {id: "placeholder"};
    value.privacy_handling = {id: "placeholder"};
    value.outputs = {id: "placeholder"};
  });
  await mutateYaml(root, "split-manifest.yaml", (value) => {
    value.grouping_keys.parent = true;
    value.leakage_controls[0].key = true;
    value.leakage_controls[0].rule = true;
    value.leakage_controls[0].check = true;
    value.leakage_controls[0].failure_action = true;
  });
  await mutateYaml(root, "dataset-manifest.yaml", (value) => {
    value.contents = [true];
    value.item_schema = {id: "placeholder"};
    value.joins = [true];
    value.partition_summary[0].denominator = true;
    value.provenance_summary = {id: "placeholder"};
    value.versioning = {immutable: true};
    value.drift_and_refresh = {id: "placeholder"};
    value.evidence_boundary = {id: "placeholder"};
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /purpose\.decision_supported: must be a non-empty string/);
  assert.match(report, /target_population\.inclusion: must be a non-empty array/);
  assert.match(report, /annotation_units\[0\]: must be a non-empty object/);
  assert.match(report, /instructions\.decision_rule: must be a non-empty string/);
  assert.match(report, /leakage_controls\[0\]\.key: must be a non-empty string/);
  assert.match(report, /leakage_controls\[0\]\.rule: must be a non-empty string/);
  assert.match(report, /contents\[0\]\.path: must be a non-empty string/);
  assert.match(report, /joins\[0\]: must be a non-empty object/);
  assert.match(report, /provenance_summary\.privacy_review_id: must be a non-empty string/);
  assert.match(report, /evidence_boundary\.establishes: must be a non-empty array/);
});

test("A1.5 case decision structures reject id-only and boolean placeholders", async () => {
  const root = await copyUnit(A15_UNIT, "evalorium-a1-5-case-structures-");
  const relativePath = "examples/contract-agent/evaluation-case.yaml";
  await mutateYaml(root, relativePath, (value) => {
    value.input.charter.purpose = {id: "placeholder"};
    value.input.charter.unit_of_analysis = {id: "placeholder"};
    value.input.charter.sampling_frame = {id: "placeholder"};
    value.input.annotation.units = [true];
    value.input.annotation.labels = [true];
    value.input.annotation.blind_independent = {annotators: 2};
    value.input.annotation.disagreement = {preserve_raw: true};
    value.input.annotation.arbitration = {id: "placeholder"};
    value.input.split.grouping.parent = true;
    value.input.split.leakage_controls[0].rule = true;
    value.input.dataset_version.contents = [true];
    value.input.dataset_version.item_schema = [true];
    value.input.dataset_version.drift_and_refresh = {id: "placeholder"};
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /input\.charter\.purpose: must be a non-empty string/);
  assert.match(report, /unit_of_analysis\.primary: must be a non-empty string/);
  assert.match(report, /input\.annotation\.units\[0\]: must be a non-empty object/);
  assert.match(report, /blind_independent\.qualification: must be a non-empty string/);
  assert.match(report, /input\.split\.grouping\.parent: must be a non-empty string/);
  assert.match(report, /input\.split\.leakage_controls\[0\]\.rule: must be a non-empty string/);
  assert.match(report, /input\.dataset_version\.contents\[0\]\.role: must be a non-empty string/);
  assert.match(report, /input\.dataset_version\.item_schema\[0\]: must be a non-empty string/);
  assert.match(report, /drift_and_refresh\.monitors: must be a non-empty array/);
});

test("the complete A1.6 reference-to-scorer package is accepted", async () => {
  assert.deepEqual(await verifyAcademyUnit(A16_UNIT), []);
});

test("A1.6 cannot disable its canonical profile or shrink templates and domain cases", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-profile-");
  await mutateYaml(root, "artifact-manifest.yaml", (manifest) => {
    delete manifest.verification.profile;
    manifest.contents.templates = manifest.contents.templates.filter((item) => item !== "scorer-manifest.yaml");
    manifest.contents.examples = manifest.contents.examples.filter((item) => !item.includes("knowledge-assistant"));
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /A1\.6 requires verification\.profile/);
  assert.match(report, /profile reference-to-scorer-v1 requires scorer-manifest\.yaml/);
  assert.match(report, /profile reference-to-scorer-v1 requires examples\/knowledge-assistant\/evaluation-case\.yaml/);
});

test("A1.6 cannot replace its canonical profile", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-wrong-profile-");
  await mutateYaml(root, "artifact-manifest.yaml", (manifest) => { manifest.verification.profile = "task-scenario-to-evaluation-data-v1"; });
  assert.match((await verifyAcademyUnit(root)).join("\n"), /unit A1\.6 must use verification\.profile reference-to-scorer-v1/);
});

test("A1.6 binds every template to the exact declared scorer design graph", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-template-graph-");
  await mutateYaml(root, "scoring-rubric.yaml", (value) => { value.observation_contract_id = "observation-contract.borrowed.v9"; });
  await mutateYaml(root, "scorer-validation-report.yaml", (value) => { value.scorer_manifest_id = "scorer-manifest.borrowed.v9"; });
  await mutateYaml(root, "scorer-quality-gate.yaml", (value) => { value.validation_report_id = "scorer-validation.borrowed.v9"; });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /scoring-rubric\.yaml: observation_contract_id: expected observation-contract\.example\.v1/);
  assert.match(report, /scorer-validation-report\.yaml: scorer_manifest_id: expected scorer-manifest\.example\.v1/);
  assert.match(report, /scorer-quality-gate\.yaml: validation_report_id: expected scorer-validation\.example\.v1/);
});

test("A1.6 rejects id-only and boolean scoring unit and observation shells", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-unit-types-");
  await mutateYaml(root, "scoring-unit-spec.yaml", (value) => {
    value.units[0].identity_keys = true;
    value.units[0].child_units = true;
    value.missing_or_duplicate_identity = false;
  });
  await mutateYaml(root, "observation-contract.yaml", (value) => {
    value.bundle.identity = {id: "placeholder"};
    value.integrity.hashes_required = false;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /units\[0\]\.identity_keys: must be a non-empty array/);
  assert.match(report, /units\[0\]\.child_units: must be an array/);
  assert.match(report, /missing_or_duplicate_identity must be unscorable/);
  assert.match(report, /bundle\.identity\.required: must be a non-empty array/);
  assert.match(report, /integrity\.hashes_required must be true/);
});

test("A1.6 keeps Reference Rubric Scorer Score Metric and Gate semantics separate", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-rubric-semantics-");
  await mutateYaml(root, "scoring-rubric.yaml", (value) => {
    value.rubric_type = "metric";
    value.dimensions[0].anchors[0].score = true;
    value.dimensions[0].anchors[0].required_evidence = [];
    value.critical_errors[0].compensable = true;
    value.critical_errors[0].judge_override_allowed = true;
    value.unscorable.output = {status: "scored", score: 1};
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /rubric_type must be analytic/);
  assert.match(report, /anchors\[0\]\.score must be a number/);
  assert.match(report, /anchors\[0\]\.required_evidence: must be a non-empty array/);
  assert.match(report, /critical_errors\[0\]\.compensable must be false/);
  assert.match(report, /critical_errors\[0\]\.judge_override_allowed must be false/);
  assert.match(report, /unscorable output must use status unscorable and null score/);
});

test("A1.6 preserves disagreement abstention unscorable and adjudication semantics", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-adjudication-");
  await mutateYaml(root, "adjudication-protocol.yaml", (value) => {
    value.disagreement.preserve_raw_decisions = false;
    value.disagreement.categories = [];
    value.outcomes.no_majority_rule = false;
    value.outcomes.no_forced_resolution = false;
    value.critical_failure_rule = true;
  });
  await mutateYaml(root, "scoring-rubric.yaml", (value) => { value.uncertainty = {uncertain: "guess"}; });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /preserve_raw_decisions must be true/);
  assert.match(report, /disagreement\.categories: must be a non-empty array/);
  assert.match(report, /outcomes must prohibit majority and forced resolution/);
  assert.match(report, /critical_failure_rule: must be a non-empty string/);
  assert.match(report, /uncertainty: missing related id abstain/);
  assert.match(report, /uncertainty: missing related id inconclusive/);
});

test("A1.6 requires scorer identity implementations precedence output and security contracts", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-manifest-");
  await mutateYaml(root, "scorer-manifest.yaml", (value) => {
    value.implementations = [{id: "scorer.placeholder", type: "metric", role: true, authority: "none", status: "planned"}];
    value.precedence.order = ["scorer.placeholder"];
    value.precedence.judge_cannot_override = [];
    value.output_record.status_values = ["passed"];
    value.security.reference_fields_read_only = false;
    value.security.network_access = true;
    value.scorer_identity.immutable_id = true;
    value.scorer_identity.status = "blocked";
    value.scorer_identity.input_schema_version = {};
    value.scorer_identity.output_schema_version = [];
    value.failure_behavior.missing_input = false;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /implementations\.type: unrelated id metric/);
  assert.match(report, /implementations\[0\]\.type is unsupported/);
  assert.match(report, /implementations\[0\]\.role: must be a non-empty string/);
  assert.match(report, /precedence\.judge_cannot_override: must be a non-empty array/);
  assert.match(report, /output_record\.status_values: unrelated id passed/);
  assert.match(report, /security\.reference_fields_read_only must be true/);
  assert.match(report, /security\.network_access: must be a non-empty string/);
  assert.match(report, /scorer_identity\.immutable_id: must be a non-empty string/);
  assert.match(report, /scorer_identity\.status must be design-only, implemented or validated/);
  assert.match(report, /scorer_identity\.input_schema_version: must be a non-empty string/);
  assert.match(report, /scorer_identity\.output_schema_version: must be a non-empty string/);
  assert.match(report, /failure_behavior\.missing_input: must be a non-empty string/);
});

test("A1.6 validation requires reliability validity calibration error bias robustness and security", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-validation-");
  await mutateYaml(root, "scorer-validation-report.yaml", (value) => {
    value.dimensions.reliability.methods = [];
    delete value.dimensions.validity.result;
    value.error_profile = {false_pass: {observed_count: null}};
    value.bias_and_robustness.perturbations = [];
    value.security.tests = [];
    value.acceptance.required_results = [];
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /dimensions\.reliability\.methods: must be a non-empty array/);
  assert.match(report, /dimensions\.validity\.result is required/);
  assert.match(report, /error_profile: missing related id false_fail/);
  assert.match(report, /bias_and_robustness\.perturbations: must be a non-empty array/);
  assert.match(report, /security\.tests: must be a non-empty array/);
  assert.match(report, /acceptance\.required_results: must be a non-empty array/);
});

test("A1.6 public validation evidence and partial scope schemas cannot be deleted or weakened", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-public-schemas-");
  await mutateYaml(root, "scorer-validation-report.yaml", (value) => {
    value.evidence.record_schema.required = ["id"];
    value.evidence.record_schema.category_values = ["reliability"];
    value.evidence.record_schema.hash_format = "any-string";
    value.evidence.record_schema.materialized_status = "planned";
  });
  await mutateYaml(root, "scorer-quality-gate.yaml", (value) => {
    value.partial_scope_schema.required_when = "optional";
    value.partial_scope_schema.required = ["id"];
    value.partial_scope_schema.evidence_rule = "";
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /evidence\.record_schema\.required: missing related id category/);
  assert.match(report, /evidence\.record_schema\.category_values: missing related id identity/);
  assert.match(report, /evidence\.record_schema\.hash_format must be sha256:<64-hex>/);
  assert.match(report, /evidence\.record_schema\.materialized_status must be materialized/);
  assert.match(report, /partial_scope_schema\.required_when must be decision\.status=partial/);
  assert.match(report, /partial_scope_schema\.required: missing related id allowed_uses/);
  assert.match(report, /partial_scope_schema\.evidence_rule: must be a non-empty string/);

  const deletedRoot = await copyUnit(A16_UNIT, "evalorium-a1-6-deleted-public-schemas-");
  await mutateYaml(deletedRoot, "scorer-validation-report.yaml", (value) => { delete value.evidence.record_schema; });
  await mutateYaml(deletedRoot, "scorer-quality-gate.yaml", (value) => { delete value.partial_scope_schema; });
  const deletedReport = (await verifyAcademyUnit(deletedRoot)).join("\n");
  assert.match(deletedReport, /missing required key evidence\.record_schema\.required/);
  assert.match(deletedReport, /missing required key partial_scope_schema\.required_when/);
});

test("A1.6 validation identities bind report scorer and non-sentinel dataset versions", async () => {
  const templateRoot = await copyUnit(A16_UNIT, "evalorium-a1-6-template-validation-identity-");
  await mutateYaml(templateRoot, "scorer-validation-report.yaml", (value) => {
    value.validation_identity.report_id = "validation.borrowed.v1";
    value.validation_identity.scorer_immutable_id = "scorer-identity.borrowed.v1";
    value.validation_identity.dataset_version = "planned";
  });
  const templateReport = (await verifyAcademyUnit(templateRoot)).join("\n");
  assert.match(templateReport, /validation_identity\.report_id: expected scorer-validation\.example\.v1/);
  assert.match(templateReport, /validation_identity\.scorer_immutable_id: expected scorer\.example\.v1/);
  assert.match(templateReport, /validation_identity\.dataset_version: must identify a materialized non-sentinel value/);
  assert.match(templateReport, /validation_identity\.dataset_version: expected independent-calibration-set\.example\.v1/);

  const caseRoot = await copyUnit(A16_UNIT, "evalorium-a1-6-case-validation-identity-");
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  await mutateYaml(caseRoot, relativePath, (value) => {
    value.input.validation.validation_identity.report_id = "validation.contract.scorer.a16";
    value.input.validation.validation_identity.scorer_immutable_id = "scorer-identity.contract.a16";
    value.input.validation.validation_identity.dataset_version = "planned-not-observed";
  });
  const caseReport = (await verifyAcademyUnit(caseRoot)).join("\n");
  assert.match(caseReport, /input\.validation\.validation_identity\.report_id: expected validation\.refund\.scorer\.a16/);
  assert.match(caseReport, /input\.validation\.validation_identity\.scorer_immutable_id: expected scorer-identity\.refund\.a16/);
  assert.match(caseReport, /input\.validation\.validation_identity\.dataset_version: must identify a materialized non-sentinel value/);
});

test("A1.6 canonical validation datasets cannot be synchronously borrowed across cases", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-cross-case-validation-dataset-");
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  await mutateYaml(root, relativePath, (value) => {
    value.input.validation.validation_identity.dataset_version = "independent-calibration-set.contract.a16";
  });
  assert.match(
    (await verifyAcademyUnit(root)).join("\n"),
    /input\.validation\.validation_identity\.dataset_version: expected independent-calibration-set\.refund\.a16/,
  );
});

test("A1.6 gate check ids categories and criticality cannot be deleted or relabeled", async () => {
  const templateRoot = await copyUnit(A16_UNIT, "evalorium-a1-6-template-check-taxonomy-");
  await mutateYaml(templateRoot, "scorer-quality-gate.yaml", (value) => {
    value.checks = value.checks.filter((check) => check.id !== "check.security");
    value.decision.blocking_check_ids = value.decision.blocking_check_ids.filter((id) => id !== "check.security");
    value.checks.find((check) => check.id === "check.reliability").category = "safety";
    value.checks.find((check) => check.id === "check.identity").critical = false;
    value.required_check_categories = value.required_check_categories.filter((category) => category !== "security");
    value.all_checks_critical = false;
  });
  const templateReport = (await verifyAcademyUnit(templateRoot)).join("\n");
  assert.match(templateReport, /checks\.id: missing required id check\.security/);
  assert.match(templateReport, /checks\.category: missing related id reliability/);
  assert.match(templateReport, /check check\.reliability must use reliability/);
  assert.match(templateReport, /checks\[0\]\.critical must be true/);
  assert.match(templateReport, /required_check_categories: missing related id security/);
  assert.match(templateReport, /all_checks_critical must be true/);

  const caseRoot = await copyUnit(A16_UNIT, "evalorium-a1-6-case-check-taxonomy-");
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  await mutateYaml(caseRoot, relativePath, (value) => {
    value.input.quality_gate.checks = value.input.quality_gate.checks.filter((check) => check.id !== "refund.scorer.check.bias-security");
    value.input.quality_gate.decision.blocking_check_ids = value.input.quality_gate.decision.blocking_check_ids.filter((id) => id !== "refund.scorer.check.bias-security");
  });
  const caseReport = (await verifyAcademyUnit(caseRoot)).join("\n");
  assert.match(caseReport, /checks\.id: missing required id refund\.scorer\.check\.bias-security/);
  assert.match(caseReport, /checks\.category: missing related id bias-robustness-security/);
});

test("A1.6 ready cannot hide a blocked reliability check by marking it noncritical", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-noncritical-ready-");
  await materializeA16TemplateReady(root);
  await mutateYaml(root, "scorer-quality-gate.yaml", (value) => {
    const reliability = value.checks.find((check) => check.id === "check.reliability");
    reliability.status = "blocked";
    reliability.critical = false;
    value.decision.blocking_check_ids = [reliability.id];
  });
  assert.match(
    (await verifyAcademyUnit(root)).join("\n"),
    /checks\[2\]\.critical must be true/,
  );
});

test("A1.6 canonical cases cannot rename replace shrink or borrow A1.5 upstream ids", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-upstream-");
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  await mutateYaml(root, relativePath, (value) => {
    value.references.target_ids = ["target.contract-agent.candidate"];
    value.references.reference_item_ids = ["reference.contract.risk-span.v1"];
    value.references.quality_gate_ids = ["gate.contract.data.v1"];
    value.input.scorer_charter.upstream_traceability.task_ids = ["task.contract.screen"];
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /references\.target_ids: unknown id target\.contract-agent\.candidate/);
  assert.match(report, /references\.reference_item_ids: unknown id reference\.contract\.risk-span\.v1/);
  assert.match(report, /references\.quality_gate_ids: unknown id gate\.contract\.data\.v1/);
  assert.match(report, /upstream_traceability\.task_ids: unknown id task\.contract\.screen/);
});

test("A1.6 separates spec and entity identities and rejects cross-case scorer borrowing", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-case-ids-");
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  await mutateYaml(root, relativePath, (value) => {
    value.references.scoring_unit_spec_ids = [value.references.scoring_unit_ids[0]];
    value.references.scoring_unit_ids[0] = value.input.scoring_units.spec_id;
    value.references.scorer_manifest_ids = ["scorer.contract.composite.a16"];
    value.references.scorer_ids[0] = "scorer.contract.span-check";
    value.input.rubric.scoring_unit_spec_id = "scoring-unit.contract.a16";
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /references\.scoring_unit_spec_ids: unknown id unit\.refund/);
  assert.match(report, /references\.scoring_unit_ids: unknown id scoring-unit\.refund\.a16/);
  assert.match(report, /references\.scorer_manifest_ids: unknown id scorer\.contract\.composite\.a16/);
  assert.match(report, /references\.scorer_ids: unknown id scorer\.contract\.span-check/);
  assert.match(report, /input\.rubric\.scoring_unit_spec_id: expected scoring-unit\.refund\.a16/);
});

test("A1.6 case cross-template bindings reject contract ids borrowed into the refund graph", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-case-cross-bindings-");
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  await mutateYaml(root, relativePath, (value) => {
    value.input.scoring_units.scorer_charter_id = "scorer-charter.contract.a16";
    value.input.observation_contract.scoring_unit_spec_id = "scoring-unit.contract.a16";
    value.input.rubric.scorer_charter_id = "scorer-charter.contract.a16";
    value.input.rubric.scoring_unit_spec_id = "scoring-unit.contract.a16";
    value.input.rubric.observation_contract_id = "observation.contract.a16";
    value.input.adjudication.rubric_id = "rubric.contract.a16";
    value.input.scorers.scorer_charter_id = "scorer-charter.contract.a16";
    value.input.scorers.scoring_unit_spec_id = "scoring-unit.contract.a16";
    value.input.scorers.observation_contract_id = "observation.contract.a16";
    value.input.scorers.rubric_id = "rubric.contract.a16";
    value.input.scorers.adjudication_protocol_id = "adjudication.contract.a16";
    value.input.validation.scorer_manifest_id = "scorer-manifest.contract.a16";
    value.input.quality_gate.scorer_manifest_id = "scorer-manifest.contract.a16";
    value.input.quality_gate.validation_report_id = "validation.contract.scorer.a16";
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  for (const [field, expected] of [
    ["input.scoring_units.scorer_charter_id", "scorer-charter.refund.a16"],
    ["input.observation_contract.scoring_unit_spec_id", "scoring-unit.refund.a16"],
    ["input.rubric.scorer_charter_id", "scorer-charter.refund.a16"],
    ["input.rubric.scoring_unit_spec_id", "scoring-unit.refund.a16"],
    ["input.rubric.observation_contract_id", "observation.refund.a16"],
    ["input.adjudication.rubric_id", "rubric.refund.a16"],
    ["input.scorers.scorer_charter_id", "scorer-charter.refund.a16"],
    ["input.scorers.scoring_unit_spec_id", "scoring-unit.refund.a16"],
    ["input.scorers.observation_contract_id", "observation.refund.a16"],
    ["input.scorers.rubric_id", "rubric.refund.a16"],
    ["input.scorers.adjudication_protocol_id", "adjudication.refund.a16"],
    ["input.validation.scorer_manifest_id", "scorer-manifest.refund.a16"],
    ["input.quality_gate.scorer_manifest_id", "scorer-manifest.refund.a16"],
    ["input.quality_gate.validation_report_id", "validation.refund.scorer.a16"],
  ]) {
    assert.ok(report.includes(`${field}: expected ${expected}`), `missing exact-binding error for ${field}`);
  }
});

test("A1.6 scorer manifest identity and implementation ids remain disjoint under synchronized attacks", async () => {
  const templateRoot = await copyUnit(A16_UNIT, "evalorium-a1-6-template-identity-merge-");
  await mutateYaml(templateRoot, "scorer-manifest.yaml", (value) => {
    const mergedId = value.implementations[0].id;
    value.metadata.id = mergedId;
    value.scorer_identity.immutable_id = mergedId;
  });
  await mutateYaml(templateRoot, "scorer-validation-report.yaml", (value) => { value.scorer_manifest_id = "scorer.example.deterministic"; });
  await mutateYaml(templateRoot, "scorer-quality-gate.yaml", (value) => { value.scorer_manifest_id = "scorer.example.deterministic"; });
  assert.match(
    (await verifyAcademyUnit(templateRoot)).join("\n"),
    /scorer manifest, immutable identity and implementation ids must be pairwise disjoint; duplicate scorer\.example\.deterministic/,
  );

  const caseRoot = await copyUnit(A16_UNIT, "evalorium-a1-6-case-identity-merge-");
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  await mutateYaml(caseRoot, relativePath, (value) => {
    const oldManifestId = value.input.scorers.manifest_id;
    const oldIdentityId = value.input.scorers.identity.immutable_id;
    const mergedId = value.input.scorers.implementations.find((item) => item.type === "composite").id;
    value.input.scorers.manifest_id = mergedId;
    value.input.scorers.identity.immutable_id = mergedId;
    value.input.validation.scorer_manifest_id = mergedId;
    value.input.quality_gate.scorer_manifest_id = mergedId;
    value.references.scorer_manifest_ids = [mergedId];
    value.references.scorer_identity_ids = [mergedId];
    for (const trace of value.expected.trace_closure) {
      trace.links = [...new Set(trace.links.map((id) => id === oldManifestId || id === oldIdentityId ? mergedId : id))];
    }
    value.evidence.design_artifacts = value.evidence.design_artifacts.map((id) => id === oldManifestId ? mergedId : id);
  });
  assert.match(
    (await verifyAcademyUnit(caseRoot)).join("\n"),
    /scorer manifest, immutable identity and implementation ids must be pairwise disjoint; duplicate scorer\.refund\.composite\.a16/,
  );
});

test("A1.6 canonical scorer identities cannot be synchronously borrowed across cases", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-cross-case-identity-");
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  await mutateYaml(root, relativePath, (value) => {
    const oldId = value.input.scorers.identity.immutable_id;
    const borrowedId = "scorer-identity.contract.a16";
    value.input.scorers.identity.immutable_id = borrowedId;
    value.references.scorer_identity_ids = [borrowedId];
    for (const trace of value.expected.trace_closure) {
      trace.links = trace.links.map((id) => id === oldId ? borrowedId : id);
    }
    value.evidence.design_artifacts = value.evidence.design_artifacts.map((id) => id === oldId ? borrowedId : id);
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /references\.scorer_identity_ids: unknown id scorer-identity\.contract\.a16/);
  assert.match(report, /input\.scorers\.identity\.immutable_id: expected scorer-identity\.refund\.a16/);
  assert.match(report, /scorer identity scorer-identity\.contract\.a16 duplicates examples\/refund-agent\/evaluation-case\.yaml; canonical case scorer identities must be globally unique/);
});

test("A1.6 cases reject boolean and id-only decision shells", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-case-types-");
  const relativePath = "examples/contract-agent/evaluation-case.yaml";
  await mutateYaml(root, relativePath, (value) => {
    value.input.scoring_units.units[0] = {id: value.input.scoring_units.units[0].id};
    value.input.observation_contract.bundle.identity = true;
    value.input.rubric.dimensions[0].scale = {id: "placeholder"};
    value.input.rubric.dimensions[0].anchors[0].required_evidence = false;
    value.input.adjudication.disagreement = {preserve_raw_decisions: true};
    value.input.scorers.precedence.judge_cannot_override = [];
    value.input.scorers.identity.immutable_id = true;
    value.input.scorers.identity.status = "blocked";
    value.input.scorers.security.network_access = false;
    value.input.validation.security.tests = true;
    delete value.input.validation.acceptance.thresholds;
    value.input.validation.acceptance.error_thresholds = {};
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /input\.scoring_units\.units\[0\]\.level: must be a non-empty string/);
  assert.match(report, /input\.scoring_units\.units\[0\]\.identity_keys: must be a non-empty array/);
  assert.match(report, /input\.observation_contract\.bundle\.identity: must be a non-empty array/);
  assert.match(report, /input\.rubric\.dimensions\[0\]\.scale\.values: must be a non-empty array/);
  assert.match(report, /anchors\[0\]\.required_evidence: must be a non-empty array/);
  assert.match(report, /input\.adjudication\.disagreement\.categories: must be a non-empty array/);
  assert.match(report, /input\.scorers\.precedence\.judge_cannot_override: must be a non-empty array/);
  assert.match(report, /input\.scorers\.identity\.immutable_id: must be a non-empty string/);
  assert.match(report, /input\.scorers\.identity\.status must be design-only, implemented or validated/);
  assert.match(report, /input\.scorers\.security\.network_access: must be a non-empty string/);
  assert.match(report, /input\.validation\.security\.tests: must be a non-empty array/);
  assert.match(report, /input\.validation\.acceptance\.thresholds: missing related id reliability/);
  assert.match(report, /input\.validation\.acceptance\.error_thresholds: missing related id false_pass/);
});

test("A1.6 case references and scoring traces are bidirectionally closed", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-trace-");
  const relativePath = "examples/knowledge-assistant/evaluation-case.yaml";
  await mutateYaml(root, relativePath, (value) => {
    value.expected.trace_closure[0].links = value.expected.trace_closure[0].links.filter((id) => id !== value.references.source_ids[0]);
    value.expected.trace_closure[0].links.push("totally.unknown.evidence");
    const dimensionId = value.input.rubric.dimensions[0].id;
    for (const trace of value.expected.trace_closure) trace.links = trace.links.filter((id) => id !== dimensionId);
    value.references.scoring_trace_ids = ["trace.unrelated"];
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /unknown id totally\.unknown\.evidence/);
  assert.match(report, /reference source\.knowledge\.questions\.v1 is not covered by expected\.trace_closure/);
  assert.match(report, /references\.scoring_trace_ids: unknown id trace\.unrelated/);
  assert.match(report, /rubric dimension dimension\.knowledge\.groundedness is not covered by expected\.trace_closure/);
});

test("A1.6 partial decisions require exact real partial checks and exact blocking and invalid arrays", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-partial-");
  await mutateYaml(root, "scorer-quality-gate.yaml", (value) => {
    value.decision.status = "partial";
    value.decision.partial_check_ids = [];
    value.decision.blocking_check_ids = [];
    value.decision.invalidating_check_ids = [value.checks[0].id];
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /blocking_check_ids: missing related id check\.identity/);
  assert.match(report, /invalidating_check_ids: unrelated id check\.identity/);
  assert.match(report, /status partial requires a partial check/);

  const evidenceRoot = await copyUnit(A16_UNIT, "evalorium-a1-6-partial-evidence-");
  await mutateYaml(evidenceRoot, "scorer-quality-gate.yaml", (value) => {
    for (const check of value.checks) check.status = "passed";
    value.checks[0].status = "partial";
    value.decision.status = "partial";
    value.decision.blocking_check_ids = [];
    value.decision.partial_check_ids = [value.checks[0].id];
    value.decision.invalidating_check_ids = [];
  });
  assert.match(
    (await verifyAcademyUnit(evidenceRoot)).join("\n"),
    /passed or partial check requires non-planned materialized evidence/,
  );
});

test("A1.6 has a machine-expressible future path to a legitimately validated partial scorer scope", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-valid-partial-");
  await materializeA16TemplatePartial(root);
  assert.deepEqual(await verifyAcademyUnit(root), []);
});

test("A1.6 partial scopes require exact evidence category coverage for their partial checks", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-partial-scope-category-");
  await materializeA16TemplatePartial(root);
  await mutateYaml(root, "scorer-quality-gate.yaml", (value) => {
    value.decision.partial_scope.evidence_ids = ["evidence.independent.reliability.example.v1"];
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /partial_scope\.evidence_ids: unrelated evidence category reliability for partial checks/);
  assert.match(report, /partial_scope\.evidence_categories: missing related id validity/);
});

test("A1.6 partial decisions cannot be manufactured from flags strings or an unexecuted scorer", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-false-partial-");
  await materializeA16TemplatePartial(root);
  await mutateYaml(root, "scorer-manifest.yaml", (value) => {
    value.scorer_identity.status = "design-only";
    value.scorer_identity.implementation_hash = "not-implemented";
  });
  await mutateYaml(root, "scorer-validation-report.yaml", (value) => {
    value.validation_identity.status = "planned-not-observed";
    value.validation_identity.executed_at = "not-a-time";
    value.evidence.materialized = false;
    value.evidence.independent_from_scorer_development = false;
    value.evidence.sample_records = ["sample.only.a.flag"];
    value.evidence.evidence_links = ["evidence.only.a.flag"];
    value.acceptance.current_conclusion = "ready";
  });
  await mutateYaml(root, "scorer-quality-gate.yaml", (value) => {
    value.decision.partial_scope = {
      id: "planned",
      allowed_uses: [],
      prohibited_uses: [],
      evidence_ids: ["evidence.only.a.flag"],
    };
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /status partial requires implemented or validated scorer identity/);
  assert.match(report, /scorer_identity\.implementation_hash: must identify a materialized non-sentinel value/);
  assert.match(report, /validation evidence\.materialized must be true/);
  assert.match(report, /validation evidence must be independently produced/);
  assert.match(report, /validation identity status must be executed, validated or accepted/);
  assert.match(report, /validation\.validation_identity\.executed_at: must be a valid non-future ISO timestamp/);
  assert.match(report, /validation\.evidence\.sample_records\[0\]: must be a non-empty object/);
  assert.match(report, /validation\.evidence\.evidence_links\[0\]: must be a non-empty object/);
  assert.match(report, /validation acceptance\.current_conclusion partial/);
  assert.match(report, /partial_scope\.id: must identify a materialized non-sentinel value/);
  assert.match(report, /partial_scope\.allowed_uses: must be a non-empty array/);
  assert.match(report, /partial_scope\.prohibited_uses: must be a non-empty array/);
  assert.match(report, /partial_scope\.evidence_ids: unknown independent materialized validation evidence id evidence\.only\.a\.flag/);
});

test("A1.6 passed and partial checks require category-compatible independent evidence", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-evidence-category-");
  await materializeA16TemplatePartial(root);
  await mutateYaml(root, "scorer-quality-gate.yaml", (value) => {
    for (const check of value.checks) {
      check.evidence.evidence_links = ["evidence.independent.reliability.example.v1"];
    }
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /checks\[0\]\.evidence\.evidence_links: requires independent materialized identity evidence/);
  assert.match(report, /checks\[1\]\.evidence\.evidence_links: requires independent materialized precedence evidence/);
  assert.match(report, /checks\[3\]\.evidence\.evidence_links: requires independent materialized validity evidence/);

  const recordRoot = await copyUnit(A16_UNIT, "evalorium-a1-6-evidence-record-category-");
  await materializeA16TemplateReady(recordRoot);
  await mutateYaml(recordRoot, "scorer-validation-report.yaml", (value) => {
    delete value.evidence.sample_records[0].category;
    value.evidence.evidence_links[0].category = "generic-proof";
  });
  const recordReport = (await verifyAcademyUnit(recordRoot)).join("\n");
  assert.match(recordReport, /sample_records\[0\]\.category: must be a non-empty string/);
  assert.match(recordReport, /evidence_links\[0\]\.category must be a supported scorer validation evidence category/);
});

test("A1.6 ready validation results require dimension-compatible evidence categories", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-result-evidence-category-");
  await materializeA16TemplateReady(root);
  await mutateYaml(root, "scorer-validation-report.yaml", (value) => {
    value.dimensions.reliability.result.evidence_id = "evidence.independent.validity.example.v1";
    value.security.results.evidence_id = "evidence.independent.calibration.example.v1";
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /dimensions\.reliability\.result\.evidence_id must resolve to reliability validation evidence/);
  assert.match(report, /validation\.security\.results\.evidence_id must resolve to bias-robustness-security validation evidence/);
});

test("A1.6 executed validation timestamps reject future ISO times", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-future-validation-");
  await materializeA16TemplateReady(root);
  await mutateYaml(root, "scorer-validation-report.yaml", (value) => {
    value.validation_identity.executed_at = "2999-01-01T00:00:00.000Z";
  });
  assert.match(
    (await verifyAcademyUnit(root)).join("\n"),
    /validation\.validation_identity\.executed_at: must be a valid non-future ISO timestamp/,
  );
});

test("A1.6 blocked gates require real blocking checks and reject self evidence", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-blocked-gate-");
  await mutateYaml(root, "scorer-quality-gate.yaml", (value) => {
    value.checks[0].evidence.evidence_links = [value.checks[0].id];
    value.decision.blocking_check_ids = ["check.unknown"];
    value.decision.reason = true;
    value.decision.allowed_next_step = false;
    value.decision.prohibited_claims = [];
    value.checks[0].critical = "yes";
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /critical: must be a boolean/);
  assert.match(report, /gate cannot use self evidence id check\.identity/);
  assert.match(report, /blocking_check_ids: unrelated id check\.unknown/);
  assert.match(report, /decision\.reason: must be a non-empty string/);
  assert.match(report, /decision\.allowed_next_step: must be a non-empty string/);
  assert.match(report, /decision\.prohibited_claims: must be a non-empty array/);
});

test("A1.6 ready cannot be manufactured from planned design-only evidence", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-false-ready-");
  await mutateYaml(root, "scorer-quality-gate.yaml", (value) => {
    for (const check of value.checks) check.status = "passed";
    value.decision.status = "ready";
    value.decision.blocking_check_ids = [];
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /ready requires non-planned materialized evidence for every check/);
  assert.match(report, /ready cannot use design-only scorer identity/);
  assert.match(report, /ready requires validation evidence\.materialized true/);
  assert.match(report, /validation identity status must be executed, validated or accepted/);
});

test("A1.6 has a machine-expressible future path to a legitimately validated ready scorer", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-valid-ready-");
  await materializeA16TemplateReady(root);
  assert.deepEqual(await verifyAcademyUnit(root), []);
});

test("A1.6 ready rejects non-independent rejected unbounded and above-threshold validation claims", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-ready-attacks-");
  await materializeA16TemplateReady(root);
  await mutateYaml(root, "scorer-manifest.yaml", (value) => {
    value.scorer_identity.implementation_hash = "sha256:short";
    value.scorer_identity.config_hash = `sha256:${"z".repeat(64)}`;
    value.scorer_identity.runtime_identity = "not-implemented";
    value.scorer_identity.immutable_id = "placeholder";
    value.scorer_identity.input_schema_version = "planned";
    value.scorer_identity.output_schema_version = "bad schema";
  });
  await mutateYaml(root, "scorer-validation-report.yaml", (value) => {
    value.evidence.independent_from_scorer_development = false;
    value.evidence.sample_records[0].hash = "not-a-sha256";
    value.evidence.evidence_links[0].status = "planned";
    value.acceptance.thresholds_declared_before_execution = false;
    value.dimensions.reliability.result.status = "rejected";
    value.dimensions.reliability.result.metric = "borrowed_metric";
    value.dimensions.reliability.result.evidence_id = "evidence.missing.example.v1";
    value.dimensions.validity.result.observed_value = 999;
    value.dimensions.calibration.result.observed_value = 0.9;
    value.error_profile.false_pass.observed_count = 999;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /validation evidence must be independently produced/);
  assert.match(report, /scorer_identity\.implementation_hash: must be sha256 followed by exactly 64 hexadecimal characters/);
  assert.match(report, /scorer_identity\.config_hash: must be sha256 followed by exactly 64 hexadecimal characters/);
  assert.match(report, /scorer_identity\.runtime_identity: must identify a materialized non-sentinel value/);
  assert.match(report, /scorer_identity\.immutable_id: must identify a materialized non-sentinel value/);
  assert.match(report, /scorer_identity\.input_schema_version: must identify a materialized non-sentinel value/);
  assert.match(report, /scorer_identity\.output_schema_version: must be a structured identity/);
  assert.match(report, /validation thresholds must be declared before execution/);
  assert.match(report, /sample_records\[0\]\.hash: must be sha256 followed by exactly 64 hexadecimal characters/);
  assert.match(report, /evidence_links\[0\]\.status must be materialized/);
  assert.match(report, /dimensions\.reliability\.result\.status must be accepted or passed/);
  assert.match(report, /dimensions\.reliability\.result\.metric must match the predeclared threshold metric/);
  assert.match(report, /dimensions\.reliability\.result\.evidence_id must resolve to independent materialized validation evidence/);
  assert.match(report, /dimensions\.validity\.result\.observed_value must be within its declared bounded domain/);
  assert.match(report, /dimensions\.calibration\.result\.observed_value does not satisfy the predeclared threshold/);
  assert.match(report, /error_profile\.false_pass\.observed_count exceeds predeclared max_count/);
});

test("A1.6 ready validation evidence cannot self-certify with report manifest gate or check ids", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-ready-self-evidence-");
  await materializeA16TemplateReady(root);
  let selfId;
  await mutateYaml(root, "scorer-validation-report.yaml", (value) => {
    selfId = value.metadata.id;
    value.evidence.sample_records = [{id: selfId, hash: `sha256:${"d".repeat(64)}`, status: "materialized"}];
    value.evidence.evidence_links = [{id: selfId, hash: `sha256:${"e".repeat(64)}`, status: "materialized"}];
    for (const dimension of ["reliability", "validity", "calibration"]) value.dimensions[dimension].result.evidence_id = selfId;
    value.bias_and_robustness.results.evidence_id = selfId;
    value.security.results.evidence_id = selfId;
  });
  await mutateYaml(root, "scorer-quality-gate.yaml", (value) => {
    for (const check of value.checks) check.evidence.evidence_links = [selfId];
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /validation\.evidence\.sample_records\[0\]\.id must not reuse a scorer design, validation report or gate id/);
  assert.match(report, /validation\.evidence\.evidence_links\[0\]\.id must not reuse a scorer design, validation report or gate id/);
  assert.match(report, /validation\.dimensions\.reliability\.result\.evidence_id must not reuse a scorer design, validation report or gate id/);
  assert.match(report, /checks\[0\]\.evidence\.evidence_links: must not reuse a scorer design, validation report or gate id/);
});

test("A1.6 index rejects broken local href targets after query and fragment removal", async () => {
  const root = await copyUnit(A16_UNIT, "evalorium-a1-6-html-href-");
  const htmlPath = path.join(root, "index.html");
  const source = await readFile(htmlPath, "utf8");
  await writeFile(htmlPath, source.replace("scorer-charter.yaml", "missing-scorer.yaml?view=1#schema"));
  assert.match((await verifyAcademyUnit(root)).join("\n"), /index\.html: broken local href missing-scorer\.yaml\?view=1#schema/);
});

test("an A1.7 score-to-metric profile requires every template and domain case", async () => {
  const root = await createValidUnit();
  await write(
    root,
    "artifact-manifest.yaml",
    `schema_version: 1
unit: {id: A1.7, title: 从样本级评分到可信指标, phase: A, chapter: A1}
publication: {status: candidate, language: zh-CN, formats: [markdown, html, yaml]}
contents:
  lesson: README.md
  html: index.html
  templates: []
  examples: []
verification: {profile: score-to-metric-v1}
`,
  );

  const report = (await verifyAcademyUnit(root)).join("\n");

  assert.match(report, /profile score-to-metric-v1 requires metric-definition\.yaml/);
  assert.match(report, /profile score-to-metric-v1 requires analysis-plan\.yaml/);
  assert.match(report, /profile score-to-metric-v1 requires metric-quality-gate\.yaml/);
  assert.match(report, /profile score-to-metric-v1 requires examples\/knowledge-assistant\/evaluation-case\.yaml/);
});

test("the complete A1.7 score-to-metric candidate is accepted", async () => {
  assert.deepEqual(await verifyAcademyUnit(A17_UNIT), []);
});

test("A1.7 fixes the analysis unit, denominator policy and missingness boundary before execution", async () => {
  const root = await copyUnit(A17_UNIT, "evalorium-a1-7-denominator-");
  await mutateYaml(root, "population-denominator.yaml", (value) => {
    value.analysis_unit.child_units_are_independent_samples = true;
    value.inclusion.declared_before_execution = false;
    value.exclusion.post_outcome_exclusion_allowed = true;
    value.denominator_treatments = value.denominator_treatments.filter((item) => item.status !== "system_crash");
  });
  await mutateYaml(root, "metric-definition.yaml", (value) => {
    value.missingness.silent_drop_allowed = true;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /child_units_are_independent_samples must be false/);
  assert.match(report, /inclusion\.declared_before_execution must be true/);
  assert.match(report, /exclusion\.post_outcome_exclusion_allowed must be false/);
  assert.match(report, /denominator_treatments\.status.*system_crash/);
  assert.match(report, /missingness\.silent_drop_allowed must be false/);
});

test("A1.7 rejects pseudoreplication, compensatory critical risks and fragile complete-case summaries", async () => {
  const root = await copyUnit(A17_UNIT, "evalorium-a1-7-aggregation-");
  await mutateYaml(root, "aggregation-plan.yaml", (value) => {
    value.hierarchy.claim_or_run_as_independent_task = true;
    value.hierarchy.cluster_level = value.hierarchy.analysis_level;
    value.critical_metrics.compensatable = true;
    value.missingness.complete_case_only_as_primary = true;
    value.sensitivity_analysis.variants = ["target_weighted"];
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /claim_or_run_as_independent_task must be false/);
  assert.match(report, /cluster_level must differ from analysis_level/);
  assert.match(report, /critical_metrics\.compensatable must be false/);
  assert.match(report, /complete_case_only_as_primary must be false/);
  assert.match(report, /sensitivity_analysis\.variants.*missing_all_fail/);
  assert.match(report, /sensitivity_analysis\.variants.*missing_all_pass/);
});

test("A1.7 preserves pairing and clusters when estimating uncertainty", async () => {
  const root = await copyUnit(A17_UNIT, "evalorium-a1-7-uncertainty-");
  await mutateYaml(root, "uncertainty-plan.yaml", (value) => {
    value.dependence.iid_run_assumption_allowed = true;
    value.method.resamples = 0;
    value.method.confidence_level = 1;
    value.pairing.enabled = false;
    value.pairing.preserve_baseline_candidate_pair = false;
    value.clustering.resample_whole_clusters = false;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /iid_run_assumption_allowed must be false/);
  assert.match(report, /method\.resamples must be a positive integer/);
  assert.match(report, /method\.confidence_level must be between 0 and 1/);
  assert.match(report, /pairing\.enabled must be true/);
  assert.match(report, /preserve_baseline_candidate_pair must be true/);
  assert.match(report, /resample_whole_clusters must be true/);
});

test("A1.7 keeps confirmatory analysis predeclared and prevents optional stopping", async () => {
  const root = await copyUnit(A17_UNIT, "evalorium-a1-7-analysis-");
  await mutateYaml(root, "analysis-plan.yaml", (value) => {
    value.status = "executed";
    value.multiple_comparisons.method = "none";
    value.exploratory.findings_require_independent_confirmation = false;
    value.stopping_rule.type = "peek_until_significant";
    value.stopping_rule.optional_stopping_allowed = true;
    value.reporting.require_all_predeclared_metrics = false;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /status must be predeclared-not-executed/);
  assert.match(report, /multiple_comparisons\.method must be holm/);
  assert.match(report, /findings_require_independent_confirmation must be true/);
  assert.match(report, /stopping_rule\.type must be fixed_sample/);
  assert.match(report, /optional_stopping_allowed must be false/);
  assert.match(report, /require_all_predeclared_metrics must be true/);
});

test("A1.7 planned records cannot fabricate estimates, comparisons or release claims", async () => {
  const root = await copyUnit(A17_UNIT, "evalorium-a1-7-planned-records-");
  await mutateYaml(root, "estimate-record.yaml", (value) => {
    value.evidence.materialized = true;
    value.result.status = "computed";
    value.result.point_estimate = 0.99;
  });
  await mutateYaml(root, "comparison-report.yaml", (value) => {
    value.evidence.materialized = true;
    value.effect.point_estimate = 0.02;
    value.interpretation.status = "superior";
    value.interpretation.system_release_claim_allowed = true;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /planned estimate evidence\.materialized must be false/);
  assert.match(report, /planned estimate result must remain not-computed/);
  assert.match(report, /planned comparison evidence\.materialized must be false/);
  assert.match(report, /planned comparison effect must remain not-computed/);
  assert.match(report, /planned comparison interpretation\.status must be inconclusive/);
  assert.match(report, /system_release_claim_allowed must be false/);
});

test("A1.7 metric gate cannot become ready from design-only evidence", async () => {
  const root = await copyUnit(A17_UNIT, "evalorium-a1-7-false-ready-");
  await mutateYaml(root, "metric-quality-gate.yaml", (value) => {
    value.decision.status = "ready";
    value.decision.blocking_check_ids = [];
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /ready requires every check to be passed/);
  assert.match(report, /ready requires materialized estimate and comparison evidence/);
});

test("A1.7 domain cases preserve canonical scorer identity and complete trace closure", async () => {
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  const root = await copyUnit(A17_UNIT, "evalorium-a1-7-case-trace-");
  await mutateYaml(root, relativePath, (value) => {
    value.references.scorer_identity_ids = ["scorer-identity.contract.a16"];
    value.expected.trace_closure[0].links = value.expected.trace_closure[0].links.filter((id) => id !== value.references.population_ids[0]);
    value.expected.trace_closure[1].links.push("metric.unknown.a17");
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /references\.scorer_identity_ids.*scorer-identity\.refund\.a16/);
  assert.match(report, /reference population\.refund\.a17 is not covered by expected\.trace_closure/);
  assert.match(report, /expected\.trace_closure\[1\]\.links: unknown id metric\.unknown\.a17/);
});

test("A1.7 HTML cannot link to a missing local artifact", async () => {
  const root = await copyUnit(A17_UNIT, "evalorium-a1-7-html-href-");
  const htmlPath = path.join(root, "index.html");
  await writeFile(htmlPath, (await readFile(htmlPath, "utf8")).replace("metric-definition.yaml", "missing-metric.yaml"));
  assert.match((await verifyAcademyUnit(root)).join("\n"), /index\.html: broken local href missing-metric\.yaml/);
});

test("an A1.8 evidence-to-quality-decision profile requires every template and domain case", async () => {
  const root = await createValidUnit();
  await write(
    root,
    "artifact-manifest.yaml",
    `schema_version: 1
unit: {id: A1.8, title: 从评测证据到质量决策, phase: A, chapter: A1}
publication: {status: candidate, language: zh-CN, formats: [markdown, html, yaml]}
contents:
  lesson: README.md
  html: index.html
  templates: []
  examples: []
verification: {profile: evidence-to-quality-decision-v1}
`,
  );

  const report = (await verifyAcademyUnit(root)).join("\n");

  assert.match(report, /profile evidence-to-quality-decision-v1 requires quality-baseline\.yaml/);
  assert.match(report, /profile evidence-to-quality-decision-v1 requires gate-dependency-graph\.yaml/);
  assert.match(report, /profile evidence-to-quality-decision-v1 requires production-response-policy\.yaml/);
  assert.match(report, /profile evidence-to-quality-decision-v1 requires examples\/knowledge-assistant\/evaluation-case\.yaml/);
});

test("the complete A1.8 evidence-to-quality-decision candidate is accepted", async () => {
  assert.deepEqual(await verifyAcademyUnit(A18_UNIT), []);
});

test("A1.8 keeps critical requirements noncompensatory and nonwaivable", async () => {
  const root = await copyUnit(A18_UNIT, "evalorium-a1-8-baseline-");
  await mutateYaml(root, "quality-baseline.yaml", (value) => {
    value.metric_requirements[1].compensatable = true;
    value.metric_requirements[1].waiver_allowed = true;
    value.combination.weighted_composite_may_override_critical = true;
    value.evidence_requirements.materialized_evidence_required_for_ready = false;
    value.evidence_requirements.inconclusive_required_rule_treatment = "passed";
  });
  await mutateYaml(root, "gate-policy.yaml", (value) => {
    value.waiver_policy.may_change_gate_status = true;
    value.decision_record.immutable = false;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /critical requirement.*compensatable must be false/);
  assert.match(report, /critical requirement.*waiver_allowed must be false/);
  assert.match(report, /weighted_composite_may_override_critical must be false/);
  assert.match(report, /materialized_evidence_required_for_ready must be true/);
  assert.match(report, /inconclusive_required_rule_treatment must be blocked/);
  assert.match(report, /waiver_policy\.may_change_gate_status must be false/);
  assert.match(report, /decision_record\.immutable must be true/);
});

test("A1.8 Gate DAG rejects cycles, dangling edges and missing release paths", async () => {
  const root = await copyUnit(A18_UNIT, "evalorium-a1-8-dag-");
  await mutateYaml(root, "gate-dependency-graph.yaml", (value) => {
    value.edges.push({from: "gate.release.refund.a18", to: "gate.target.refund.a18", relationship: "cycle"});
    value.edges.push({from: "gate.unknown.refund.a18", to: "gate.release.refund.a18", relationship: "dangling"});
    value.nodes = value.nodes.filter((node) => node.type !== "system");
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /nodes\.type: missing related id system/);
  assert.match(report, /edges.*unknown node gate\.unknown\.refund\.a18/);
  assert.match(report, /graph must be acyclic/);
  assert.match(report, /required node.*cannot reach release/);
});

test("A1.8 design-only evidence cannot create a ready decision or real release authorization", async () => {
  const root = await copyUnit(A18_UNIT, "evalorium-a1-8-truth-");
  await mutateYaml(root, "evidence-manifest.yaml", (value) => {
    value.materialized = true;
    value.integrity.identity_reconciled = true;
  });
  await mutateYaml(root, "gate-evaluation.yaml", (value) => {
    value.result.status = "ready";
    value.result.blocking_check_ids = [];
    value.truthfulness.real_system_quality_claim_allowed = true;
  });
  await mutateYaml(root, "gate-decision.yaml", (value) => {
    value.status = "blocked";
    value.validity.effective = true;
    value.reasons.blocking_check_ids = [];
  });
  await mutateYaml(root, "release-disposition.yaml", (value) => {
    value.quality_status = "ready";
    value.status = "authorized";
    value.authorization.real_deployment_authorization = true;
    value.validity.effective = true;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /design-only evidence\.materialized must be false/);
  assert.match(report, /ready requires every check to be passed/);
  assert.match(report, /real_system_quality_claim_allowed must be false/);
  assert.match(report, /gate decision status must equal gate evaluation result status/);
  assert.match(report, /design-only evidence cannot authorize real deployment/);
});

test("A1.8 case references preserve canonical upstream identities and trace closure", async () => {
  const relativePath = "examples/refund-agent/evaluation-case.yaml";
  const root = await copyUnit(A18_UNIT, "evalorium-a1-8-case-trace-");
  await mutateYaml(root, relativePath, (value) => {
    value.references.upstream_scorer_identity_ids = ["scorer-identity.contract.a16"];
    value.expected.trace_closure[0].links = value.expected.trace_closure[0].links.filter(
      (id) => id !== value.references.upstream_dataset_ids[0],
    );
    value.expected.trace_closure[0].links.push("decision.unknown.a18");
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /references\.upstream_scorer_identity_ids.*scorer-identity\.refund\.a16/);
  assert.match(report, /reference dataset\.refund\.a15\.v1 is not covered by expected\.trace_closure/);
  assert.match(report, /expected\.trace_closure\[0\]\.links: unknown id decision\.unknown\.a18/);
});

test("A1.8 critical failed or inconclusive checks block the case decision", async () => {
  const relativePath = "examples/knowledge-assistant/evaluation-case.yaml";
  const root = await copyUnit(A18_UNIT, "evalorium-a1-8-critical-");
  await mutateYaml(root, relativePath, (value) => {
    value.input.gate_evaluation.result.status = "ready";
    value.input.gate_evaluation.result.blocking_check_ids = [];
    value.input.gate_decision.status = "ready";
    value.input.gate_decision.system_release_claim_allowed = true;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /critical failed or inconclusive check requires blocked/);
  assert.match(report, /result\.blocking_check_ids: missing required id check\.knowledge\.acl\.case\.a18/);
  assert.match(report, /system_release_claim_allowed must be false for synthetic evidence/);
});

test("A1.8 partial decisions require enforceable nonexpanding scope", async () => {
  const relativePath = "examples/contract-agent/evaluation-case.yaml";
  const root = await copyUnit(A18_UNIT, "evalorium-a1-8-partial-");
  await mutateYaml(root, relativePath, (value) => {
    value.input.gate_evaluation.result.prohibited_scope = [];
    value.input.gate_decision.allowed_scope.push("en");
    value.input.gate_decision.scope_enforcement_controls = [];
    value.input.release_disposition.allowed_scope.push("external_release");
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /partial prohibited_scope: must be a non-empty array/);
  assert.match(report, /gate decision allowed_scope.*outside prerequisite intersection: en/);
  assert.match(report, /scope_enforcement_controls: must be a non-empty array/);
  assert.match(report, /release allowed_scope.*outside gate decision: external_release/);
});

test("A1.8 waivers cannot rewrite gates or approve nonwaivable critical risk", async () => {
  const relativePath = "examples/knowledge-assistant/evaluation-case.yaml";
  const root = await copyUnit(A18_UNIT, "evalorium-a1-8-waiver-");
  await mutateYaml(root, relativePath, (value) => {
    value.input.waiver.status = "approved";
    value.input.waiver.eligible = true;
    value.input.waiver.may_modify_gate_status = true;
    value.input.waiver.expires_at = null;
    value.input.release_disposition.quality_status = "ready";
    value.input.release_disposition.status = "authorized";
    value.input.release_disposition.real_deployment_authorization = true;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /nonwaivable critical requirement cannot have an approved waiver/);
  assert.match(report, /waiver\.may_modify_gate_status must be false/);
  assert.match(report, /approved waiver requires expires_at/);
  assert.match(report, /release quality_status must equal gate decision status/);
  assert.match(report, /synthetic evidence cannot authorize real deployment/);
});

test("A1.8 production response preserves evidence and feeds incidents back into evaluation", async () => {
  const root = await copyUnit(A18_UNIT, "evalorium-a1-8-production-");
  await mutateYaml(root, "production-response-policy.yaml", (value) => {
    value.signals.hard_events[0].critical = false;
    value.actions.freeze = ["notify_only"];
    value.actions.revoke = [];
    value.actions.rollback = ["route_to_baseline"];
    value.incident_to_evaluation.harness_replay_required = false;
    value.incident_to_evaluation.protected_regression_required = false;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /hard_events\[0\]\.critical must be true/);
  assert.match(report, /actions\.freeze.*preserve_evidence/);
  assert.match(report, /actions\.revoke: must be a non-empty array/);
  assert.match(report, /actions\.rollback.*require_reevaluation/);
  assert.match(report, /harness_replay_required must be true/);
  assert.match(report, /protected_regression_required must be true/);
});

test("A1.8 HTML cannot link to a missing local artifact", async () => {
  const root = await copyUnit(A18_UNIT, "evalorium-a1-8-html-href-");
  const htmlPath = path.join(root, "index.html");
  await writeFile(
    htmlPath,
    (await readFile(htmlPath, "utf8")).replace("quality-baseline.yaml", "missing-baseline.yaml"),
  );
  assert.match((await verifyAcademyUnit(root)).join("\n"), /index\.html: broken local href missing-baseline\.yaml/);
});

test("an A1.9 plan-to-reproducible-run profile requires every contract and domain case", async () => {
  const root = await createValidUnit();
  await write(
    root,
    "artifact-manifest.yaml",
    `schema_version: 1
unit: {id: A1.9, title: 从评测计划到可复现运行, phase: A, chapter: A1}
publication: {status: candidate, language: zh-CN, formats: [markdown, html, yaml]}
contents: {lesson: README.md, html: index.html, templates: [], examples: []}
verification: {profile: plan-to-reproducible-run-v1}
`,
  );

  const report = (await verifyAcademyUnit(root)).join("\n");

  assert.match(report, /requires run-spec\.yaml/);
  assert.match(report, /requires run-audit-report\.yaml/);
  assert.match(report, /requires examples\/knowledge-assistant\/evaluation-case\.yaml/);
});

test("A1.9 keeps Trial counts independent from retry Attempts", async () => {
  const root = await copyUnit(A19_UNIT, "evalorium-a1-9-denominator-");
  await mutateYaml(root, "trial-plan.yaml", (value) => {
    value.counts.planned_trials = 1006;
  });
  await mutateYaml(root, "attempt-ledger.yaml", (value) => {
    value.summary.statistical_denominator = value.summary.total_attempts;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /planned_trials must equal sample_count \* target_count \* repetitions/);
  assert.match(report, /statistical denominator must equal planned canonical Trials/);
});

test("A1.9 rejects Harness retry of target failures", async () => {
  const root = await copyUnit(A19_UNIT, "evalorium-a1-9-target-retry-");
  await mutateYaml(root, "execution-policy.yaml", (value) => {
    value.error_taxonomy.target_failure.harness_retry_allowed = true;
    value.retry_policy.allowed_failure_codes.push("AGENT_STEP_LIMIT");
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /target failure harness_retry_allowed must be false/);
  assert.match(report, /allowed_failure_codes cannot include AGENT_STEP_LIMIT/);
});

test("A1.9 requires immutable resolved identity before direct comparison", async () => {
  const root = await copyUnit(A19_UNIT, "evalorium-a1-9-identity-");
  await mutateYaml(root, "resolved-run-identity.yaml", (value) => {
    value.resolutions[0].mutable_alias_as_final_identity = true;
    value.resolutions[0].immutable = false;
    value.reconciliation.status = "mismatch";
    value.comparability.direct_comparison_allowed = true;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /mutable alias cannot be a final resolved identity/);
  assert.match(report, /resolved identity must be immutable/);
  assert.match(report, /direct comparison requires reconciliation status match/);
});

test("A1.9 permits only one current canonical Attempt per Trial", async () => {
  const root = await copyUnit(A19_UNIT, "evalorium-a1-9-canonical-");
  await mutateYaml(root, "attempt-ledger.yaml", (value) => {
    value.attempts[1].canonical = true;
    value.attempts[1].score_eligible = true;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /canonical attempt must hold a current lease/);
  assert.match(report, /score-eligible attempt must be canonical with a current lease/);
});

test("A1.9 binds every Score Event to canonical evidence", async () => {
  const root = await copyUnit(A19_UNIT, "evalorium-a1-9-score-lineage-");
  await mutateYaml(root, "artifact-lineage-manifest.yaml", (value) => {
    value.score_events[0].observation_bundle_digest = `sha256:${"f".repeat(64)}`;
    value.score_events[0].canonical_attempt_id = "attempt.refund.002a";
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /score event observation bundle digest does not resolve/);
  assert.match(report, /score event must bind a score-eligible canonical Attempt/);
});

test("A1.9 preserves Trace causality and prohibits hidden chain-of-thought capture", async () => {
  const root = await copyUnit(A19_UNIT, "evalorium-a1-9-trace-");
  await mutateYaml(root, "trace-contract.yaml", (value) => {
    value.reasoning_capture.hidden_chain_of_thought = "required";
    value.causality.timestamp_alone_may_define_causality = true;
    value.events[2].parent_event_id = "evt.unknown";
    value.events[2].sequence_number = value.events[1].sequence_number;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /hidden_chain_of_thought must be prohibited/);
  assert.match(report, /timestamp alone cannot define causality/);
  assert.match(report, /unknown parent event evt\.unknown/);
  assert.match(report, /sequence numbers must be unique/);
});

test("A1.9 separates product and Harness budgets and forbids optional stopping", async () => {
  const root = await copyUnit(A19_UNIT, "evalorium-a1-9-budget-");
  await mutateYaml(root, "budget-and-stopping-policy.yaml", (value) => {
    value.product_budget.owner = "evaluation_harness";
    value.harness_budget.exhaustion_counts_as_product_failure = true;
    value.stopping_rules.optional_stopping_allowed = true;
    value.conclusion_policy.safety_stop_may_support_complete_capability_estimate = true;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /product_budget\.owner must be target_system/);
  assert.match(report, /Harness budget exhaustion cannot count as product failure/);
  assert.match(report, /optional_stopping_allowed must be false/);
  assert.match(report, /safety stop cannot support a complete capability estimate/);
});

test("A1.9 adapter contracts cannot invent unavailable source capabilities", async () => {
  const root = await copyUnit(A19_UNIT, "evalorium-a1-9-adapter-");
  await mutateYaml(root, "adapter-capability-contract.yaml", (value) => {
    value.adapters.find((adapter) => adapter.id === "langsmith").attempt_identity = "full";
    value.normalization.unavailable_capability_may_be_invented = true;
    value.normalization.external_pass_is_release_authorization = true;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /adapter langsmith attempt_identity must be unavailable/);
  assert.match(report, /unavailable_capability_may_be_invented must be false/);
  assert.match(report, /external pass cannot be release authorization/);
});

test("A1.9 cases preserve audit closure and synthetic evidence boundaries", async () => {
  const relativePath = "examples/knowledge-assistant/evaluation-case.yaml";
  const root = await copyUnit(A19_UNIT, "evalorium-a1-9-case-");
  await mutateYaml(root, relativePath, (value) => {
    value.expected.audit_trace_closure[0].links = value.expected.audit_trace_closure[0].links.filter(
      (id) => id !== value.references.upstream_gate_decision_ids[0],
    );
    value.evidence.production_evidence = true;
    value.evidence.real_release_authorization = true;
    value.evidence.personal_capability_claim = true;
  });
  const report = (await verifyAcademyUnit(root)).join("\n");
  assert.match(report, /reference decision\.knowledge\.case\.a18 is not covered by expected\.audit_trace_closure/);
  assert.match(report, /evidence\.production_evidence must be false/);
  assert.match(report, /evidence\.real_release_authorization must be false/);
  assert.match(report, /evidence\.personal_capability_claim must be false/);
});

test("the complete A1.9 plan-to-reproducible-run candidate is accepted", async () => {
  assert.deepEqual(await verifyAcademyUnit(A19_UNIT), []);
});

test("A1.9 HTML cannot link to a missing local artifact", async () => {
  const root = await copyUnit(A19_UNIT, "evalorium-a1-9-html-");
  const htmlPath = path.join(root, "index.html");
  await writeFile(
    htmlPath,
    (await readFile(htmlPath, "utf8")).replace("run-spec.yaml", "missing-run-spec.yaml"),
  );
  assert.match((await verifyAcademyUnit(root)).join("\n"), /index\.html: broken local href missing-run-spec\.yaml/);
});
