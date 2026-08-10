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
};

const CANONICAL_UNIT_PROFILES = {
  "A1.1": "a1-1-foundations-v1",
  "A1.2": "requirements-to-evidence-v1",
  "A1.3": "target-boundary-version-v1",
};

const EXPLICIT_PROFILE_UNITS = new Set(["A1.2", "A1.3"]);

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
  }

  await verifyHtml(resolvedUnitDir, errors);
  return errors;
}
