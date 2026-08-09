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
};

const CANONICAL_UNIT_PROFILES = {
  "A1.1": "a1-1-foundations-v1",
  "A1.2": "requirements-to-evidence-v1",
};

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
  if (unitId === "A1.2" && !declaredProfile) {
    errors.push("artifact-manifest.yaml: A1.2 requires verification.profile");
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
    }
  }

  if (profileName === "requirements-to-evidence-v1") {
    verifyRequirementsTraceability(
      templateValues.get("requirements-traceability.yaml"),
      "requirements-traceability.yaml",
      errors,
    );
  }

  await verifyHtml(resolvedUnitDir, errors);
  return errors;
}
