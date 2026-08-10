import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { parse as parseYaml } from "yaml";

const REQUIRED_FILES = [
  "README.md",
  "index.html",
  "artifact-manifest.yaml",
];

const PUBLICATION_STATUSES = new Set(["candidate", "validated"]);

const VERIFICATION_PROFILES = {
  "a1-1-foundations-v1": {
    templates: [
      "evaluation-charter.yaml",
      "evaluation-target.yaml",
      "risk-definition.yaml",
      "task-spec.yaml",
      "harness-manifest.yaml",
      "metric-card.yaml",
      "gate-policy.yaml",
      "gate-decision.yaml",
      "monitoring-signal.yaml",
    ],
    examples: [
      "examples/refund-agent/evaluation-case.yaml",
      "examples/contract-agent/evaluation-case.yaml",
    ],
  },
  "requirements-to-evidence-v1": {
    templates: [
      "evaluation-charter.yaml",
      "risk-taxonomy.yaml",
      "stakeholder-impact-map.yaml",
      "construct-definition.yaml",
      "evidence-requirements.yaml",
      "requirements-traceability.yaml",
    ],
    examples: [
      "examples/refund-agent/evaluation-case.yaml",
      "examples/contract-agent/evaluation-case.yaml",
      "examples/knowledge-assistant/evaluation-case.yaml",
    ],
  },
  "target-boundary-version-v1": {
    templates: [
      "evaluation-target.yaml",
      "system-boundary.yaml",
      "target-identity.yaml",
      "runtime-state.yaml",
      "target-reconciliation.yaml",
      "reevaluation-policy.yaml",
    ],
    examples: [
      "examples/refund-agent/evaluation-case.yaml",
      "examples/contract-agent/evaluation-case.yaml",
      "examples/knowledge-assistant/evaluation-case.yaml",
    ],
  },
  "question-to-task-scenario-v1": {
    templates: [
      "scenario-space.yaml",
      "task-spec.yaml",
      "test-case.yaml",
      "variant-plan.yaml",
      "trajectory-contract.yaml",
      "coverage-matrix.yaml",
    ],
    examples: [
      "examples/refund-agent/evaluation-case.yaml",
      "examples/contract-agent/evaluation-case.yaml",
      "examples/knowledge-assistant/evaluation-case.yaml",
    ],
  },
};

const CANONICAL_UNIT_PROFILES = {
  "A1.1": "a1-1-foundations-v1",
  "A1.2": "requirements-to-evidence-v1",
  "A1.3": "target-boundary-version-v1",
  "A1.4": "question-to-task-scenario-v1",
};

const EXPLICIT_PROFILE_UNITS = new Set(["A1.2", "A1.3", "A1.4"]);

const TEMPLATE_CONTRACTS = {
  "artifact-manifest.yaml": {
    kind: null,
    required: [
      "schema_version",
      "unit.id",
      "unit.title",
      "publication.status",
      "publication.formats",
      "contents.lesson",
      "contents.html",
      "contents.templates",
      "contents.examples",
    ],
  },
  "evaluation-charter.yaml": {
    kind: "EvaluationCharter",
    required: ["metadata.id", "decision", "scope", "risks"],
  },
  "evaluation-target.yaml": {
    kind: "EvaluationTarget",
    required: ["metadata.id", "system", "boundary"],
  },
  "risk-definition.yaml": {
    kind: "RiskDefinition",
    required: ["metadata.id", "risk", "measurement"],
  },
  "task-spec.yaml": {
    kind: "TaskSpec",
    required: ["metadata.id", "input", "success"],
  },
  "harness-manifest.yaml": {
    kind: "HarnessManifest",
    required: ["metadata.id", "environment", "tools", "observability"],
  },
  "metric-card.yaml": {
    kind: "MetricDefinition",
    required: ["metadata.id", "construct", "scoring", "uncertainty"],
  },
  "gate-policy.yaml": {
    kind: "GatePolicy",
    required: ["metadata.id", "rules", "decision"],
  },
  "gate-decision.yaml": {
    kind: "GateDecision",
    required: ["metadata.id", "policy_id", "evidence", "outcome"],
  },
  "monitoring-signal.yaml": {
    kind: "MonitoringSignal",
    required: ["metadata.id", "source", "detection", "response"],
  },
  "risk-taxonomy.yaml": {
    kind: "RiskTaxonomy",
    required: ["metadata.id", "categories", "application_rules"],
  },
  "stakeholder-impact-map.yaml": {
    kind: "StakeholderImpactMap",
    required: ["metadata.id", "stakeholders", "impact_chains"],
  },
  "construct-definition.yaml": {
    kind: "ConstructDefinition",
    required: ["metadata.id", "construct", "operationalization", "limitations"],
  },
  "evidence-requirements.yaml": {
    kind: "EvidenceRequirements",
    required: ["metadata.id", "decision", "sources", "sufficiency"],
  },
  "requirements-traceability.yaml": {
    kind: "RequirementsTraceability",
    required: ["metadata.id", "decision", "links"],
  },
  "system-boundary.yaml": {
    kind: "SystemBoundary",
    required: ["metadata.id", "target_id", "boundaries", "components", "rules"],
  },
  "target-identity.yaml": {
    kind: "TargetIdentity",
    required: ["metadata.id", "target_id", "source", "build", "model"],
  },
  "runtime-state.yaml": {
    kind: "RuntimeState",
    required: ["metadata.id", "target_id", "time", "initial_state", "final_state"],
  },
  "target-reconciliation.yaml": {
    kind: "TargetReconciliation",
    required: ["metadata.id", "target_id", "checkpoints", "policy", "outcome"],
  },
  "reevaluation-policy.yaml": {
    kind: "ReevaluationPolicy",
    required: ["metadata.id", "target_id", "change_classification", "actions"],
  },
  "scenario-space.yaml": {
    kind: "ScenarioSpace",
    required: ["metadata.id", "dimensions", "partitions", "scenario_families"],
  },
  "test-case.yaml": {
    kind: "TestCase",
    required: ["metadata.id", "scenario_space_id", "task_spec_id", "cases"],
  },
  "variant-plan.yaml": {
    kind: "VariantPlan",
    required: ["metadata.id", "scenario_space_id", "task_spec_id", "test_case_id", "variants"],
  },
  "trajectory-contract.yaml": {
    kind: "TrajectoryContract",
    required: ["metadata.id", "task_spec_id", "test_case_id", "initial_state", "allowed_transitions"],
  },
  "coverage-matrix.yaml": {
    kind: "CoverageMatrix",
    required: ["metadata.id", "scenario_space_id", "task_spec_id", "test_case_id", "items"],
  },
};

const EXAMPLE_CONTRACT = {
  kind: "EvaluationCase",
  required: ["metadata.id", "references", "input", "expected", "evidence"],
};

const PROFILE_CONTRACTS = {
  "requirements-to-evidence-v1": {
    "evaluation-charter.yaml": {
      kind: "EvaluationCharter",
      required: [
        "metadata.id",
        "decision",
        "scope",
        "stakeholders",
        "risks",
        "evaluation_questions",
        "evidence_requirements",
        "limitations",
      ],
    },
    example: {
      kind: "EvaluationCase",
      required: [
        "metadata.id",
        "references.charter_id",
        "references.risk_ids",
        "references.construct_ids",
        "references.question_ids",
        "references.evidence_requirement_ids",
        "input",
        "expected",
        "evidence",
      ],
    },
  },
  "target-boundary-version-v1": {
    "evaluation-target.yaml": {
      kind: "EvaluationTarget",
      required: [
        "metadata.id",
        "metadata.version",
        "target_id",
        "decision.question",
        "object_level",
        "system.path",
        "boundary.system_boundary_id",
        "boundary.observation_boundary",
        "boundary.claim_boundary",
        "identity_id",
        "runtime_state_id",
        "reconciliation_id",
        "reevaluation_policy_id",
        "limitations",
      ],
    },
    "system-boundary.yaml": {
      kind: "SystemBoundary",
      required: [
        "metadata.id",
        "metadata.version",
        "target_id",
        "boundaries.system",
        "boundaries.evaluation",
        "boundaries.observation",
        "boundaries.claim",
        "components",
        "rules.included",
        "rules.controlled",
        "rules.external",
        "rules.excluded",
        "limitations",
      ],
    },
    "target-identity.yaml": {
      kind: "TargetIdentity",
      required: [
        "metadata.id",
        "metadata.version",
        "target_id",
        "source.commit",
        "build.build_id",
        "build.artifact_digest",
        "build.dependency_lock_digest",
        "model.model_id",
        "model.revision",
        "behavior_configuration",
        "tools",
        "data",
        "deployment",
        "harness",
        "secrets_policy",
      ],
    },
    "runtime-state.yaml": {
      kind: "RuntimeState",
      required: [
        "metadata.id",
        "metadata.version",
        "target_id",
        "identity_id",
        "time.started_at",
        "time.ended_at",
        "time.duration",
        "identity_and_access",
        "initial_state",
        "dependencies",
        "execution.seed",
        "execution.concurrency",
        "execution.budgets",
        "final_state.state_diff",
        "final_state.tool_side_effects",
        "replay.reconstruction_instructions",
        "replay.evidence_bundle_id",
      ],
    },
    "target-reconciliation.yaml": {
      kind: "TargetReconciliation",
      required: [
        "metadata.id",
        "metadata.version",
        "target_id",
        "boundary_id",
        "identity_id",
        "runtime_state_id",
        "checkpoints",
        "policy.critical_mismatch",
        "policy.missing_identity",
        "policy.noncritical_mismatch",
        "outcome.status",
      ],
    },
    "reevaluation-policy.yaml": {
      kind: "ReevaluationPolicy",
      required: [
        "metadata.id",
        "metadata.version",
        "target_id",
        "change_classification.low",
        "change_classification.medium",
        "change_classification.high",
        "change_classification.boundary_expansion",
        "actions.low",
        "actions.medium",
        "actions.high",
        "actions.boundary_expansion",
        "full_reevaluation_triggers",
        "validity",
        "responsibility.change_classifier",
        "responsibility.impact_reviewer",
        "responsibility.risk_approver",
      ],
    },
    example: {
      kind: "EvaluationCase",
      required: [
        "metadata.id",
        "references.target_id",
        "references.boundary_id",
        "references.identity_id",
        "references.runtime_state_id",
        "references.reconciliation_id",
        "references.reevaluation_policy_id",
        "input.original_requirement",
        "input.decision",
        "input.target.id",
        "input.target.object_level",
        "input.target.path",
        "input.target.claim_boundary",
        "input.boundary.id",
        "input.boundary.system",
        "input.boundary.included",
        "input.boundary.controlled",
        "input.boundary.external",
        "input.boundary.excluded",
        "input.boundary.observation",
        "input.identity.id",
        "input.identity.immutable",
        "input.identity.deployment",
        "input.runtime_state.id",
        "input.runtime_state.initial",
        "input.runtime_state.temporal",
        "input.runtime_state.injected",
        "input.runtime_state.final_capture",
        "input.reconciliation.id",
        "input.reconciliation.checkpoints",
        "input.reconciliation.critical_mismatch_action",
        "input.reevaluation_policy.id",
        "input.reevaluation_policy.targeted",
        "input.reevaluation_policy.full",
        "expected.evidence_boundary",
        "expected.reconciliation_result",
        "expected.valid_claims",
        "expected.invalid_claims",
        "expected.decision_actions",
        "evidence.required",
        "evidence.assertions",
        "evidence.traceability",
        "evidence.limitations",
      ],
    },
  },
  "question-to-task-scenario-v1": {
    "scenario-space.yaml": {
      kind: "ScenarioSpace",
      required: [
        "metadata.id",
        "metadata.version",
        "target_id",
        "question_ids",
        "risk_ids",
        "construct_ids",
        "risks",
        "dimensions",
        "partitions",
        "scenario_families",
        "sampling_policy.representative",
        "sampling_policy.risk_directed",
        "coverage_policy",
      ],
    },
    "task-spec.yaml": {
      kind: "TaskSpec",
      required: [
        "metadata.id",
        "metadata.version",
        "scenario_space_id",
        "target_id",
        "construct_ids",
        "questions",
        "tasks",
        "generation_rules",
      ],
    },
    "test-case.yaml": {
      kind: "TestCase",
      required: [
        "metadata.id",
        "metadata.version",
        "scenario_space_id",
        "task_spec_id",
        "target_id",
        "construct_ids",
        "cases",
        "oracle_policy",
      ],
    },
    "variant-plan.yaml": {
      kind: "VariantPlan",
      required: [
        "metadata.id",
        "metadata.version",
        "scenario_space_id",
        "task_spec_id",
        "test_case_id",
        "variants",
        "control_policy",
      ],
    },
    "trajectory-contract.yaml": {
      kind: "TrajectoryContract",
      required: [
        "metadata.id",
        "metadata.version",
        "task_spec_id",
        "test_case_id",
        "initial_state",
        "actions",
        "observations",
        "allowed_transitions",
        "recovery_invariants.fault",
        "recovery_invariants.time",
        "recovery_invariants.concurrency",
        "evidence_observations",
        "budgets",
      ],
    },
    "coverage-matrix.yaml": {
      kind: "CoverageMatrix",
      required: [
        "metadata.id",
        "metadata.version",
        "scenario_space_id",
        "task_spec_id",
        "test_case_id",
        "variant_plan_id",
        "trajectory_contract_id",
        "target_id",
        "construct_ids",
        "items",
        "coverage_claims",
        "limitations",
      ],
    },
    example: {
      kind: "EvaluationCase",
      required: [
        "metadata.id",
        "references.scenario_space_id",
        "references.target_id",
        "references.construct_ids",
        "references.risk_ids",
        "references.dimension_ids",
        "references.partition_ids",
        "references.scenario_family_ids",
        "references.question_ids",
        "references.task_ids",
        "references.case_ids",
        "references.variant_ids",
        "references.transition_ids",
        "references.evidence_ids",
        "references.coverage_item_ids",
        "input.scenario_space.id",
        "input.scenario_space.target_id",
        "input.scenario_space.construct_ids",
        "input.risks",
        "input.dimensions",
        "input.partitions",
        "input.scenario_families",
        "input.questions",
        "input.tasks",
        "input.cases",
        "input.variants",
        "input.trajectory.initial_state",
        "input.trajectory.actions",
        "input.trajectory.observations",
        "input.trajectory.transitions",
        "input.trajectory.recovery_invariants.fault",
        "input.trajectory.recovery_invariants.time",
        "input.trajectory.recovery_invariants.concurrency",
        "expected.coverage_items",
        "expected.decision_actions",
        "evidence.requirements",
        "evidence.traceability",
        "evidence.limitations",
      ],
    },
  },
};

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getPath(value, dottedPath) {
  return dottedPath.split(".").reduce((current, key) => current?.[key], value);
}

function isMissing(value) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0)
  );
}

function flattenDeclaredArtifacts(manifest) {
  const contents = manifest?.contents ?? {};
  return [
    contents.lesson,
    contents.html,
    ...(Array.isArray(contents.templates) ? contents.templates : []),
    ...(Array.isArray(contents.examples) ? contents.examples : []),
  ].filter((value) => typeof value === "string" && value.length > 0);
}

function isSafeRelativePath(relativePath) {
  return (
    typeof relativePath === "string" &&
    relativePath.length > 0 &&
    !path.isAbsolute(relativePath) &&
    !relativePath.split(/[\\/]/).includes("..")
  );
}

function verifyManifest(manifest, errors) {
  if (!manifest) return;

  if (!PUBLICATION_STATUSES.has(manifest?.publication?.status)) {
    errors.push(
      "artifact-manifest.yaml: publication.status must be candidate or validated",
    );
  }

  const formats = manifest?.publication?.formats;
  for (const format of ["markdown", "html", "yaml"]) {
    if (!Array.isArray(formats) || !formats.includes(format)) {
      errors.push(`artifact-manifest.yaml: publication.formats must include ${format}`);
    }
  }

  for (const field of ["templates", "examples"]) {
    const declared = manifest?.contents?.[field];
    if (!Array.isArray(declared) || declared.length === 0) {
      errors.push(`artifact-manifest.yaml: contents.${field} must be a non-empty array`);
      continue;
    }
    for (const declaredPath of declared) {
      if (typeof declaredPath !== "string" || declaredPath.length === 0) {
        errors.push(
          `artifact-manifest.yaml: contents.${field} entries must be non-empty strings`,
        );
      }
    }
  }

  const declaredArtifacts = flattenDeclaredArtifacts(manifest);
  const duplicates = declaredArtifacts.filter(
    (value, index) => declaredArtifacts.indexOf(value) !== index,
  );
  for (const duplicate of new Set(duplicates)) {
    errors.push(`artifact-manifest.yaml: duplicate declared artifact ${duplicate}`);
  }
  for (const declaredPath of declaredArtifacts) {
    if (!isSafeRelativePath(declaredPath)) {
      errors.push(`artifact-manifest.yaml: unsafe declared artifact path ${declaredPath}`);
    }
  }
}

function verifyProfile(manifest, errors) {
  const unitId = manifest?.unit?.id;
  const declaredProfile = manifest?.verification?.profile;
  const canonicalProfile = CANONICAL_UNIT_PROFILES[unitId];
  if (EXPLICIT_PROFILE_UNITS.has(unitId) && !declaredProfile) {
    errors.push(`artifact-manifest.yaml: ${unitId} requires verification.profile`);
  }
  if (canonicalProfile && declaredProfile && declaredProfile !== canonicalProfile) {
    errors.push(
      `artifact-manifest.yaml: unit ${unitId} must use verification.profile ${canonicalProfile}`,
    );
  }
  const profileName = canonicalProfile ?? declaredProfile;
  if (!profileName) return null;

  const profile = VERIFICATION_PROFILES[profileName];
  if (!profile) {
    errors.push(`artifact-manifest.yaml: unknown verification.profile ${profileName}`);
    return null;
  }

  for (const field of ["templates", "examples"]) {
    const declared = manifest?.contents?.[field] ?? [];
    for (const requiredPath of profile[field]) {
      if (!declared.includes(requiredPath)) {
        errors.push(
          `artifact-manifest.yaml: profile ${profileName} requires ${requiredPath}`,
        );
      }
    }
  }
  return profileName;
}

function verifyIdList(value, label, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${label}: must be a non-empty array`);
    return [];
  }

  const ids = [];
  for (const item of value) {
    const id = typeof item === "string" ? item : item?.id;
    if (typeof id !== "string" || id.length === 0) {
      errors.push(`${label}: entries must provide a non-empty id`);
      continue;
    }
    ids.push(id);
  }
  for (const duplicate of new Set(ids.filter((id, index) => ids.indexOf(id) !== index))) {
    errors.push(`${label}: duplicate id ${duplicate}`);
  }
  return ids;
}

function verifyRequirementsTraceability(value, relativePath, errors) {
  const allowedStatuses = new Set(["covered", "partial", "blocked", "out_of_scope"]);
  if (!Array.isArray(value?.links) || value.links.length === 0) return;

  for (const [index, link] of value.links.entries()) {
    const label = `${relativePath}: links[${index}]`;
    for (const field of [
      "requirement_id",
      "original_requirement",
      "stakeholder_ids",
      "risk_ids",
      "construct_ids",
      "question_ids",
      "scenario_ids",
      "evidence_requirement_ids",
      "gate_rule_ids",
      "accountable_owner",
      "action_on_failure",
      "status",
    ]) {
      if (isMissing(link?.[field])) errors.push(`${label}: missing required key ${field}`);
    }
    for (const field of [
      "stakeholder_ids",
      "risk_ids",
      "construct_ids",
      "question_ids",
      "scenario_ids",
      "evidence_requirement_ids",
      "gate_rule_ids",
    ]) {
      if (!isMissing(link?.[field])) {
        verifyIdList(link[field], `${label}.${field}`, errors);
      }
    }
    if (!allowedStatuses.has(link?.status)) {
      errors.push(`${label}.status: must be covered, partial, blocked or out_of_scope`);
    }
  }
}

function verifyEvaluationCaseReferences(value, relativePath, errors) {
  if (!value) return;
  const entitySets = {
    risk_ids: verifyIdList(value?.input?.risks, `${relativePath}: input.risks`, errors),
    construct_ids: verifyIdList(
      value?.input?.constructs,
      `${relativePath}: input.constructs`,
      errors,
    ),
    question_ids: verifyIdList(
      value?.input?.questions,
      `${relativePath}: input.questions`,
      errors,
    ),
    evidence_requirement_ids: verifyIdList(
      value?.evidence?.requirements,
      `${relativePath}: evidence.requirements`,
      errors,
    ),
  };

  const allEntityIds = new Set();
  for (const [referenceField, definedIds] of Object.entries(entitySets)) {
    const referencedIds = verifyIdList(
      value?.references?.[referenceField],
      `${relativePath}: references.${referenceField}`,
      errors,
    );
    const defined = new Set(definedIds);
    const referenced = new Set(referencedIds);
    for (const id of referenced) {
      if (!defined.has(id)) {
        errors.push(`${relativePath}: references.${referenceField} has unknown id ${id}`);
      }
      allEntityIds.add(id);
    }
    for (const id of defined) {
      if (!referenced.has(id)) {
        errors.push(`${relativePath}: ${id} is not declared in references.${referenceField}`);
      }
      allEntityIds.add(id);
    }
  }

  const traces = value?.evidence?.traceability;
  if (!Array.isArray(traces) || traces.length === 0) {
    errors.push(`${relativePath}: evidence.traceability must be a non-empty array`);
    return;
  }

  const tracedIds = new Set();
  for (const [index, trace] of traces.entries()) {
    const label = `${relativePath}: evidence.traceability[${index}]`;
    if (isMissing(trace?.requirement)) errors.push(`${label}: missing required key requirement`);
    if (isMissing(trace?.action)) errors.push(`${label}: missing required key action`);
    const linkIds = verifyIdList(trace?.links, `${label}.links`, errors);
    for (const id of linkIds) {
      if (!allEntityIds.has(id)) errors.push(`${label}.links: unknown id ${id}`);
      tracedIds.add(id);
    }
  }
  for (const id of allEntityIds) {
    if (!tracedIds.has(id)) {
      errors.push(`${relativePath}: ${id} is not covered by evidence.traceability`);
    }
  }
}

function verifyRequiredEntryFields(entries, fields, label, errors) {
  if (!Array.isArray(entries) || entries.length === 0) {
    errors.push(`${label}: must be a non-empty array`);
    return;
  }
  for (const [index, entry] of entries.entries()) {
    for (const field of fields) {
      if (isMissing(entry?.[field])) {
        errors.push(`${label}[${index}]: missing required key ${field}`);
      }
    }
  }
}

function verifyEqualReference(actual, expected, label, errors) {
  if (!isMissing(actual) && !isMissing(expected) && actual !== expected) {
    errors.push(`${label}: expected ${expected}, received ${actual}`);
  }
}

function verifyTargetBoundaryVersionTemplates(templateValues, errors) {
  const target = templateValues.get("evaluation-target.yaml");
  const boundary = templateValues.get("system-boundary.yaml");
  const identity = templateValues.get("target-identity.yaml");
  const runtime = templateValues.get("runtime-state.yaml");
  const reconciliation = templateValues.get("target-reconciliation.yaml");
  const reevaluation = templateValues.get("reevaluation-policy.yaml");

  const targetId = target?.metadata?.id;
  verifyEqualReference(target?.target_id, targetId, "evaluation-target.yaml: target_id", errors);
  for (const [relativePath, value] of [
    ["system-boundary.yaml", boundary],
    ["target-identity.yaml", identity],
    ["runtime-state.yaml", runtime],
    ["target-reconciliation.yaml", reconciliation],
    ["reevaluation-policy.yaml", reevaluation],
  ]) {
    verifyEqualReference(value?.target_id, targetId, `${relativePath}: target_id`, errors);
  }

  verifyEqualReference(
    target?.boundary?.system_boundary_id,
    boundary?.metadata?.id,
    "evaluation-target.yaml: boundary.system_boundary_id",
    errors,
  );
  verifyEqualReference(
    target?.identity_id,
    identity?.metadata?.id,
    "evaluation-target.yaml: identity_id",
    errors,
  );
  verifyEqualReference(
    target?.runtime_state_id,
    runtime?.metadata?.id,
    "evaluation-target.yaml: runtime_state_id",
    errors,
  );
  verifyEqualReference(
    target?.reconciliation_id,
    reconciliation?.metadata?.id,
    "evaluation-target.yaml: reconciliation_id",
    errors,
  );
  verifyEqualReference(
    target?.reevaluation_policy_id,
    reevaluation?.metadata?.id,
    "evaluation-target.yaml: reevaluation_policy_id",
    errors,
  );
  verifyEqualReference(
    runtime?.identity_id,
    identity?.metadata?.id,
    "runtime-state.yaml: identity_id",
    errors,
  );
  for (const [field, expected] of [
    ["boundary_id", boundary?.metadata?.id],
    ["identity_id", identity?.metadata?.id],
    ["runtime_state_id", runtime?.metadata?.id],
  ]) {
    verifyEqualReference(
      reconciliation?.[field],
      expected,
      `target-reconciliation.yaml: ${field}`,
      errors,
    );
  }

  const components = boundary?.components;
  verifyRequiredEntryFields(
    components,
    ["id", "role", "reason"],
    "system-boundary.yaml: components",
    errors,
  );
  if (Array.isArray(components)) {
    const allowedRoles = new Set(["included", "controlled", "external", "excluded"]);
    const roles = new Set();
    const componentIds = [];
    for (const [index, component] of components.entries()) {
      if (!allowedRoles.has(component?.role)) {
        errors.push(
          `system-boundary.yaml: components[${index}].role must be included, controlled, external or excluded`,
        );
      } else {
        roles.add(component.role);
      }
      if (typeof component?.id === "string") componentIds.push(component.id);
    }
    for (const role of allowedRoles) {
      if (!roles.has(role)) errors.push(`system-boundary.yaml: components must cover role ${role}`);
    }
    for (const duplicate of new Set(
      componentIds.filter((id, index) => componentIds.indexOf(id) !== index),
    )) {
      errors.push(`system-boundary.yaml: duplicate component id ${duplicate}`);
    }
  }

  const checkpoints = reconciliation?.checkpoints;
  verifyRequiredEntryFields(
    checkpoints,
    ["field", "declared", "executed", "evidence", "reported", "critical", "status"],
    "target-reconciliation.yaml: checkpoints",
    errors,
  );
  const allowedCheckpointStatuses = new Set(["match", "mismatch", "unobserved"]);
  if (Array.isArray(checkpoints)) {
    for (const [index, checkpoint] of checkpoints.entries()) {
      if (!allowedCheckpointStatuses.has(checkpoint?.status)) {
        errors.push(
          `target-reconciliation.yaml: checkpoints[${index}].status must be match, mismatch or unobserved`,
        );
      }
      if (checkpoint?.status === "match") {
        const comparedValues = [
          checkpoint?.declared,
          checkpoint?.executed,
          checkpoint?.evidence,
          checkpoint?.reported,
        ].map((value) => JSON.stringify(value));
        if (new Set(comparedValues).size !== 1) {
          errors.push(
            `target-reconciliation.yaml: checkpoints[${index}] cannot be match when declared, executed, evidence and reported differ`,
          );
        }
      }
    }
  }
  const allowedOutcomes = new Set(["pending", "reconciled", "drifted", "inconclusive"]);
  if (!allowedOutcomes.has(reconciliation?.outcome?.status)) {
    errors.push(
      "target-reconciliation.yaml: outcome.status must be pending, reconciled, drifted or inconclusive",
    );
  }
  for (const field of ["valid_run_ids", "invalid_run_ids", "limitations"]) {
    if (!Array.isArray(reconciliation?.outcome?.[field])) {
      errors.push(`target-reconciliation.yaml: outcome.${field} must be an array`);
    }
  }
  if (
    reconciliation?.outcome?.status === "reconciled" &&
    checkpoints?.some((checkpoint) => checkpoint?.status !== "match")
  ) {
    errors.push(
      "target-reconciliation.yaml: outcome.status cannot be reconciled when a checkpoint is mismatch or unobserved",
    );
  }
}

function verifyTargetBoundaryVersionCase(value, relativePath, errors) {
  if (!value) return;
  const entities = [
    ["target_id", value?.input?.target?.id],
    ["boundary_id", value?.input?.boundary?.id],
    ["identity_id", value?.input?.identity?.id],
    ["runtime_state_id", value?.input?.runtime_state?.id],
    ["reconciliation_id", value?.input?.reconciliation?.id],
    ["reevaluation_policy_id", value?.input?.reevaluation_policy?.id],
  ];
  const entityIds = [];
  for (const [referenceField, definitionId] of entities) {
    const referencedId = value?.references?.[referenceField];
    verifyEqualReference(
      referencedId,
      definitionId,
      `${relativePath}: references.${referenceField}`,
      errors,
    );
    if (typeof definitionId === "string" && definitionId.length > 0) entityIds.push(definitionId);
  }
  for (const duplicate of new Set(
    entityIds.filter((id, index) => entityIds.indexOf(id) !== index),
  )) {
    errors.push(`${relativePath}: entity id ${duplicate} is reused across target entity types`);
  }
  if (value?.input?.original_requirement !== "这个 Agent 要可靠，可以上线") {
    errors.push(
      `${relativePath}: input.original_requirement must be 这个 Agent 要可靠，可以上线`,
    );
  }

  for (const field of [
    "input.decision",
    "input.target.object_level",
    "input.reconciliation.critical_mismatch_action",
    "expected.evidence_boundary",
    "expected.reconciliation_result",
  ]) {
    const fieldValue = getPath(value, field);
    if (typeof fieldValue !== "string" || fieldValue.length === 0) {
      errors.push(`${relativePath}: ${field} must be a non-empty string`);
    }
  }
  for (const field of [
    "input.target.path",
    "input.boundary.system",
    "input.boundary.included",
    "input.boundary.controlled",
    "input.boundary.external",
    "input.boundary.excluded",
    "input.boundary.observation",
    "input.identity.immutable",
    "input.runtime_state.initial",
    "input.runtime_state.temporal",
    "input.runtime_state.injected",
    "input.runtime_state.final_capture",
    "input.reconciliation.checkpoints",
    "input.reevaluation_policy.full",
    "expected.valid_claims",
    "expected.invalid_claims",
    "evidence.required",
    "evidence.assertions",
    "evidence.limitations",
  ]) {
    const fieldValue = getPath(value, field);
    if (!Array.isArray(fieldValue) || fieldValue.length === 0) {
      errors.push(`${relativePath}: ${field} must be a non-empty array`);
    }
  }
  for (const field of [
    "input.target.claim_boundary",
    "input.identity.deployment",
    "input.reevaluation_policy.targeted",
    "expected.decision_actions",
  ]) {
    const fieldValue = getPath(value, field);
    if (
      typeof fieldValue !== "object" ||
      fieldValue === null ||
      Array.isArray(fieldValue) ||
      Object.keys(fieldValue).length === 0
    ) {
      errors.push(`${relativePath}: ${field} must be a non-empty object`);
    }
  }

  const traces = value?.evidence?.traceability;
  verifyRequiredEntryFields(
    traces,
    ["claim", "links", "action"],
    `${relativePath}: evidence.traceability`,
    errors,
  );
  if (!Array.isArray(traces)) return;
  const knownIds = new Set(entityIds);
  const tracedIds = new Set();
  for (const [index, trace] of traces.entries()) {
    const links = verifyIdList(
      trace?.links,
      `${relativePath}: evidence.traceability[${index}].links`,
      errors,
    );
    for (const id of links) {
      if (!knownIds.has(id)) {
        errors.push(`${relativePath}: evidence.traceability[${index}].links has unknown id ${id}`);
      }
      tracedIds.add(id);
    }
  }
  for (const id of knownIds) {
    if (!tracedIds.has(id)) {
      errors.push(`${relativePath}: ${id} is not covered by evidence.traceability`);
    }
  }
}

function isNonEmptyObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function verifyNonEmptyObject(value, label, errors) {
  if (!isNonEmptyObject(value)) {
    errors.push(`${label}: must be a non-empty object`);
    return false;
  }
  return true;
}

function verifyNonEmptyArray(value, label, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${label}: must be a non-empty array`);
    return false;
  }
  return true;
}

function verifyNonEmptyString(value, label, errors) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${label}: must be a non-empty string`);
    return false;
  }
  return true;
}

function verifyNonEmptyStringArray(value, label, errors) {
  if (!verifyNonEmptyArray(value, label, errors)) return [];
  const strings = [];
  for (const [index, entry] of value.entries()) {
    if (verifyNonEmptyString(entry, `${label}[${index}]`, errors)) strings.push(entry);
  }
  return strings;
}

function verifyCoverageBasis(value, label, errors) {
  if (!verifyNonEmptyObject(value, label, errors)) return false;
  verifyNonEmptyString(value.semantic_basis, `${label}.semantic_basis`, errors);
  verifyNonEmptyStringArray(value.evidence_logic, `${label}.evidence_logic`, errors);
  if (value.sample_count_only !== false) {
    errors.push(`${label}.sample_count_only: must be false`);
  }
  return true;
}

function verifyStringIdList(value, label, errors) {
  return verifyStringIdArray(value, label, errors, false);
}

function verifyStringIdArray(value, label, errors, allowEmpty) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    errors.push(`${label}: must be ${allowEmpty ? "an array" : "a non-empty array"}`);
    return [];
  }
  const ids = [];
  for (const [index, id] of value.entries()) {
    if (typeof id !== "string" || id.length === 0) {
      errors.push(`${label}[${index}]: must be a non-empty string id`);
      continue;
    }
    ids.push(id);
  }
  for (const duplicate of new Set(ids.filter((id, index) => ids.indexOf(id) !== index))) {
    errors.push(`${label}: duplicate id ${duplicate}`);
  }
  return ids;
}

function verifyRiskSeverities(risks, label, errors) {
  const allowed = new Set(["critical", "high", "medium", "low"]);
  for (const [index, risk] of asArray(risks).entries()) {
    if (!allowed.has(risk?.severity)) {
      errors.push(`${label}[${index}].severity: must be critical, high, medium or low`);
    }
  }
}

function verifyEntityStringFields(entities, fields, label, errors) {
  for (const [index, entity] of asArray(entities).entries()) {
    for (const field of fields) {
      verifyNonEmptyString(entity?.[field], `${label}[${index}].${field}`, errors);
    }
  }
}

function verifyMatchingIdSet(value, expectedIds, label, errors) {
  const ids = verifyStringIdList(value, label, errors);
  const actual = new Set(ids);
  const expected = new Set(expectedIds);
  for (const id of actual) {
    if (!expected.has(id)) errors.push(`${label}: unknown id ${id}`);
  }
  for (const id of expected) {
    if (!actual.has(id)) errors.push(`${label}: missing required id ${id}`);
  }
  return ids;
}

function verifyExactSet(actualIds, expectedIds, label, errors) {
  const actual = new Set(actualIds);
  const expected = new Set(expectedIds);
  for (const id of actual) {
    if (!expected.has(id)) errors.push(`${label}: unrelated id ${id}`);
  }
  for (const id of expected) {
    if (!actual.has(id)) errors.push(`${label}: missing related id ${id}`);
  }
}

function verifyObjectEntities(value, fields, label, errors) {
  if (!verifyNonEmptyArray(value, label, errors)) return [];
  const ids = [];
  for (const [index, entity] of value.entries()) {
    const entityLabel = `${label}[${index}]`;
    if (!verifyNonEmptyObject(entity, entityLabel, errors)) continue;
    for (const field of fields) {
      if (isMissing(getPath(entity, field))) {
        errors.push(`${entityLabel}: missing required key ${field}`);
      }
    }
    if (typeof entity.id !== "string" || entity.id.length === 0) {
      errors.push(`${entityLabel}.id: must be a non-empty string`);
    } else {
      ids.push(entity.id);
    }
  }
  for (const duplicate of new Set(ids.filter((id, index) => ids.indexOf(id) !== index))) {
    errors.push(`${label}: duplicate id ${duplicate}`);
  }
  return ids;
}

function verifyReferencesKnown(ids, knownIds, label, errors, usedIds = null) {
  for (const id of ids) {
    if (!knownIds.has(id)) errors.push(`${label}: unknown id ${id}`);
    if (usedIds) usedIds.add(id);
  }
}

function verifyBidirectionalIds(referencedValue, definedIds, label, errors) {
  const referencedIds = verifyStringIdList(referencedValue, label, errors);
  const referenced = new Set(referencedIds);
  const defined = new Set(definedIds);
  for (const id of referenced) {
    if (!defined.has(id)) errors.push(`${label}: unknown id ${id}`);
  }
  for (const id of defined) {
    if (!referenced.has(id)) errors.push(`${label}: missing defined id ${id}`);
  }
  return referencedIds;
}

const COVERAGE_STATUSES = new Set([
  "planned",
  "implemented",
  "executed",
  "blocked",
  "excluded",
]);

function verifyCaseTaskCompatibility({ cases, tasks, families, label, errors }) {
  const taskById = new Map(asArray(tasks).map((task) => [task?.id, task]));
  const familyById = new Map(asArray(families).map((family) => [family?.id, family]));
  for (const [index, testCase] of asArray(cases).entries()) {
    const caseLabel = `${label}[${index}]`;
    const parentTask = taskById.get(testCase?.task_id);
    if (!parentTask) continue;
    if (testCase.target_id !== parentTask.target_id) {
      errors.push(`${caseLabel}.target_id: must match parent task ${parentTask.id}`);
    }
    verifyMatchingIdSet(
      testCase?.construct_ids,
      asArray(parentTask.construct_ids),
      `${caseLabel}.construct_ids`,
      errors,
    );
    if (!asArray(parentTask.scenario_family_ids).includes(testCase.scenario_family_id)) {
      errors.push(
        `${caseLabel}.scenario_family_id: ${testCase.scenario_family_id} is not declared by parent task ${parentTask.id}`,
      );
    }
    const family = familyById.get(testCase.scenario_family_id);
    if (family) {
      const familyRisks = new Set(asArray(family.risk_ids));
      for (const riskId of asArray(testCase.risk_ids)) {
        if (!familyRisks.has(riskId)) {
          errors.push(
            `${caseLabel}.risk_ids: ${riskId} is not declared by scenario family ${family.id}`,
          );
        }
      }
    }
    for (const [field, taskField] of [
      ["risk_ids", "risk_ids"],
      ["evidence_ids", "evidence_ids"],
    ]) {
      const allowed = new Set(asArray(parentTask?.[taskField]));
      for (const id of asArray(testCase?.[field])) {
        if (!allowed.has(id)) {
          errors.push(`${caseLabel}.${field}: ${id} is not declared by parent task ${parentTask.id}`);
        }
      }
    }
  }
}

function verifyCoverageItems({
  items,
  label,
  knownByType,
  cases,
  tasks,
  variants,
  risks,
  targetId,
  constructIds,
  errors,
}) {
  verifyObjectEntities(
    items,
    [
      "id",
      "target_id",
      "construct_ids",
      "risk_ids",
      "question_ids",
      "scenario_family_ids",
      "coverage_basis",
      "status",
    ],
    label,
    errors,
  );
  const coveredByType = Object.fromEntries(
    Object.keys(knownByType).map((field) => [field, new Set()]),
  );
  const caseById = new Map(asArray(cases).map((item) => [item?.id, item]));
  const taskById = new Map(asArray(tasks).map((item) => [item?.id, item]));
  const variantById = new Map(asArray(variants).map((item) => [item?.id, item]));
  const definedConstructIds = new Set(constructIds);

  for (const [index, item] of asArray(items).entries()) {
    const itemLabel = `${label}[${index}]`;
    const status = item?.status;
    if (!COVERAGE_STATUSES.has(status)) {
      errors.push(`${itemLabel}.status: must be planned, implemented, executed, blocked or excluded`);
    }
    if (typeof item?.target_id !== "string" || item.target_id.length === 0) {
      errors.push(`${itemLabel}.target_id: must be a non-empty string id`);
    } else if (item.target_id !== targetId) {
      errors.push(`${itemLabel}.target_id: expected ${targetId}, received ${item.target_id}`);
    }
    const itemConstructIds = verifyStringIdList(
      item?.construct_ids,
      `${itemLabel}.construct_ids`,
      errors,
    );
    verifyReferencesKnown(
      itemConstructIds,
      definedConstructIds,
      `${itemLabel}.construct_ids`,
      errors,
      coveredByType.construct_ids,
    );

    const requiresDesignLinks = status === "implemented" || status === "executed";
    for (const [field, known] of Object.entries(knownByType)) {
      if (field === "construct_ids") continue;
      const coreField = new Set(["risk_ids", "question_ids", "scenario_family_ids"]).has(field);
      let ids;
      if (!coreField && !requiresDesignLinks && item?.[field] === undefined) {
        ids = [];
      } else {
        ids = coreField
          ? verifyStringIdList(item?.[field], `${itemLabel}.${field}`, errors)
          : verifyStringIdArray(item?.[field], `${itemLabel}.${field}`, errors, !requiresDesignLinks);
      }
      verifyReferencesKnown(ids, known, `${itemLabel}.${field}`, errors, coveredByType[field]);
    }

    verifyCoverageBasis(item?.coverage_basis, `${itemLabel}.coverage_basis`, errors);
    if (status === "implemented") {
      verifyNonEmptyString(item?.claim, `${itemLabel}.claim`, errors);
      verifyNonEmptyString(item?.limitation, `${itemLabel}.limitation`, errors);
      if (item?.execution !== undefined) {
        errors.push(`${itemLabel}.execution: implemented coverage must not claim execution`);
      }
    }
    if (status === "executed") {
      if (verifyNonEmptyObject(item?.execution, `${itemLabel}.execution`, errors)) {
        verifyStringIdList(item.execution.trial_ids, `${itemLabel}.execution.trial_ids`, errors);
        verifyStringIdList(
          item.execution.evidence_bundle_ids,
          `${itemLabel}.execution.evidence_bundle_ids`,
          errors,
        );
        verifyNonEmptyObject(item.execution.provenance, `${itemLabel}.execution.provenance`, errors);
      }
    }
    if (status === "blocked" || status === "excluded") {
      for (const field of ["reason", "owner", "action"]) {
        verifyNonEmptyString(item?.[field], `${itemLabel}.${field}`, errors);
      }
    }

    const itemTaskIds = new Set(asArray(item?.task_ids));
    const itemQuestionIds = new Set(asArray(item?.question_ids));
    const itemFamilyIds = new Set(asArray(item?.scenario_family_ids));
    const itemRiskIds = new Set(asArray(item?.risk_ids));
    const itemVariantIds = new Set(asArray(item?.variant_ids));
    const itemCaseIds = new Set(asArray(item?.case_ids));
    for (const taskId of itemTaskIds) {
      const task = taskById.get(taskId);
      if (!task) continue;
      for (const questionId of asArray(task.question_ids)) {
        if (!itemQuestionIds.has(questionId)) {
          errors.push(`${itemLabel}: task ${taskId} requires question_id ${questionId}`);
        }
      }
    }
    for (const caseId of itemCaseIds) {
      const testCase = caseById.get(caseId);
      if (!testCase) continue;
      if (!itemTaskIds.has(testCase.task_id)) {
        errors.push(`${itemLabel}: case ${caseId} requires task_id ${testCase.task_id}`);
      }
      if (!itemFamilyIds.has(testCase.scenario_family_id)) {
        errors.push(`${itemLabel}: case ${caseId} requires scenario_family_id ${testCase.scenario_family_id}`);
      }
      for (const riskId of asArray(testCase.risk_ids)) {
        if (!itemRiskIds.has(riskId)) {
          errors.push(`${itemLabel}: case ${caseId} requires risk_id ${riskId}`);
        }
      }
      for (const variantId of asArray(testCase.variant_ids)) {
        if (!itemVariantIds.has(variantId)) {
          errors.push(`${itemLabel}: case ${caseId} requires variant_id ${variantId}`);
        }
      }
      if (testCase.target_id !== targetId || item.target_id !== testCase.target_id) {
        errors.push(`${itemLabel}: case ${caseId} target_id is incompatible with the coverage item`);
      }
      for (const constructId of asArray(testCase.construct_ids)) {
        if (!itemConstructIds.includes(constructId)) {
          errors.push(`${itemLabel}: case ${caseId} requires construct_id ${constructId}`);
        }
      }
    }
    for (const variantId of itemVariantIds) {
      const variant = variantById.get(variantId);
      if (variant && !itemCaseIds.has(variant.parent_case_id)) {
        errors.push(
          `${itemLabel}: variant ${variantId} requires parent case ${variant.parent_case_id}`,
        );
      }
    }
    if (requiresDesignLinks) {
      const relatedTaskIds = new Set();
      const relatedFamilyIds = new Set();
      const relatedRiskIds = new Set();
      const relatedVariantIds = new Set();
      const relatedConstructIds = new Set();
      for (const caseId of itemCaseIds) {
        const testCase = caseById.get(caseId);
        if (!testCase) continue;
        relatedTaskIds.add(testCase.task_id);
        relatedFamilyIds.add(testCase.scenario_family_id);
        for (const id of asArray(testCase.risk_ids)) relatedRiskIds.add(id);
        for (const id of asArray(testCase.variant_ids)) relatedVariantIds.add(id);
        for (const id of asArray(testCase.construct_ids)) relatedConstructIds.add(id);
      }
      const relatedQuestionIds = new Set();
      for (const taskId of relatedTaskIds) {
        for (const id of asArray(taskById.get(taskId)?.question_ids)) relatedQuestionIds.add(id);
      }
      for (const [field, actual, expected] of [
        ["task_ids", itemTaskIds, relatedTaskIds],
        ["question_ids", itemQuestionIds, relatedQuestionIds],
        ["scenario_family_ids", itemFamilyIds, relatedFamilyIds],
        ["risk_ids", itemRiskIds, relatedRiskIds],
        ["variant_ids", itemVariantIds, relatedVariantIds],
        ["construct_ids", new Set(itemConstructIds), relatedConstructIds],
      ]) {
        verifyExactSet(actual, expected, `${itemLabel}.${field}`, errors);
      }
    }
  }

  const entityLabels = {
    risk_ids: "risk",
    question_ids: "question",
    scenario_family_ids: "scenario family",
    task_ids: "task",
    case_ids: "case",
    variant_ids: "variant",
    transition_ids: "transition",
    evidence_ids: "evidence",
    construct_ids: "construct",
  };
  for (const [field, knownIds] of Object.entries(knownByType)) {
    for (const id of knownIds) {
      if (!coveredByType[field].has(id)) {
        errors.push(`${label}: ${entityLabels[field] ?? field} ${id} is not covered by any matrix item`);
      }
    }
  }
  for (const risk of asArray(risks)) {
    if (risk?.severity !== "critical") continue;
    const qualifying = asArray(items).some((item) => {
      if (item?.status !== "implemented" && item?.status !== "executed") return false;
      if (!asArray(item?.risk_ids).includes(risk.id)) return false;
      if (asArray(item?.task_ids).length === 0 || asArray(item?.evidence_ids).length === 0) {
        return false;
      }
      return asArray(item?.case_ids).some((caseId) =>
        asArray(caseById.get(caseId)?.risk_ids).includes(risk.id),
      );
    });
    if (!qualifying) {
      errors.push(
        `${label}: critical risk ${risk.id} must have implemented or executed task, case and evidence design links`,
      );
    }
  }

  return coveredByType;
}

function verifyQuestionTaskScenarioTemplates(templateValues, errors) {
  const scenarioSpace = templateValues.get("scenario-space.yaml");
  const taskSpec = templateValues.get("task-spec.yaml");
  const testCase = templateValues.get("test-case.yaml");
  const variantPlan = templateValues.get("variant-plan.yaml");
  const trajectory = templateValues.get("trajectory-contract.yaml");
  const coverage = templateValues.get("coverage-matrix.yaml");

  const scenarioSpaceId = scenarioSpace?.metadata?.id;
  const taskSpecId = taskSpec?.metadata?.id;
  const testCaseId = testCase?.metadata?.id;
  const variantPlanId = variantPlan?.metadata?.id;
  const trajectoryId = trajectory?.metadata?.id;
  for (const [relativePath, value] of [
    ["task-spec.yaml", taskSpec],
    ["test-case.yaml", testCase],
    ["variant-plan.yaml", variantPlan],
    ["coverage-matrix.yaml", coverage],
  ]) {
    verifyEqualReference(
      value?.scenario_space_id,
      scenarioSpaceId,
      `${relativePath}: scenario_space_id`,
      errors,
    );
  }
  for (const [relativePath, value] of [
    ["test-case.yaml", testCase],
    ["variant-plan.yaml", variantPlan],
    ["trajectory-contract.yaml", trajectory],
    ["coverage-matrix.yaml", coverage],
  ]) {
    verifyEqualReference(
      value?.task_spec_id,
      taskSpecId,
      `${relativePath}: task_spec_id`,
      errors,
    );
  }
  for (const [relativePath, value] of [
    ["variant-plan.yaml", variantPlan],
    ["trajectory-contract.yaml", trajectory],
    ["coverage-matrix.yaml", coverage],
  ]) {
    verifyEqualReference(
      value?.test_case_id,
      testCaseId,
      `${relativePath}: test_case_id`,
      errors,
    );
  }
  verifyEqualReference(
    coverage?.variant_plan_id,
    variantPlanId,
    "coverage-matrix.yaml: variant_plan_id",
    errors,
  );
  verifyEqualReference(
    coverage?.trajectory_contract_id,
    trajectoryId,
    "coverage-matrix.yaml: trajectory_contract_id",
    errors,
  );

  const riskIds = verifyObjectEntities(
    scenarioSpace?.risks,
    ["id", "severity", "statement"],
    "scenario-space.yaml: risks",
    errors,
  );
  verifyRiskSeverities(scenarioSpace?.risks, "scenario-space.yaml: risks", errors);
  verifyEntityStringFields(scenarioSpace?.risks, ["statement"], "scenario-space.yaml: risks", errors);
  verifyBidirectionalIds(
    scenarioSpace?.risk_ids,
    riskIds,
    "scenario-space.yaml: risk_ids",
    errors,
  );
  const constructIds = verifyStringIdList(
    scenarioSpace?.construct_ids,
    "scenario-space.yaml: construct_ids",
    errors,
  );
  const targetId = scenarioSpace?.target_id;
  if (!verifyNonEmptyString(targetId, "scenario-space.yaml: target_id", errors)) {
    // Keep validating the rest of the graph so one malformed anchor cannot hide other errors.
  }
  for (const [relativePath, value] of [
    ["task-spec.yaml", taskSpec],
    ["test-case.yaml", testCase],
    ["coverage-matrix.yaml", coverage],
  ]) {
    verifyEqualReference(value?.target_id, targetId, `${relativePath}: target_id`, errors);
    verifyMatchingIdSet(
      value?.construct_ids,
      constructIds,
      `${relativePath}: construct_ids`,
      errors,
    );
  }
  const dimensionIds = verifyObjectEntities(
    scenarioSpace?.dimensions,
    ["id", "description", "values"],
    "scenario-space.yaml: dimensions",
    errors,
  );
  const partitionIds = verifyObjectEntities(
    scenarioSpace?.partitions,
    ["id", "dimension_ids", "rule"],
    "scenario-space.yaml: partitions",
    errors,
  );
  const familyIds = verifyObjectEntities(
    scenarioSpace?.scenario_families,
    ["id", "partition_ids", "risk_ids", "description"],
    "scenario-space.yaml: scenario_families",
    errors,
  );
  for (const [index, dimension] of asArray(scenarioSpace?.dimensions).entries()) {
    verifyNonEmptyString(dimension?.description, `scenario-space.yaml: dimensions[${index}].description`, errors);
    verifyNonEmptyStringArray(
      dimension?.values,
      `scenario-space.yaml: dimensions[${index}].values`,
      errors,
    );
  }
  const usedDimensions = new Set();
  for (const [index, partition] of asArray(scenarioSpace?.partitions).entries()) {
    verifyNonEmptyString(partition?.rule, `scenario-space.yaml: partitions[${index}].rule`, errors);
    const ids = verifyStringIdList(
      partition?.dimension_ids,
      `scenario-space.yaml: partitions[${index}].dimension_ids`,
      errors,
    );
    verifyReferencesKnown(ids, new Set(dimensionIds), `scenario-space.yaml: partitions[${index}].dimension_ids`, errors, usedDimensions);
  }
  const usedPartitions = new Set();
  const usedRisks = new Set();
  for (const [index, family] of asArray(scenarioSpace?.scenario_families).entries()) {
    verifyNonEmptyString(family?.description, `scenario-space.yaml: scenario_families[${index}].description`, errors);
    const partitionRefs = verifyStringIdList(
      family?.partition_ids,
      `scenario-space.yaml: scenario_families[${index}].partition_ids`,
      errors,
    );
    verifyReferencesKnown(partitionRefs, new Set(partitionIds), `scenario-space.yaml: scenario_families[${index}].partition_ids`, errors, usedPartitions);
    const riskRefs = verifyStringIdList(
      family?.risk_ids,
      `scenario-space.yaml: scenario_families[${index}].risk_ids`,
      errors,
    );
    verifyReferencesKnown(riskRefs, new Set(riskIds), `scenario-space.yaml: scenario_families[${index}].risk_ids`, errors, usedRisks);
  }
  for (const id of dimensionIds) {
    if (!usedDimensions.has(id)) errors.push(`scenario-space.yaml: dimension ${id} is not used by any partition`);
  }
  for (const id of partitionIds) {
    if (!usedPartitions.has(id)) errors.push(`scenario-space.yaml: partition ${id} is not used by any scenario family`);
  }

  const questionIds = verifyObjectEntities(
    taskSpec?.questions,
    ["id", "text", "risk_ids"],
    "task-spec.yaml: questions",
    errors,
  );
  verifyBidirectionalIds(
    scenarioSpace?.question_ids,
    questionIds,
    "scenario-space.yaml: question_ids",
    errors,
  );
  for (const [index, question] of asArray(taskSpec?.questions).entries()) {
    verifyNonEmptyString(question?.text, `task-spec.yaml: questions[${index}].text`, errors);
    const ids = verifyStringIdList(question?.risk_ids, `task-spec.yaml: questions[${index}].risk_ids`, errors);
    verifyReferencesKnown(ids, new Set(riskIds), `task-spec.yaml: questions[${index}].risk_ids`, errors, usedRisks);
  }
  const taskIds = verifyObjectEntities(
    taskSpec?.tasks,
    ["id", "target_id", "question_ids", "construct_ids", "scenario_family_ids", "risk_ids", "evidence_ids", "input_contract", "success_contract"],
    "task-spec.yaml: tasks",
    errors,
  );
  const usedQuestions = new Set();
  const usedConstructs = new Set();
  const usedFamilies = new Set();
  const usedEvidence = new Set();
  for (const [index, task] of asArray(taskSpec?.tasks).entries()) {
    const label = `task-spec.yaml: tasks[${index}]`;
    verifyEqualReference(task?.target_id, targetId, `${label}.target_id`, errors);
    verifyNonEmptyObject(task?.input_contract, `${label}.input_contract`, errors);
    verifyNonEmptyObject(task?.success_contract, `${label}.success_contract`, errors);
    for (const [field, known, used] of [
      ["question_ids", new Set(questionIds), usedQuestions],
      ["construct_ids", new Set(constructIds), usedConstructs],
      ["scenario_family_ids", new Set(familyIds), usedFamilies],
      ["risk_ids", new Set(riskIds), usedRisks],
    ]) {
      const ids = verifyStringIdList(task?.[field], `${label}.${field}`, errors);
      verifyReferencesKnown(ids, known, `${label}.${field}`, errors, used);
    }
    const evidenceIds = verifyStringIdList(task?.evidence_ids, `${label}.evidence_ids`, errors);
    for (const id of evidenceIds) usedEvidence.add(id);
  }

  const caseIds = verifyObjectEntities(
    testCase?.cases,
    ["id", "target_id", "construct_ids", "task_id", "scenario_family_id", "variant_ids", "risk_ids", "evidence_ids", "initial_state", "stimulus", "expected"],
    "test-case.yaml: cases",
    errors,
  );
  const usedTasks = new Set();
  const declaredVariantRefs = new Set();
  for (const [index, item] of asArray(testCase?.cases).entries()) {
    const label = `test-case.yaml: cases[${index}]`;
    verifyEqualReference(item?.target_id, targetId, `${label}.target_id`, errors);
    verifyNonEmptyObject(item?.initial_state, `${label}.initial_state`, errors);
    verifyNonEmptyObject(item?.stimulus, `${label}.stimulus`, errors);
    verifyNonEmptyObject(item?.expected, `${label}.expected`, errors);
    for (const [field, known, used] of [
      ["task_id", new Set(taskIds), usedTasks],
      ["scenario_family_id", new Set(familyIds), usedFamilies],
    ]) {
      const id = item?.[field];
      if (typeof id !== "string" || id.length === 0) errors.push(`${label}.${field}: must be a non-empty string id`);
      else verifyReferencesKnown([id], known, `${label}.${field}`, errors, used);
    }
    const caseConstructIds = verifyStringIdList(item?.construct_ids, `${label}.construct_ids`, errors);
    verifyReferencesKnown(caseConstructIds, new Set(constructIds), `${label}.construct_ids`, errors, usedConstructs);
    const riskRefs = verifyStringIdList(item?.risk_ids, `${label}.risk_ids`, errors);
    verifyReferencesKnown(riskRefs, new Set(riskIds), `${label}.risk_ids`, errors, usedRisks);
    for (const id of verifyStringIdList(item?.evidence_ids, `${label}.evidence_ids`, errors)) usedEvidence.add(id);
    for (const id of verifyStringIdList(item?.variant_ids, `${label}.variant_ids`, errors)) declaredVariantRefs.add(id);
  }
  verifyCaseTaskCompatibility({
    cases: testCase?.cases,
    tasks: taskSpec?.tasks,
    families: scenarioSpace?.scenario_families,
    label: "test-case.yaml: cases",
    errors,
  });

  const variantIds = verifyObjectEntities(
    variantPlan?.variants,
    ["id", "parent_case_id", "changed", "controlled", "expected_relation"],
    "variant-plan.yaml: variants",
    errors,
  );
  const usedCases = new Set();
  for (const [index, variant] of asArray(variantPlan?.variants).entries()) {
    const label = `variant-plan.yaml: variants[${index}]`;
    verifyReferencesKnown([variant?.parent_case_id], new Set(caseIds), `${label}.parent_case_id`, errors, usedCases);
    verifyNonEmptyObject(variant?.changed, `${label}.changed`, errors);
    verifyNonEmptyObject(variant?.controlled, `${label}.controlled`, errors);
    if (isNonEmptyObject(variant?.changed) && isNonEmptyObject(variant?.controlled)) {
      for (const key of Object.keys(variant.changed)) {
        if (Object.hasOwn(variant.controlled, key)) {
          errors.push(`${label}: field ${key} cannot be both changed and controlled`);
        }
      }
    }
    verifyNonEmptyObject(variant?.expected_relation, `${label}.expected_relation`, errors);
    if (isNonEmptyObject(variant?.expected_relation)) {
      for (const field of ["type", "assertion"]) {
        if (typeof variant.expected_relation[field] !== "string" || variant.expected_relation[field].length === 0) {
          errors.push(`${label}.expected_relation.${field}: must be a non-empty string`);
        }
      }
    }
  }
  for (const id of variantIds) {
    if (!declaredVariantRefs.has(id)) errors.push(`variant-plan.yaml: variant ${id} is not declared by any test case`);
  }
  for (const id of declaredVariantRefs) {
    if (!new Set(variantIds).has(id)) errors.push(`test-case.yaml: variant_ids has unknown id ${id}`);
  }

  verifyNonEmptyObject(trajectory?.initial_state, "trajectory-contract.yaml: initial_state", errors);
  const actionIds = verifyObjectEntities(
    trajectory?.actions,
    ["id", "actor", "operation"],
    "trajectory-contract.yaml: actions",
    errors,
  );
  verifyEntityStringFields(trajectory?.actions, ["actor", "operation"], "trajectory-contract.yaml: actions", errors);
  const observationIds = verifyObjectEntities(
    trajectory?.observations,
    ["id", "source", "capture"],
    "trajectory-contract.yaml: observations",
    errors,
  );
  verifyEntityStringFields(trajectory?.observations, ["source", "capture"], "trajectory-contract.yaml: observations", errors);
  const transitionIds = verifyObjectEntities(
    trajectory?.allowed_transitions,
    ["id", "from", "action_id", "to", "observation_id"],
    "trajectory-contract.yaml: allowed_transitions",
    errors,
  );
  const usedActions = new Set();
  const usedObservations = new Set();
  for (const [index, transition] of asArray(trajectory?.allowed_transitions).entries()) {
    const label = `trajectory-contract.yaml: allowed_transitions[${index}]`;
    verifyReferencesKnown([transition?.action_id], new Set(actionIds), `${label}.action_id`, errors, usedActions);
    verifyReferencesKnown([transition?.observation_id], new Set(observationIds), `${label}.observation_id`, errors, usedObservations);
  }
  for (const id of actionIds) {
    if (!usedActions.has(id)) errors.push(`trajectory-contract.yaml: action ${id} is not used by any transition`);
  }
  for (const id of observationIds) {
    if (!usedObservations.has(id)) errors.push(`trajectory-contract.yaml: observation ${id} is not used by any transition`);
  }
  for (const field of ["fault", "time", "concurrency"]) {
    verifyNonEmptyArray(trajectory?.recovery_invariants?.[field], `trajectory-contract.yaml: recovery_invariants.${field}`, errors);
  }
  const evidenceIds = verifyObjectEntities(
    trajectory?.evidence_observations,
    ["id", "source", "capture"],
    "trajectory-contract.yaml: evidence_observations",
    errors,
  );
  verifyEntityStringFields(trajectory?.evidence_observations, ["source", "capture"], "trajectory-contract.yaml: evidence_observations", errors);
  verifyNonEmptyObject(trajectory?.budgets, "trajectory-contract.yaml: budgets", errors);
  if (typeof scenarioSpace?.coverage_policy !== "string" || scenarioSpace.coverage_policy.length === 0) {
    errors.push("scenario-space.yaml: coverage_policy must be a non-empty string");
  }
  verifyNonEmptyObject(taskSpec?.generation_rules, "task-spec.yaml: generation_rules", errors);
  verifyNonEmptyObject(testCase?.oracle_policy, "test-case.yaml: oracle_policy", errors);
  verifyNonEmptyObject(variantPlan?.control_policy, "variant-plan.yaml: control_policy", errors);
  verifyNonEmptyArray(coverage?.coverage_claims, "coverage-matrix.yaml: coverage_claims", errors);
  verifyNonEmptyArray(coverage?.limitations, "coverage-matrix.yaml: limitations", errors);

  const knownByType = {
    risk_ids: new Set(riskIds), question_ids: new Set(questionIds),
    scenario_family_ids: new Set(familyIds), task_ids: new Set(taskIds),
    case_ids: new Set(caseIds), variant_ids: new Set(variantIds),
    transition_ids: new Set(transitionIds), evidence_ids: new Set(evidenceIds),
    construct_ids: new Set(constructIds),
  };
  verifyCoverageItems({
    items: coverage?.items,
    label: "coverage-matrix.yaml: items",
    knownByType,
    cases: testCase?.cases,
    tasks: taskSpec?.tasks,
    variants: variantPlan?.variants,
    risks: scenarioSpace?.risks,
    targetId,
    constructIds,
    errors,
  });
  for (const id of usedEvidence) {
    if (!new Set(evidenceIds).has(id)) errors.push(`task or test case evidence_ids has unknown id ${id}`);
  }
  for (const [label, ids, used] of [
    ["risk", riskIds, usedRisks], ["question", questionIds, usedQuestions],
    ["construct", constructIds, usedConstructs],
    ["scenario family", familyIds, usedFamilies], ["task", taskIds, usedTasks],
    ["test case", caseIds, usedCases],
  ]) {
    for (const id of ids) {
      if (!used.has(id)) errors.push(`${label} ${id} is orphaned from downstream definitions`);
    }
  }
}

function verifyQuestionTaskScenarioCase(value, relativePath, errors) {
  if (!value) return;
  const scenarioSpaceId = value?.input?.scenario_space?.id;
  const targetId = value?.input?.scenario_space?.target_id;
  const constructIds = verifyStringIdList(
    value?.input?.scenario_space?.construct_ids,
    `${relativePath}: input.scenario_space.construct_ids`,
    errors,
  );
  verifyEqualReference(
    value?.references?.scenario_space_id,
    scenarioSpaceId,
    `${relativePath}: references.scenario_space_id`,
    errors,
  );
  verifyEqualReference(
    value?.references?.target_id,
    targetId,
    `${relativePath}: references.target_id`,
    errors,
  );
  verifyMatchingIdSet(
    value?.references?.construct_ids,
    constructIds,
    `${relativePath}: references.construct_ids`,
    errors,
  );
  const coverageItems = value?.expected?.coverage_items;
  const coverageItemIds = verifyObjectEntities(
    coverageItems,
    ["id", "risk_ids", "question_ids", "scenario_family_ids", "coverage_basis", "status"],
    `${relativePath}: expected.coverage_items`,
    errors,
  );
  const definitions = {
    risk_ids: verifyObjectEntities(value?.input?.risks, ["id", "severity", "statement"], `${relativePath}: input.risks`, errors),
    dimension_ids: verifyObjectEntities(value?.input?.dimensions, ["id", "description", "values"], `${relativePath}: input.dimensions`, errors),
    partition_ids: verifyObjectEntities(value?.input?.partitions, ["id", "dimension_ids", "rule"], `${relativePath}: input.partitions`, errors),
    scenario_family_ids: verifyObjectEntities(value?.input?.scenario_families, ["id", "partition_ids", "risk_ids", "description"], `${relativePath}: input.scenario_families`, errors),
    question_ids: verifyObjectEntities(value?.input?.questions, ["id", "text", "risk_ids"], `${relativePath}: input.questions`, errors),
    task_ids: verifyObjectEntities(value?.input?.tasks, ["id", "target_id", "construct_ids", "question_ids", "scenario_family_ids", "risk_ids", "evidence_ids", "input_contract", "success_contract"], `${relativePath}: input.tasks`, errors),
    case_ids: verifyObjectEntities(value?.input?.cases, ["id", "target_id", "construct_ids", "task_id", "scenario_family_id", "variant_ids", "risk_ids", "evidence_ids", "initial_state", "stimulus", "expected"], `${relativePath}: input.cases`, errors),
    variant_ids: verifyObjectEntities(value?.input?.variants, ["id", "parent_case_id", "changed", "controlled", "expected_relation"], `${relativePath}: input.variants`, errors),
    transition_ids: verifyObjectEntities(value?.input?.trajectory?.transitions, ["id", "from", "action_id", "to", "observation_id"], `${relativePath}: input.trajectory.transitions`, errors),
    evidence_ids: verifyObjectEntities(value?.evidence?.requirements, ["id", "source", "capture"], `${relativePath}: evidence.requirements`, errors),
    coverage_item_ids: coverageItemIds,
  };
  verifyRiskSeverities(value?.input?.risks, `${relativePath}: input.risks`, errors);
  verifyEntityStringFields(value?.input?.risks, ["statement"], `${relativePath}: input.risks`, errors);
  verifyEntityStringFields(value?.evidence?.requirements, ["source", "capture"], `${relativePath}: evidence.requirements`, errors);
  const allIds = new Set([scenarioSpaceId, targetId, ...constructIds]);
  for (const [field, ids] of Object.entries(definitions)) {
    verifyBidirectionalIds(value?.references?.[field], ids, `${relativePath}: references.${field}`, errors);
    for (const id of ids) {
      if (allIds.has(id)) errors.push(`${relativePath}: entity id ${id} is reused across entity types`);
      allIds.add(id);
    }
  }
  for (const field of ["fault", "time", "concurrency"]) {
    verifyNonEmptyArray(value?.input?.trajectory?.recovery_invariants?.[field], `${relativePath}: input.trajectory.recovery_invariants.${field}`, errors);
  }
  verifyNonEmptyObject(value?.input?.trajectory?.initial_state, `${relativePath}: input.trajectory.initial_state`, errors);
  const actionIds = verifyObjectEntities(value?.input?.trajectory?.actions, ["id", "actor", "operation"], `${relativePath}: input.trajectory.actions`, errors);
  const observationIds = verifyObjectEntities(value?.input?.trajectory?.observations, ["id", "source", "capture"], `${relativePath}: input.trajectory.observations`, errors);
  verifyEntityStringFields(value?.input?.trajectory?.actions, ["actor", "operation"], `${relativePath}: input.trajectory.actions`, errors);
  verifyEntityStringFields(value?.input?.trajectory?.observations, ["source", "capture"], `${relativePath}: input.trajectory.observations`, errors);
  const known = Object.fromEntries(
    Object.entries(definitions).map(([field, ids]) => [field, new Set(ids)]),
  );
  for (const [index, dimension] of asArray(value?.input?.dimensions).entries()) {
    verifyNonEmptyString(dimension?.description, `${relativePath}: input.dimensions[${index}].description`, errors);
    verifyNonEmptyStringArray(dimension?.values, `${relativePath}: input.dimensions[${index}].values`, errors);
  }
  for (const [index, partition] of asArray(value?.input?.partitions).entries()) {
    verifyNonEmptyString(partition?.rule, `${relativePath}: input.partitions[${index}].rule`, errors);
    const ids = verifyStringIdList(partition?.dimension_ids, `${relativePath}: input.partitions[${index}].dimension_ids`, errors);
    verifyReferencesKnown(ids, known.dimension_ids, `${relativePath}: input.partitions[${index}].dimension_ids`, errors);
  }
  for (const [index, family] of asArray(value?.input?.scenario_families).entries()) {
    verifyNonEmptyString(family?.description, `${relativePath}: input.scenario_families[${index}].description`, errors);
    for (const [field, knownIds] of [["partition_ids", known.partition_ids], ["risk_ids", known.risk_ids]]) {
      const ids = verifyStringIdList(family?.[field], `${relativePath}: input.scenario_families[${index}].${field}`, errors);
      verifyReferencesKnown(ids, knownIds, `${relativePath}: input.scenario_families[${index}].${field}`, errors);
    }
  }
  for (const [index, question] of asArray(value?.input?.questions).entries()) {
    verifyNonEmptyString(question?.text, `${relativePath}: input.questions[${index}].text`, errors);
    const ids = verifyStringIdList(question?.risk_ids, `${relativePath}: input.questions[${index}].risk_ids`, errors);
    verifyReferencesKnown(ids, known.risk_ids, `${relativePath}: input.questions[${index}].risk_ids`, errors);
  }
  for (const [index, task] of asArray(value?.input?.tasks).entries()) {
    const label = `${relativePath}: input.tasks[${index}]`;
    verifyEqualReference(task?.target_id, targetId, `${label}.target_id`, errors);
    verifyNonEmptyObject(task?.input_contract, `${label}.input_contract`, errors);
    verifyNonEmptyObject(task?.success_contract, `${label}.success_contract`, errors);
    for (const [field, knownIds] of [
      ["construct_ids", new Set(constructIds)], ["question_ids", known.question_ids], ["scenario_family_ids", known.scenario_family_ids],
      ["risk_ids", known.risk_ids], ["evidence_ids", known.evidence_ids],
    ]) {
      const ids = verifyStringIdList(task?.[field], `${label}.${field}`, errors);
      verifyReferencesKnown(ids, knownIds, `${label}.${field}`, errors);
    }
  }
  for (const [index, item] of asArray(value?.input?.cases).entries()) {
    const label = `${relativePath}: input.cases[${index}]`;
    verifyEqualReference(item?.target_id, targetId, `${label}.target_id`, errors);
    for (const [field, knownIds] of [["task_id", known.task_ids], ["scenario_family_id", known.scenario_family_ids]]) {
      const id = item?.[field];
      if (typeof id !== "string" || id.length === 0) errors.push(`${label}.${field}: must be a non-empty string id`);
      else verifyReferencesKnown([id], knownIds, `${label}.${field}`, errors);
    }
    const caseConstructIds = verifyStringIdList(item?.construct_ids, `${label}.construct_ids`, errors);
    verifyReferencesKnown(caseConstructIds, new Set(constructIds), `${label}.construct_ids`, errors);
    for (const [field, knownIds] of [["variant_ids", known.variant_ids], ["risk_ids", known.risk_ids], ["evidence_ids", known.evidence_ids]]) {
      const ids = verifyStringIdList(item?.[field], `${label}.${field}`, errors);
      verifyReferencesKnown(ids, knownIds, `${label}.${field}`, errors);
    }
    for (const field of ["initial_state", "stimulus", "expected"]) {
      verifyNonEmptyObject(item?.[field], `${label}.${field}`, errors);
    }
  }
  verifyCaseTaskCompatibility({
    cases: value?.input?.cases,
    tasks: value?.input?.tasks,
    families: value?.input?.scenario_families,
    label: `${relativePath}: input.cases`,
    errors,
  });
  for (const [index, variant] of asArray(value?.input?.variants).entries()) {
    const label = `${relativePath}: input.variants[${index}]`;
    verifyReferencesKnown([variant?.parent_case_id], known.case_ids, `${label}.parent_case_id`, errors);
    verifyNonEmptyObject(variant?.changed, `${label}.changed`, errors);
    verifyNonEmptyObject(variant?.controlled, `${label}.controlled`, errors);
    verifyNonEmptyObject(variant?.expected_relation, `${label}.expected_relation`, errors);
    if (isNonEmptyObject(variant?.expected_relation)) {
      for (const field of ["type", "assertion"]) {
        if (typeof variant.expected_relation[field] !== "string" || variant.expected_relation[field].length === 0) {
          errors.push(`${label}.expected_relation.${field}: must be a non-empty string`);
        }
      }
    }
  }
  const usedActions = new Set();
  const usedObservations = new Set();
  for (const [index, transition] of asArray(value?.input?.trajectory?.transitions).entries()) {
    const label = `${relativePath}: input.trajectory.transitions[${index}]`;
    verifyReferencesKnown([transition?.action_id], new Set(actionIds), `${label}.action_id`, errors, usedActions);
    verifyReferencesKnown([transition?.observation_id], new Set(observationIds), `${label}.observation_id`, errors, usedObservations);
  }
  for (const id of actionIds) {
    if (!usedActions.has(id)) errors.push(`${relativePath}: action ${id} is not used by any transition`);
  }
  for (const id of observationIds) {
    if (!usedObservations.has(id)) errors.push(`${relativePath}: observation ${id} is not used by any transition`);
  }
  verifyCoverageItems({
    items: coverageItems,
    label: `${relativePath}: expected.coverage_items`,
    knownByType: {
      risk_ids: known.risk_ids,
      question_ids: known.question_ids,
      scenario_family_ids: known.scenario_family_ids,
      task_ids: known.task_ids,
      case_ids: known.case_ids,
      variant_ids: known.variant_ids,
      transition_ids: known.transition_ids,
      evidence_ids: known.evidence_ids,
      construct_ids: new Set(constructIds),
    },
    cases: value?.input?.cases,
    tasks: value?.input?.tasks,
    variants: value?.input?.variants,
    risks: value?.input?.risks,
    targetId,
    constructIds,
    errors,
  });
  verifyNonEmptyObject(value?.expected?.decision_actions, `${relativePath}: expected.decision_actions`, errors);
  verifyNonEmptyArray(value?.evidence?.limitations, `${relativePath}: evidence.limitations`, errors);
  const traces = value?.evidence?.traceability;
  verifyObjectEntities(traces, ["id", "claim", "links", "action"], `${relativePath}: evidence.traceability`, errors);
  const traced = new Set();
  for (const [index, trace] of asArray(traces).entries()) {
    const ids = verifyStringIdList(trace?.links, `${relativePath}: evidence.traceability[${index}].links`, errors);
    verifyReferencesKnown(ids, allIds, `${relativePath}: evidence.traceability[${index}].links`, errors, traced);
  }
  for (const id of allIds) {
    if (typeof id === "string" && id.length > 0 && !traced.has(id)) {
      errors.push(`${relativePath}: ${id} is not covered by evidence.traceability`);
    }
  }
}

function expectedUnitId(unitDir) {
  const match = path.basename(unitDir).match(/^unit-([a-z]\d+)-(\d+)$/i);
  return match ? `${match[1].toUpperCase()}.${match[2]}` : null;
}

async function verifyYaml(unitDir, relativePath, contract, errors) {
  const absolutePath = path.join(unitDir, relativePath);
  if (!(await exists(absolutePath))) return null;

  let value;
  try {
    value = parseYaml(await readFile(absolutePath, "utf8"));
  } catch (error) {
    errors.push(`${relativePath}: invalid YAML (${error.message})`);
    return null;
  }

  if (contract.kind && value?.kind !== contract.kind) {
    errors.push(`${relativePath}: expected kind ${contract.kind}`);
  }
  for (const requiredPath of contract.required) {
    if (isMissing(getPath(value, requiredPath))) {
      errors.push(`${relativePath}: missing required key ${requiredPath}`);
    }
  }
  return value;
}

async function verifyHtml(unitDir, errors) {
  const htmlPath = path.join(unitDir, "index.html");
  if (!(await exists(htmlPath))) return;
  const source = await readFile(htmlPath, "utf8");
  if (!/<html\b[^>]*\blang=["']zh-CN["']/i.test(source)) {
    errors.push("index.html: missing lang=zh-CN");
  }
  if (!/<meta\b[^>]*charset=["']?utf-8/i.test(source)) {
    errors.push("index.html: missing UTF-8 declaration");
  }
  if (!/<title>[^<]+<\/title>/i.test(source)) {
    errors.push("index.html: missing title");
  }
  if (!/<main\b/i.test(source)) {
    errors.push("index.html: missing main landmark");
  }
}

export async function verifyAcademyUnit(unitDir) {
  const resolvedUnitDir = path.resolve(unitDir);
  const errors = [];

  for (const relativePath of REQUIRED_FILES) {
    if (!(await exists(path.join(resolvedUnitDir, relativePath)))) {
      errors.push(`${relativePath}: missing required Academy unit artifact`);
    }
  }

  const manifest = await verifyYaml(
    resolvedUnitDir,
    "artifact-manifest.yaml",
    TEMPLATE_CONTRACTS["artifact-manifest.yaml"],
    errors,
  );
  verifyManifest(manifest, errors);
  const profileName = verifyProfile(manifest, errors);
  const directoryUnitId = expectedUnitId(resolvedUnitDir);
  if (directoryUnitId && manifest?.unit?.id !== directoryUnitId) {
    errors.push(
      `artifact-manifest.yaml: unit.id ${manifest?.unit?.id ?? "missing"} does not match ${directoryUnitId}`,
    );
  }

  for (const declaredPath of flattenDeclaredArtifacts(manifest)) {
    if (!isSafeRelativePath(declaredPath)) continue;
    if (!(await exists(path.join(resolvedUnitDir, declaredPath)))) {
      errors.push(`artifact-manifest.yaml: missing declared artifact ${declaredPath}`);
    }
  }

  const templateValues = new Map();
  for (const templatePath of manifest?.contents?.templates ?? []) {
    if (!isSafeRelativePath(templatePath)) continue;
    const contract =
      PROFILE_CONTRACTS[profileName]?.[path.basename(templatePath)] ??
      TEMPLATE_CONTRACTS[path.basename(templatePath)];
    if (!contract) {
      errors.push(`artifact-manifest.yaml: no YAML contract for template ${templatePath}`);
      continue;
    }
    const value = await verifyYaml(resolvedUnitDir, templatePath, contract, errors);
    templateValues.set(templatePath, value);
  }

  for (const examplePath of manifest?.contents?.examples ?? []) {
    if (!isSafeRelativePath(examplePath)) continue;
    const contract = PROFILE_CONTRACTS[profileName]?.example ?? EXAMPLE_CONTRACT;
    const value = await verifyYaml(resolvedUnitDir, examplePath, contract, errors);
    if (profileName === "requirements-to-evidence-v1") {
      verifyEvaluationCaseReferences(value, examplePath, errors);
    } else if (profileName === "target-boundary-version-v1") {
      verifyTargetBoundaryVersionCase(value, examplePath, errors);
    } else if (profileName === "question-to-task-scenario-v1") {
      verifyQuestionTaskScenarioCase(value, examplePath, errors);
    }
  }

  if (profileName === "requirements-to-evidence-v1") {
    verifyRequirementsTraceability(
      templateValues.get("requirements-traceability.yaml"),
      "requirements-traceability.yaml",
      errors,
    );
  } else if (profileName === "target-boundary-version-v1") {
    verifyTargetBoundaryVersionTemplates(templateValues, errors);
  } else if (profileName === "question-to-task-scenario-v1") {
    verifyQuestionTaskScenarioTemplates(templateValues, errors);
  }

  await verifyHtml(resolvedUnitDir, errors);
  return errors;
}
