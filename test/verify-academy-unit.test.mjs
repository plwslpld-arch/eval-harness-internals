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
