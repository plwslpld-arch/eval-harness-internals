import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

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

async function write(root, relativePath, content) {
  const destination = path.join(root, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content);
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
