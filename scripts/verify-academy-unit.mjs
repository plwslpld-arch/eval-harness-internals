import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { parse as parseYaml } from "yaml";

const REQUIRED_FILES = [
  "README.md",
  "index.html",
  "artifact-manifest.yaml",
  "evaluation-charter.yaml",
  "evaluation-target.yaml",
  "risk-definition.yaml",
  "task-spec.yaml",
  "harness-manifest.yaml",
  "metric-card.yaml",
  "gate-policy.yaml",
  "gate-decision.yaml",
  "monitoring-signal.yaml",
  "examples/refund-agent/evaluation-case.yaml",
  "examples/contract-agent/evaluation-case.yaml",
];

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
  "examples/refund-agent/evaluation-case.yaml": {
    kind: "EvaluationCase",
    required: ["metadata.id", "references", "input", "expected", "evidence"],
  },
  "examples/contract-agent/evaluation-case.yaml": {
    kind: "EvaluationCase",
    required: ["metadata.id", "references", "input", "expected", "evidence"],
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
  return value === undefined || value === null || value === "";
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

  let manifest = null;
  for (const [relativePath, contract] of Object.entries(TEMPLATE_CONTRACTS)) {
    const parsed = await verifyYaml(resolvedUnitDir, relativePath, contract, errors);
    if (relativePath === "artifact-manifest.yaml") manifest = parsed;
  }

  for (const declaredPath of flattenDeclaredArtifacts(manifest)) {
    if (!(await exists(path.join(resolvedUnitDir, declaredPath)))) {
      errors.push(`artifact-manifest.yaml: missing declared artifact ${declaredPath}`);
    }
  }

  await verifyHtml(resolvedUnitDir, errors);
  return errors;
}
