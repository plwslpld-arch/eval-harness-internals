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
  "task-scenario-to-evaluation-data-v1": {
    templates: [
      "dataset-charter.yaml",
      "source-register.yaml",
      "sampling-plan.yaml",
      "reference-standard.yaml",
      "annotation-protocol.yaml",
      "split-manifest.yaml",
      "dataset-manifest.yaml",
      "data-quality-gate.yaml",
    ],
    examples: [
      "examples/refund-agent/evaluation-case.yaml",
      "examples/contract-agent/evaluation-case.yaml",
      "examples/knowledge-assistant/evaluation-case.yaml",
    ],
  },
  "reference-to-scorer-v1": {
    templates: [
      "scorer-charter.yaml",
      "scoring-unit-spec.yaml",
      "observation-contract.yaml",
      "scoring-rubric.yaml",
      "adjudication-protocol.yaml",
      "scorer-manifest.yaml",
      "scorer-validation-report.yaml",
      "scorer-quality-gate.yaml",
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
  "A1.5": "task-scenario-to-evaluation-data-v1",
  "A1.6": "reference-to-scorer-v1",
};

const EXPLICIT_PROFILE_UNITS = new Set(["A1.2", "A1.3", "A1.4", "A1.5", "A1.6"]);

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
  "dataset-charter.yaml": {
    kind: "DatasetCharter",
    required: ["metadata.id", "purpose", "target_population", "unit_of_analysis", "partitions"],
  },
  "source-register.yaml": {
    kind: "SourceRegister",
    required: ["metadata.id", "dataset_charter_id", "sources"],
  },
  "sampling-plan.yaml": {
    kind: "SamplingPlan",
    required: ["metadata.id", "dataset_charter_id", "source_register_id", "sampling_frame", "allocation"],
  },
  "reference-standard.yaml": {
    kind: "ReferenceStandard",
    required: ["metadata.id", "dataset_charter_id", "reference_policy", "reference_items", "invariants", "uncertainty"],
  },
  "annotation-protocol.yaml": {
    kind: "AnnotationProtocol",
    required: ["metadata.id", "dataset_charter_id", "reference_standard_id", "label_schema", "blind_independent_passes", "disagreement", "arbitration"],
  },
  "split-manifest.yaml": {
    kind: "SplitManifest",
    required: ["metadata.id", "dataset_charter_id", "sampling_plan_id", "grouping_keys", "leakage_controls", "splits"],
  },
  "dataset-manifest.yaml": {
    kind: "DatasetManifest",
    required: ["metadata.id", "dataset_charter_id", "dataset_identity", "contents", "versioning", "drift_and_refresh"],
  },
  "data-quality-gate.yaml": {
    kind: "DataQualityGate",
    required: ["metadata.id", "dataset_manifest_id", "status_values", "checks", "decision.status"],
  },
  "scorer-charter.yaml": {
    kind: "ScorerCharter",
    required: ["metadata.id", "purpose", "traceability", "scoring_boundary", "evidence_boundary"],
  },
  "scoring-unit-spec.yaml": {
    kind: "ScoringUnitSpec",
    required: ["metadata.id", "scorer_charter_id", "units", "aggregation_boundary", "traceability"],
  },
  "observation-contract.yaml": {
    kind: "ObservationContract",
    required: ["metadata.id", "scorer_charter_id", "scoring_unit_spec_id", "bundle", "evidence_requirements", "traceability"],
  },
  "scoring-rubric.yaml": {
    kind: "ScoringRubric",
    required: ["metadata.id", "scorer_charter_id", "scoring_unit_spec_id", "observation_contract_id", "dimensions", "scale", "critical_errors", "unscorable", "traceability"],
  },
  "adjudication-protocol.yaml": {
    kind: "AdjudicationProtocol",
    required: ["metadata.id", "scoring_rubric_id", "disagreement", "abstention", "adjudication", "outputs", "traceability"],
  },
  "scorer-manifest.yaml": {
    kind: "ScorerManifest",
    required: ["metadata.id", "scorer_charter_id", "scoring_rubric_id", "observation_contract_id", "adjudication_protocol_id", "scorers", "precedence", "output_contract", "traceability"],
  },
  "scorer-validation-report.yaml": {
    kind: "ScorerValidationReport",
    required: ["metadata.id", "scorer_manifest_id", "validation_scope", "evidence_status", "reliability", "validity", "calibration", "error_profile", "bias", "robustness", "security", "conclusion", "traceability"],
  },
  "scorer-quality-gate.yaml": {
    kind: "ScorerQualityGate",
    required: ["metadata.id", "scorer_manifest_id", "scorer_validation_report_id", "status_values", "check_status_values", "checks", "decision.status", "evidence_boundary", "traceability"],
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
  "task-scenario-to-evaluation-data-v1": {
    "dataset-charter.yaml": {
      kind: "DatasetCharter",
      required: [
        "metadata.id", "metadata.version", "traceability.target_ids",
        "traceability.construct_ids", "traceability.question_ids", "traceability.risk_ids",
        "traceability.scenario_family_ids", "traceability.task_ids", "purpose", "target_population",
        "unit_of_analysis", "sampling_frame", "partitions", "scope_controls",
        "evidence_boundary",
      ],
    },
    "source-register.yaml": {
      kind: "SourceRegister",
      required: ["metadata.id", "metadata.version", "dataset_charter_id", "traceability", "sources", "source_governance"],
    },
    "sampling-plan.yaml": {
      kind: "SamplingPlan",
      required: [
        "metadata.id", "metadata.version", "dataset_charter_id", "source_register_id",
        "traceability", "population", "sampling_frame", "strata", "selection",
        "allocation", "deduplication", "weighting", "partition_assignment", "limitations",
      ],
    },
    "reference-standard.yaml": {
      kind: "ReferenceStandard",
      required: [
        "metadata.id", "metadata.version", "dataset_charter_id", "source_register_id",
        "traceability", "reference_policy", "reference_items", "oracle_hierarchy",
        "invariants", "uncertainty", "versioning", "limitations",
      ],
    },
    "annotation-protocol.yaml": {
      kind: "AnnotationProtocol",
      required: [
        "metadata.id", "metadata.version", "dataset_charter_id", "reference_standard_id",
        "traceability", "annotation_units", "label_schema", "instructions", "annotators",
        "blind_independent_passes", "disagreement", "arbitration", "quality_control",
        "privacy_handling", "outputs", "limitations",
      ],
    },
    "split-manifest.yaml": {
      kind: "SplitManifest",
      required: [
        "metadata.id", "metadata.version", "dataset_charter_id", "sampling_plan_id",
        "source_register_id", "traceability", "split_policy", "grouping_keys",
        "leakage_controls", "splits", "assignment_audit", "limitations",
      ],
    },
    "dataset-manifest.yaml": {
      kind: "DatasetManifest",
      required: [
        "metadata.id", "metadata.version", "dataset_charter_id", "source_register_id",
        "sampling_plan_id", "reference_standard_id", "annotation_protocol_id",
        "split_manifest_id", "traceability", "dataset_identity", "contents", "item_schema",
        "joins", "views.target", "views.harness", "views.scorer", "views.audit",
        "partition_summary", "provenance_summary", "versioning",
        "drift_and_refresh", "evidence_boundary", "limitations",
      ],
    },
    "data-quality-gate.yaml": {
      kind: "DataQualityGate",
      required: [
        "metadata.id", "metadata.version", "dataset_manifest_id", "traceability",
        "status_values", "check_status_values", "checks", "decision.status", "exceptions", "limitations",
      ],
    },
    example: {
      kind: "EvaluationCase",
      required: [
        "metadata.id", "references.target_ids", "references.construct_ids",
        "references.question_ids", "references.risk_ids", "references.scenario_family_ids",
        "references.task_ids", "references.dataset_charter_ids", "references.source_ids",
        "references.partition_ids", "references.reference_item_ids",
        "references.annotation_protocol_ids", "references.split_ids",
        "references.dataset_version_ids", "references.quality_gate_ids", "references.trace_ids",
        "input", "expected.trace_closure", "expected.next_actions",
        "evidence.design_artifacts", "evidence.traceability", "evidence.limitations",
      ],
    },
  },
  "reference-to-scorer-v1": {
    "scorer-charter.yaml": {
      kind: "ScorerCharter",
      required: [
        "metadata.id", "metadata.version", "purpose", "traceability", "scoring_claim",
        "authority_order", "non_compensation", "responsibilities", "evidence_boundary",
      ],
    },
    "scoring-unit-spec.yaml": {
      kind: "ScoringUnitSpec",
      required: [
        "metadata.id", "metadata.version", "scorer_charter_id", "traceability",
        "units", "dependence", "missing_or_duplicate_identity", "evidence_boundary",
      ],
    },
    "observation-contract.yaml": {
      kind: "ObservationContract",
      required: [
        "metadata.id", "metadata.version", "scoring_unit_spec_id", "traceability", "bundle",
        "completeness", "integrity", "privacy_and_access", "evidence_boundary",
      ],
    },
    "scoring-rubric.yaml": {
      kind: "ScoringRubric",
      required: [
        "metadata.id", "metadata.version", "scorer_charter_id", "scoring_unit_spec_id",
        "observation_contract_id", "traceability", "rubric_type", "dimensions",
        "critical_errors", "unscorable", "uncertainty", "holistic_use", "versioning",
        "evidence_boundary",
      ],
    },
    "adjudication-protocol.yaml": {
      kind: "AdjudicationProtocol",
      required: [
        "metadata.id", "metadata.version", "rubric_id", "traceability", "disagreement",
        "workflow", "adjudicator", "outcomes", "critical_failure_rule", "feedback",
        "evidence_boundary",
      ],
    },
    "scorer-manifest.yaml": {
      kind: "ScorerManifest",
      required: [
        "metadata.id", "metadata.version", "scorer_charter_id", "scoring_unit_spec_id",
        "observation_contract_id", "rubric_id", "adjudication_protocol_id", "traceability",
        "scorer_identity", "implementations", "precedence", "output_record",
        "failure_behavior", "security", "evidence_boundary",
      ],
    },
    "scorer-validation-report.yaml": {
      kind: "ScorerValidationReport",
      required: [
        "metadata.id", "metadata.version", "scorer_manifest_id", "rubric_id",
        "adjudication_protocol_id", "validation_identity", "evidence", "dimensions.reliability",
        "dimensions.validity", "dimensions.calibration", "error_profile",
        "bias_and_robustness", "security", "acceptance", "limitations",
        "evidence.record_schema.required", "evidence.record_schema.category_values",
        "evidence.record_schema.hash_format", "evidence.record_schema.materialized_status",
      ],
    },
    "scorer-quality-gate.yaml": {
      kind: "ScorerQualityGate",
      required: [
        "metadata.id", "metadata.version", "scorer_manifest_id", "validation_report_id",
        "status_values", "checks", "decision.status", "ready_rule", "exceptions", "limitations",
        "partial_scope_schema.required_when", "partial_scope_schema.required",
        "partial_scope_schema.evidence_rule", "required_check_categories", "all_checks_critical",
      ],
    },
    example: {
      kind: "EvaluationCase",
      required: [
        "metadata.id", "references.target_ids", "references.construct_ids",
        "references.question_ids", "references.risk_ids", "references.scenario_family_ids",
        "references.task_ids", "references.reference_item_ids",
        "references.annotation_protocol_ids", "references.dataset_version_ids",
        "references.quality_gate_ids", "references.scorer_charter_ids",
        "references.scoring_unit_spec_ids", "references.scoring_unit_ids",
        "references.observation_contract_ids",
        "references.rubric_ids", "references.adjudication_protocol_ids",
        "references.scorer_manifest_ids", "references.scorer_identity_ids", "references.scorer_ids",
        "references.scorer_validation_ids",
        "references.scorer_quality_gate_ids", "references.scoring_trace_ids",
        "input.scorer_charter", "input.scoring_units.spec_id", "input.scoring_units.units",
        "input.observation_contract",
        "input.rubric", "input.adjudication", "input.scorers", "input.validation",
        "input.validation.validation_identity",
        "input.quality_gate", "expected.trace_closure", "evidence.design_artifacts",
        "evidence.traceability", "evidence.limitations",
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

const DATA_ROLES = new Set(["distribution", "challenge", "regression"]);
const DATA_GATE_STATUSES = new Set(["ready", "partial", "blocked", "invalid"]);
const DATA_CHECK_STATUSES = new Set(["passed", "partial", "blocked", "failed"]);
const A15_UPSTREAM_FIELDS = [
  "target_ids",
  "construct_ids",
  "question_ids",
  "risk_ids",
  "scenario_family_ids",
  "task_ids",
];
const A15_CANONICAL_UPSTREAM = {
  "examples/refund-agent/evaluation-case.yaml": {
    target_ids: ["target.refund-agent.candidate"],
    construct_ids: ["construct.refund.authorization", "construct.refund.state-safety"],
    question_ids: ["eq.refund.safe"],
    risk_ids: ["risk.refund.unauthorized", "risk.refund.duplicate"],
    scenario_family_ids: [
      "family.refund.normal",
      "family.refund.boundary",
      "family.refund.concurrent",
    ],
    task_ids: ["task.refund.execute"],
  },
  "examples/contract-agent/evaluation-case.yaml": {
    target_ids: ["target.contract-agent.candidate"],
    construct_ids: ["construct.contract.critical-recall", "construct.contract.span-grounding"],
    question_ids: ["eq.contract.screen"],
    risk_ids: ["risk.contract.omission", "risk.contract.fabrication"],
    scenario_family_ids: [
      "family.contract.explicit",
      "family.contract.cross",
      "family.contract.missing",
    ],
    task_ids: ["task.contract.screen"],
  },
  "examples/knowledge-assistant/evaluation-case.yaml": {
    target_ids: ["target.knowledge-assistant.candidate"],
    construct_ids: [
      "construct.knowledge.groundedness",
      "construct.knowledge.access-isolation",
    ],
    question_ids: ["eq.knowledge.answer"],
    risk_ids: ["risk.knowledge.ungrounded", "risk.knowledge.acl"],
    scenario_family_ids: [
      "family.knowledge.current",
      "family.knowledge.conflict",
      "family.knowledge.unauthorized",
    ],
    task_ids: ["task.knowledge.answer"],
  },
};

const A16_UPSTREAM_FIELDS = [
  "target_ids", "construct_ids", "question_ids", "risk_ids", "scenario_family_ids",
  "task_ids", "dataset_charter_ids", "source_ids", "partition_ids",
  "reference_item_ids", "annotation_protocol_ids", "split_ids", "dataset_version_ids",
  "quality_gate_ids", "trace_ids",
];

const A16_CANONICAL_UPSTREAM = {
  "examples/refund-agent/evaluation-case.yaml": {
    target_ids: ["target.refund-agent.candidate"],
    construct_ids: ["construct.refund.authorization", "construct.refund.state-safety"],
    question_ids: ["eq.refund.safe"],
    risk_ids: ["risk.refund.unauthorized", "risk.refund.duplicate"],
    scenario_family_ids: ["family.refund.normal", "family.refund.boundary", "family.refund.concurrent"],
    task_ids: ["task.refund.execute"],
    dataset_charter_ids: ["charter.refund.a15"],
    source_ids: ["source.refund.traffic.v1", "source.refund.incident.v1", "source.refund.policy.v1", "source.refund.state.v1"],
    partition_ids: ["partition.refund.distribution", "partition.refund.challenge", "partition.refund.regression"],
    reference_item_ids: ["reference.refund.policy-state.v1", "reference.refund.timeout.v1"],
    annotation_protocol_ids: ["annotation.refund.v1"],
    split_ids: ["split.refund.development", "split.refund.gate", "split.refund.regression"],
    dataset_version_ids: ["dataset.refund.a15.v1"],
    quality_gate_ids: ["gate.refund.data.v1"],
    trace_ids: ["trace.refund.authorization", "trace.refund.duplicate"],
  },
  "examples/contract-agent/evaluation-case.yaml": {
    target_ids: ["target.contract-agent.candidate"],
    construct_ids: ["construct.contract.critical-recall", "construct.contract.span-grounding"],
    question_ids: ["eq.contract.screen"],
    risk_ids: ["risk.contract.omission", "risk.contract.fabrication"],
    scenario_family_ids: ["family.contract.explicit", "family.contract.cross", "family.contract.missing"],
    task_ids: ["task.contract.screen"],
    dataset_charter_ids: ["charter.contract.a15"],
    source_ids: ["source.contract.licensed.v1", "source.contract.expert.v1", "source.contract.taxonomy.v1"],
    partition_ids: ["partition.contract.distribution", "partition.contract.challenge", "partition.contract.regression"],
    reference_item_ids: ["reference.contract.risk-span.v1", "reference.contract.incomplete.v1"],
    annotation_protocol_ids: ["annotation.contract.v1"],
    split_ids: ["split.contract.development", "split.contract.gate", "split.contract.regression"],
    dataset_version_ids: ["dataset.contract.a15.v1"],
    quality_gate_ids: ["gate.contract.data.v1"],
    trace_ids: ["trace.contract.omission", "trace.contract.fabrication"],
  },
  "examples/knowledge-assistant/evaluation-case.yaml": {
    target_ids: ["target.knowledge-assistant.candidate"],
    construct_ids: ["construct.knowledge.groundedness", "construct.knowledge.access-isolation"],
    question_ids: ["eq.knowledge.answer"],
    risk_ids: ["risk.knowledge.ungrounded", "risk.knowledge.acl"],
    scenario_family_ids: ["family.knowledge.current", "family.knowledge.conflict", "family.knowledge.unauthorized"],
    task_ids: ["task.knowledge.answer"],
    dataset_charter_ids: ["charter.knowledge.a15"],
    source_ids: ["source.knowledge.questions.v1", "source.knowledge.corpus.v1", "source.knowledge.security.v1"],
    partition_ids: ["partition.knowledge.distribution", "partition.knowledge.challenge", "partition.knowledge.regression"],
    reference_item_ids: ["reference.knowledge.claim-span.v1", "reference.knowledge.acl.v1"],
    annotation_protocol_ids: ["annotation.knowledge.v1"],
    split_ids: ["split.knowledge.development", "split.knowledge.gate", "split.knowledge.regression"],
    dataset_version_ids: ["dataset.knowledge.a15.v1"],
    quality_gate_ids: ["gate.knowledge.data.v1"],
    trace_ids: ["trace.knowledge.grounding", "trace.knowledge.acl"],
  },
};

const A16_CANONICAL_SCORER_IDENTITIES = {
  "examples/refund-agent/evaluation-case.yaml": "scorer-identity.refund.a16",
  "examples/contract-agent/evaluation-case.yaml": "scorer-identity.contract.a16",
  "examples/knowledge-assistant/evaluation-case.yaml": "scorer-identity.knowledge.a16",
};

const A16_CANONICAL_VALIDATION_DATASETS = {
  "examples/refund-agent/evaluation-case.yaml": "independent-calibration-set.refund.a16",
  "examples/contract-agent/evaluation-case.yaml": "independent-calibration-set.contract.a16",
  "examples/knowledge-assistant/evaluation-case.yaml": "independent-calibration-set.knowledge.a16",
};

function verifyDecisionContainer(value, label, errors) {
  if (typeof value === "string") return verifyNonEmptyString(value, label, errors);
  if (Array.isArray(value)) return verifyNonEmptyArray(value, label, errors);
  if (isNonEmptyObject(value)) return true;
  errors.push(`${label}: must be a non-empty string, array or object`);
  return false;
}

function verifyDataRoles(value, label, errors) {
  if (!verifyNonEmptyArray(value, label, errors)) return [];
  const roles = [];
  for (const [index, entry] of value.entries()) {
    const role = typeof entry === "string" ? entry : entry?.role ?? entry?.id;
    if (!DATA_ROLES.has(role)) {
      errors.push(`${label}[${index}]: role must be distribution, challenge or regression`);
      continue;
    }
    roles.push(role);
    if (isNonEmptyObject(entry)) {
      verifyNonEmptyString(entry.purpose, `${label}[${index}].purpose`, errors);
    }
  }
  for (const role of DATA_ROLES) {
    if (!roles.includes(role)) errors.push(`${label}: missing required role ${role}`);
  }
  return roles;
}

function verifyAccessViews(value, label, errors) {
  if (!verifyNonEmptyObject(value, label, errors)) return;
  for (const view of ["target", "harness", "scorer", "audit"]) {
    const viewValue = value[view];
    if (verifyNonEmptyObject(viewValue, `${label}.${view}`, errors)) {
      const allowed = verifyNonEmptyStringArray(
        viewValue.allowed_fields,
        `${label}.${view}.allowed_fields`,
        errors,
      );
      const prohibited = verifyNonEmptyStringArray(
        viewValue.prohibited_fields,
        `${label}.${view}.prohibited_fields`,
        errors,
      );
      const prohibitedSet = new Set(prohibited);
      for (const field of allowed) {
        if (prohibitedSet.has(field)) {
          errors.push(`${label}.${view}: field ${field} cannot be both allowed and prohibited`);
        }
      }
    }
  }
  for (const view of ["target", "harness"]) {
    if (value?.[view]?.reference_access !== false) errors.push(`${label}.${view}.reference_access must be false`);
    const prohibited = new Set(asArray(value?.[view]?.prohibited_fields));
    for (const field of ["reference_item_id", "reference", "annotation", "expected"]) {
      if (!prohibited.has(field)) errors.push(`${label}.${view}.prohibited_fields must include ${field}`);
    }
    for (const field of asArray(value?.[view]?.allowed_fields)) {
      if (
        typeof field === "string" &&
        ["reference_item_id", "reference", "annotation", "expected"].some(
          (restricted) => field === restricted || field.startsWith(`${restricted}.`),
        )
      ) {
        errors.push(`${label}.${view}.allowed_fields must not include restricted field ${field}`);
      }
    }
  }
  for (const view of ["scorer", "audit"]) if (value?.[view]?.reference_access !== true) errors.push(`${label}.${view}.reference_access must be true`);
}

function verifyArray(value, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label}: must be an array`);
    return false;
  }
  return true;
}

function verifyPositiveNumber(value, label, errors) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    errors.push(`${label}: must be a positive number`);
    return false;
  }
  return true;
}

function verifyTemplateSourceGovernance(source, label, errors) {
  const requiredStringFields = [
    ["provenance", ["producer", "collection_method", "collected_at", "original_system"]],
    ["lineage", ["transform_version", "output_snapshot"]],
    ["authorization", ["basis", "owner", "expires_at"]],
    ["privacy", ["classification", "deidentification", "reidentification_risk_review"]],
    ["license_and_access", ["license", "access_group", "redistribution"]],
    ["retention", ["deletion_or_review", "derived_data_policy"]],
  ];
  for (const [container, fields] of requiredStringFields) {
    if (!verifyNonEmptyObject(source?.[container], `${label}.${container}`, errors)) continue;
    for (const field of fields) {
      verifyNonEmptyString(source[container][field], `${label}.${container}.${field}`, errors);
    }
  }
  verifyNonEmptyStringArray(source?.lineage?.parent_ids, `${label}.lineage.parent_ids`, errors);
  verifyNonEmptyStringArray(
    source?.lineage?.transformations,
    `${label}.lineage.transformations`,
    errors,
  );
  verifyNonEmptyStringArray(
    source?.authorization?.approved_purposes,
    `${label}.authorization.approved_purposes`,
    errors,
  );
  if (typeof source?.privacy?.personal_data !== "boolean") {
    errors.push(`${label}.privacy.personal_data: must be a boolean`);
  }
  if (verifyArray(source?.privacy?.sensitive_fields, `${label}.privacy.sensitive_fields`, errors)) {
    for (const [index, field] of source.privacy.sensitive_fields.entries()) {
      verifyNonEmptyString(field, `${label}.privacy.sensitive_fields[${index}]`, errors);
    }
  }
  verifyPositiveNumber(source?.retention?.period_days, `${label}.retention.period_days`, errors);
}

function verifyCaseSourceGovernance(source, label, errors) {
  const requiredStringFields = [
    ["provenance", ["producer", "snapshot", "extraction"]],
    ["lineage", ["output"]],
    ["authorization", ["owner", "basis", "expires"]],
    ["privacy", ["classification", "handling"]],
    ["license_and_retention", ["use", "access"]],
  ];
  for (const [container, fields] of requiredStringFields) {
    if (!verifyNonEmptyObject(source?.[container], `${label}.${container}`, errors)) continue;
    for (const field of fields) {
      verifyNonEmptyString(source[container][field], `${label}.${container}.${field}`, errors);
    }
  }
  verifyNonEmptyStringArray(source?.lineage?.parents, `${label}.lineage.parents`, errors);
  verifyNonEmptyStringArray(source?.lineage?.transforms, `${label}.lineage.transforms`, errors);
  if (verifyArray(source?.privacy?.forbidden_fields, `${label}.privacy.forbidden_fields`, errors)) {
    for (const [index, field] of source.privacy.forbidden_fields.entries()) {
      verifyNonEmptyString(field, `${label}.privacy.forbidden_fields[${index}]`, errors);
    }
  }
  if (source?.license_and_retention?.redistribution !== undefined) {
    verifyNonEmptyString(
      source.license_and_retention.redistribution,
      `${label}.license_and_retention.redistribution`,
      errors,
    );
  }
  verifyPositiveNumber(
    source?.license_and_retention?.retention_days,
    `${label}.license_and_retention.retention_days`,
    errors,
  );
}

function verifyTemplateCharter(value, label, errors) {
  if (verifyNonEmptyObject(value?.purpose, `${label}.purpose`, errors)) {
    for (const field of ["decision_supported", "intended_use"]) {
      verifyNonEmptyString(value.purpose[field], `${label}.purpose.${field}`, errors);
    }
    verifyNonEmptyStringArray(value.purpose.prohibited_uses, `${label}.purpose.prohibited_uses`, errors);
  }
  if (verifyNonEmptyObject(value?.target_population, `${label}.target_population`, errors)) {
    verifyNonEmptyString(value.target_population.definition, `${label}.target_population.definition`, errors);
    for (const field of ["inclusion", "exclusion"]) {
      verifyNonEmptyStringArray(value.target_population[field], `${label}.target_population.${field}`, errors);
    }
    if (verifyNonEmptyObject(value.target_population.time_window, `${label}.target_population.time_window`, errors)) {
      for (const field of ["start", "end", "timezone"]) {
        verifyNonEmptyString(value.target_population.time_window[field], `${label}.target_population.time_window.${field}`, errors);
      }
    }
  }
  if (verifyNonEmptyObject(value?.unit_of_analysis, `${label}.unit_of_analysis`, errors)) {
    for (const field of ["primary", "parent_unit", "repeated_measure_key", "dependence_note"]) {
      verifyNonEmptyString(value.unit_of_analysis[field], `${label}.unit_of_analysis.${field}`, errors);
    }
  }
  if (verifyNonEmptyObject(value?.sampling_frame, `${label}.sampling_frame`, errors)) {
    for (const field of ["definition", "frame_id"]) {
      verifyNonEmptyString(value.sampling_frame[field], `${label}.sampling_frame.${field}`, errors);
    }
    verifyNonEmptyStringArray(
      value.sampling_frame.coverage_limitations,
      `${label}.sampling_frame.coverage_limitations`,
      errors,
    );
  }
  if (verifyNonEmptyObject(value?.scope_controls, `${label}.scope_controls`, errors)) {
    if (typeof value.scope_controls.partition_denominators_separate !== "boolean") {
      errors.push(`${label}.scope_controls.partition_denominators_separate: must be a boolean`);
    }
    for (const field of ["protected_evaluation_data", "training_contamination_policy"]) {
      verifyNonEmptyString(value.scope_controls[field], `${label}.scope_controls.${field}`, errors);
    }
  }
  if (verifyNonEmptyObject(value?.evidence_boundary, `${label}.evidence_boundary`, errors)) {
    for (const field of ["establishes", "does_not_establish"]) {
      verifyNonEmptyStringArray(value.evidence_boundary[field], `${label}.evidence_boundary.${field}`, errors);
    }
  }
}

function verifyCaseCharter(value, label, errors) {
  for (const field of ["purpose", "target_population", "evidence_boundary"]) {
    verifyNonEmptyString(value?.[field], `${label}.${field}`, errors);
  }
  if (verifyNonEmptyObject(value?.unit_of_analysis, `${label}.unit_of_analysis`, errors)) {
    for (const field of ["primary", "parent", "repeated_measure"]) {
      verifyNonEmptyString(value.unit_of_analysis[field], `${label}.unit_of_analysis.${field}`, errors);
    }
  }
  if (verifyNonEmptyObject(value?.sampling_frame, `${label}.sampling_frame`, errors)) {
    for (const field of ["id", "definition"]) {
      verifyNonEmptyString(value.sampling_frame[field], `${label}.sampling_frame.${field}`, errors);
    }
    verifyNonEmptyStringArray(value.sampling_frame.exclusions, `${label}.sampling_frame.exclusions`, errors);
  }
  for (const [index, partition] of asArray(value?.partitions).entries()) {
    const partitionLabel = `${label}.partitions[${index}]`;
    for (const field of ["id", "purpose", "denominator"]) {
      verifyNonEmptyString(partition?.[field], `${partitionLabel}.${field}`, errors);
    }
  }
}

function verifyTemplateAnnotation(value, label, errors) {
  verifyObjectEntities(value?.annotation_units, ["id", "level", "input_fields", "output_scope", "parent_key"], `${label}.annotation_units`, errors);
  for (const [index, unit] of asArray(value?.annotation_units).entries()) {
    const unitLabel = `${label}.annotation_units[${index}]`;
    for (const field of ["id", "level", "output_scope", "parent_key"]) verifyNonEmptyString(unit?.[field], `${unitLabel}.${field}`, errors);
    verifyNonEmptyStringArray(unit?.input_fields, `${unitLabel}.input_fields`, errors);
  }
  for (const [index, item] of asArray(value?.label_schema).entries()) {
    const itemLabel = `${label}.label_schema[${index}]`;
    for (const field of ["id", "definition"]) verifyNonEmptyString(item?.[field], `${itemLabel}.${field}`, errors);
    for (const field of ["values", "evidence_required"]) verifyNonEmptyStringArray(item?.[field], `${itemLabel}.${field}`, errors);
  }
  if (verifyNonEmptyObject(value?.instructions, `${label}.instructions`, errors)) {
    verifyNonEmptyStringArray(value.instructions.preparation, `${label}.instructions.preparation`, errors);
    verifyNonEmptyString(value.instructions.decision_rule, `${label}.instructions.decision_rule`, errors);
    verifyNonEmptyStringArray(value.instructions.prohibited, `${label}.instructions.prohibited`, errors);
  }
  if (verifyNonEmptyObject(value?.annotators, `${label}.annotators`, errors)) {
    if (verifyNonEmptyObject(value.annotators.qualification, `${label}.annotators.qualification`, errors)) {
      for (const field of ["domain", "protocol_training"]) verifyNonEmptyString(value.annotators.qualification[field], `${label}.annotators.qualification.${field}`, errors);
      if (typeof value.annotators.qualification.conflicts_disclosed !== "boolean") errors.push(`${label}.annotators.qualification.conflicts_disclosed: must be a boolean`);
    }
    verifyNonEmptyString(value.annotators.assignment, `${label}.annotators.assignment`, errors);
  }
  const passes = value?.blind_independent_passes;
  verifyNonEmptyStringArray(passes?.blind_to, `${label}.blind_independent_passes.blind_to`, errors);
  verifyNonEmptyString(passes?.independence_check, `${label}.blind_independent_passes.independence_check`, errors);
  const disagreement = value?.disagreement;
  verifyNonEmptyString(disagreement?.detection, `${label}.disagreement.detection`, errors);
  verifyNonEmptyStringArray(disagreement?.categories, `${label}.disagreement.categories`, errors);
  verifyNonEmptyStringArray(disagreement?.resolution_input, `${label}.disagreement.resolution_input`, errors);
  const arbitration = value?.arbitration;
  for (const field of ["arbitrator_qualification", "method"]) verifyNonEmptyString(arbitration?.[field], `${label}.arbitration.${field}`, errors);
  verifyNonEmptyStringArray(arbitration?.outputs, `${label}.arbitration.outputs`, errors);
  const quality = value?.quality_control;
  for (const field of ["calibration", "drift_action"]) verifyNonEmptyString(quality?.[field], `${label}.quality_control.${field}`, errors);
  verifyNonEmptyStringArray(quality?.audits, `${label}.quality_control.audits`, errors);
  for (const field of ["minimum_fields_only", "redaction_before_assignment", "access_logged", "export_restricted"]) {
    if (typeof value?.privacy_handling?.[field] !== "boolean") errors.push(`${label}.privacy_handling.${field}: must be a boolean`);
  }
  for (const field of ["record_fields", "adjudication_fields"]) {
    verifyNonEmptyStringArray(value?.outputs?.[field], `${label}.outputs.${field}`, errors);
  }
}

function verifyCaseAnnotation(value, label, errors) {
  verifyNonEmptyString(value?.protocol_id, `${label}.protocol_id`, errors);
  verifyObjectEntities(value?.units, ["id", "level", "fields"], `${label}.units`, errors);
  for (const [index, unit] of asArray(value?.units).entries()) {
    const unitLabel = `${label}.units[${index}]`;
    verifyNonEmptyString(unit?.level, `${unitLabel}.level`, errors);
    verifyNonEmptyStringArray(unit?.fields, `${unitLabel}.fields`, errors);
  }
  verifyObjectEntities(value?.labels, ["id", "values", "evidence"], `${label}.labels`, errors);
  for (const [index, item] of asArray(value?.labels).entries()) {
    verifyNonEmptyStringArray(item?.values, `${label}.labels[${index}].values`, errors);
    verifyNonEmptyStringArray(item?.evidence, `${label}.labels[${index}].evidence`, errors);
  }
  verifyNonEmptyStringArray(value?.blind_independent?.blind_to, `${label}.blind_independent.blind_to`, errors);
  verifyNonEmptyString(value?.blind_independent?.qualification, `${label}.blind_independent.qualification`, errors);
  verifyNonEmptyStringArray(value?.disagreement?.categories, `${label}.disagreement.categories`, errors);
  verifyNonEmptyString(value?.disagreement?.critical_action, `${label}.disagreement.critical_action`, errors);
  verifyNonEmptyString(value?.arbitration?.role, `${label}.arbitration.role`, errors);
  verifyNonEmptyStringArray(value?.arbitration?.outputs, `${label}.arbitration.outputs`, errors);
  const hasInputs = Array.isArray(value?.arbitration?.inputs) && value.arbitration.inputs.length > 0;
  const hasMethod = typeof value?.arbitration?.method === "string" && value.arbitration.method.trim().length > 0;
  if (!hasInputs && !hasMethod) errors.push(`${label}.arbitration: must define non-empty inputs or method`);
  if (value?.arbitration?.inputs !== undefined) verifyNonEmptyStringArray(value.arbitration.inputs, `${label}.arbitration.inputs`, errors);
  if (value?.arbitration?.method !== undefined) verifyNonEmptyString(value.arbitration.method, `${label}.arbitration.method`, errors);
}

function verifyTemplateSplit(value, label, errors) {
  const boundaries = new Set();
  for (const [index, control] of asArray(value?.leakage_controls).entries()) {
    const controlLabel = `${label}.leakage_controls[${index}]`;
    for (const field of ["id", "boundary", "key", "rule", "check", "failure_action"]) {
      verifyNonEmptyString(control?.[field], `${controlLabel}.${field}`, errors);
    }
    if (!new Set(["parent", "entity", "document", "template", "time"]).has(control?.boundary)) {
      errors.push(`${controlLabel}.boundary: must be parent, entity, document, template or time`);
    } else boundaries.add(control.boundary);
  }
  for (const boundary of ["parent", "entity", "document", "template", "time"]) {
    if (!boundaries.has(boundary)) errors.push(`${label}.leakage_controls: must cover ${boundary}`);
  }
  for (const [index, split] of asArray(value?.splits).entries()) {
    const splitLabel = `${label}.splits[${index}]`;
    for (const field of ["id", "purpose", "time_window", "assignment_rule"]) {
      verifyNonEmptyString(split?.[field], `${splitLabel}.${field}`, errors);
    }
    verifyNonEmptyStringArray(split?.partition_roles, `${splitLabel}.partition_roles`, errors);
    verifyNonEmptyStringArray(split?.source_ids, `${splitLabel}.source_ids`, errors);
    verifyNonEmptyStringArray(split?.allowed_use, `${splitLabel}.allowed_use`, errors);
    if (typeof split?.protected !== "boolean") errors.push(`${splitLabel}.protected: must be a boolean`);
  }
  if (verifyNonEmptyObject(value?.assignment_audit, `${label}.assignment_audit`, errors)) {
    verifyNonEmptyStringArray(value.assignment_audit.required_outputs, `${label}.assignment_audit.required_outputs`, errors);
    verifyNonEmptyString(value.assignment_audit.reviewer, `${label}.assignment_audit.reviewer`, errors);
  }
}

function verifyCaseSplit(value, label, errors) {
  verifyNonEmptyString(value?.manifest_id, `${label}.manifest_id`, errors);
  if (verifyNonEmptyObject(value?.grouping, `${label}.grouping`, errors)) {
    for (const field of ["parent", "entity", "document", "template", "time"]) {
      verifyNonEmptyString(value.grouping[field], `${label}.grouping.${field}`, errors);
    }
  }
  const boundaries = new Set();
  for (const [index, control] of asArray(value?.leakage_controls).entries()) {
    const controlLabel = `${label}.leakage_controls[${index}]`;
    verifyNonEmptyString(control?.boundary, `${controlLabel}.boundary`, errors);
    verifyNonEmptyString(control?.rule, `${controlLabel}.rule`, errors);
    if (!new Set(["parent", "entity", "document", "template", "time"]).has(control?.boundary)) {
      errors.push(`${controlLabel}.boundary: must be parent, entity, document, template or time`);
    } else boundaries.add(control.boundary);
  }
  for (const boundary of ["parent", "entity", "document", "template", "time"]) {
    if (!boundaries.has(boundary)) errors.push(`${label}.leakage_controls: must cover ${boundary}`);
  }
  for (const [index, split] of asArray(value?.splits).entries()) {
    const splitLabel = `${label}.splits[${index}]`;
    for (const field of ["id", "purpose"]) verifyNonEmptyString(split?.[field], `${splitLabel}.${field}`, errors);
    verifyNonEmptyStringArray(split?.partitions, `${splitLabel}.partitions`, errors);
    if (typeof split?.protected !== "boolean") errors.push(`${splitLabel}.protected: must be a boolean`);
  }
}

function verifyTemplateDataset(value, label, errors) {
  for (const [index, content] of asArray(value?.contents).entries()) {
    const contentLabel = `${label}.contents[${index}]`;
    for (const field of ["id", "path", "media_type", "hash", "record_role"]) {
      verifyNonEmptyString(content?.[field], `${contentLabel}.${field}`, errors);
    }
  }
  if (verifyNonEmptyObject(value?.item_schema, `${label}.item_schema`, errors)) {
    verifyNonEmptyStringArray(value.item_schema.required, `${label}.item_schema.required`, errors);
    verifyNonEmptyStringArray(value.item_schema.sensitive_fields, `${label}.item_schema.sensitive_fields`, errors);
    verifyNonEmptyString(value.item_schema.identity_rule, `${label}.item_schema.identity_rule`, errors);
  }
  if (verifyNonEmptyArray(value?.joins, `${label}.joins`, errors)) {
    for (const [index, join] of value.joins.entries()) {
      const joinLabel = `${label}.joins[${index}]`;
      if (!verifyNonEmptyObject(join, joinLabel, errors)) continue;
      for (const field of ["from", "to", "cardinality"]) verifyNonEmptyString(join[field], `${joinLabel}.${field}`, errors);
      if (typeof join.orphan_allowed !== "boolean") errors.push(`${joinLabel}.orphan_allowed: must be a boolean`);
    }
  }
  for (const [index, summary] of asArray(value?.partition_summary).entries()) {
    const summaryLabel = `${label}.partition_summary[${index}]`;
    for (const field of ["partition_id", "role", "denominator", "reporting"]) {
      verifyNonEmptyString(summary?.[field], `${summaryLabel}.${field}`, errors);
    }
    if (!(typeof summary?.count === "number" && summary.count >= 0) && !isMaterializedString(summary?.count)) {
      errors.push(`${summaryLabel}.count: must be a non-negative number or non-empty declared value`);
    }
  }
  if (verifyNonEmptyObject(value?.provenance_summary, `${label}.provenance_summary`, errors)) {
    for (const field of ["all_sources_registered", "all_transformations_versioned", "authorization_current_at_creation", "privacy_review_id"]) {
      verifyNonEmptyString(value.provenance_summary[field], `${label}.provenance_summary.${field}`, errors);
    }
  }
  if (verifyNonEmptyObject(value?.versioning, `${label}.versioning`, errors)) {
    if (typeof value.versioning.immutable !== "boolean") errors.push(`${label}.versioning.immutable: must be a boolean`);
    verifyNonEmptyString(value.versioning.mutation_policy, `${label}.versioning.mutation_policy`, errors);
    if (verifyNonEmptyObject(value.versioning.supersession, `${label}.versioning.supersession`, errors)) {
      for (const field of ["supersedes", "superseded_by", "compatibility"]) verifyNonEmptyString(value.versioning.supersession[field], `${label}.versioning.supersession.${field}`, errors);
    }
  }
  if (verifyNonEmptyObject(value?.drift_and_refresh, `${label}.drift_and_refresh`, errors)) {
    for (const field of ["monitors", "triggers"]) verifyNonEmptyStringArray(value.drift_and_refresh[field], `${label}.drift_and_refresh.${field}`, errors);
    for (const field of ["refresh_process", "comparison"]) verifyNonEmptyString(value.drift_and_refresh[field], `${label}.drift_and_refresh.${field}`, errors);
  }
  if (verifyNonEmptyObject(value?.evidence_boundary, `${label}.evidence_boundary`, errors)) {
    for (const field of ["establishes", "does_not_establish"]) verifyNonEmptyStringArray(value.evidence_boundary[field], `${label}.evidence_boundary.${field}`, errors);
  }
}

function verifyCaseDataset(value, label, errors) {
  verifyNonEmptyString(value?.id, `${label}.id`, errors);
  if (verifyNonEmptyObject(value?.identity, `${label}.identity`, errors)) {
    for (const field of ["content_hash", "schema_hash", "created_at", "status"]) {
      verifyNonEmptyString(value.identity[field], `${label}.identity.${field}`, errors);
    }
    if (typeof value.identity.immutable !== "boolean") errors.push(`${label}.identity.immutable: must be a boolean`);
  }
  verifyObjectEntities(value?.contents, ["id", "role", "hash"], `${label}.contents`, errors);
  for (const [index, content] of asArray(value?.contents).entries()) {
    for (const field of ["id", "role", "hash"]) verifyNonEmptyString(content?.[field], `${label}.contents[${index}].${field}`, errors);
  }
  verifyNonEmptyStringArray(value?.item_schema, `${label}.item_schema`, errors);
  if (verifyNonEmptyObject(value?.drift_and_refresh, `${label}.drift_and_refresh`, errors)) {
    for (const field of ["monitors", "triggers"]) verifyNonEmptyStringArray(value.drift_and_refresh[field], `${label}.drift_and_refresh.${field}`, errors);
    verifyNonEmptyString(value.drift_and_refresh.action, `${label}.drift_and_refresh.action`, errors);
  }
}

function verifyReferenceContent({ items, invariants, knownRiskIds, knownSourceIds, knownTaskIds, label, errors }) {
  verifyObjectEntities(
    items,
    [
      "id",
      "task_ids",
      "risk_ids",
      "source_ids",
      "oracle_type",
      "authoritative_material",
      "expected",
      "acceptable_alternatives",
      "uncertainty_action",
    ],
    `${label}.items`,
    errors,
  );
  for (const [index, item] of asArray(items).entries()) {
    const itemLabel = `${label}.items[${index}]`;
    for (const [field, known] of [
      ["task_ids", knownTaskIds],
      ["risk_ids", knownRiskIds],
      ["source_ids", knownSourceIds],
    ]) {
      const ids = verifyStringIdList(item?.[field], `${itemLabel}.${field}`, errors);
      verifyReferencesKnown(ids, new Set(known), `${itemLabel}.${field}`, errors);
    }
    verifyNonEmptyString(item?.oracle_type, `${itemLabel}.oracle_type`, errors);
    if (verifyNonEmptyArray(item?.authoritative_material, `${itemLabel}.authoritative_material`, errors)) {
      for (const [materialIndex, material] of item.authoritative_material.entries()) {
        const materialLabel = `${itemLabel}.authoritative_material[${materialIndex}]`;
        if (!verifyNonEmptyObject(material, materialLabel, errors)) continue;
        for (const field of ["id", "version", "effective_at", "span"]) {
          verifyNonEmptyString(material[field], `${materialLabel}.${field}`, errors);
        }
      }
    }
    if (verifyNonEmptyObject(item?.expected, `${itemLabel}.expected`, errors)) {
      for (const field of ["required_outcomes", "prohibited_outcomes", "required_evidence"]) {
        verifyNonEmptyStringArray(item.expected[field], `${itemLabel}.expected.${field}`, errors);
      }
    }
    if (verifyArray(item?.acceptable_alternatives, `${itemLabel}.acceptable_alternatives`, errors)) {
      for (const [alternativeIndex, alternative] of item.acceptable_alternatives.entries()) {
        const alternativeLabel = `${itemLabel}.acceptable_alternatives[${alternativeIndex}]`;
        if (!verifyNonEmptyObject(alternative, alternativeLabel, errors)) continue;
        for (const field of ["condition", "outcome", "rationale"]) {
          verifyNonEmptyString(alternative[field], `${alternativeLabel}.${field}`, errors);
        }
      }
    }
    verifyNonEmptyString(item?.uncertainty_action, `${itemLabel}.uncertainty_action`, errors);
  }

  verifyObjectEntities(
    invariants,
    ["id", "risk_ids", "assertion", "observation_required"],
    `${label}.invariants`,
    errors,
  );
  for (const [index, invariant] of asArray(invariants).entries()) {
    const invariantLabel = `${label}.invariants[${index}]`;
    const riskIds = verifyStringIdList(invariant?.risk_ids, `${invariantLabel}.risk_ids`, errors);
    verifyReferencesKnown(riskIds, new Set(knownRiskIds), `${invariantLabel}.risk_ids`, errors);
    verifyNonEmptyString(invariant?.assertion, `${invariantLabel}.assertion`, errors);
    verifyNonEmptyStringArray(
      invariant?.observation_required,
      `${invariantLabel}.observation_required`,
      errors,
    );
  }
}

function verifySamplingGaps(value, label, errors) {
  if (!verifyArray(value, label, errors)) return;
  for (const [index, gap] of value.entries()) {
    const gapLabel = `${label}[${index}]`;
    if (!verifyNonEmptyObject(gap, gapLabel, errors)) continue;
    for (const field of [
      "id",
      "description",
      "affected_population_or_risk",
      "impact",
      "owner",
      "action",
    ]) {
      verifyNonEmptyString(gap[field], `${gapLabel}.${field}`, errors);
    }
    if (!new Set(["gap", "blocked"]).has(gap.status)) {
      errors.push(`${gapLabel}.status: must be gap or blocked`);
    }
  }
}

function verifyGate({
  gate,
  checks,
  quotas,
  gaps,
  knownEvidenceIds,
  forbiddenEvidenceIds = new Set(),
  materializedEvidenceByCategory = null,
  label,
  errors,
}) {
  verifyObjectEntities(checks, ["id", "status", "evidence"], `${label}.checks`, errors);
  for (const [index, check] of asArray(checks).entries()) {
    const checkLabel = `${label}.checks[${index}]`;
    if (!DATA_CHECK_STATUSES.has(check?.status)) {
      errors.push(`${checkLabel}.status must be passed, partial, blocked or failed`);
    }
    if (verifyNonEmptyObject(check?.evidence, `${checkLabel}.evidence`, errors)) {
      verifyNonEmptyString(check.evidence.semantic_basis, `${checkLabel}.evidence.semantic_basis`, errors);
      const links = verifyStringIdList(
        check.evidence.evidence_links,
        `${checkLabel}.evidence.evidence_links`,
        errors,
      );
      verifyReferencesKnown(
        links,
        knownEvidenceIds,
        `${checkLabel}.evidence.evidence_links`,
        errors,
      );
      for (const id of links) {
        if (forbiddenEvidenceIds.has(id)) {
          errors.push(`${checkLabel}.evidence.evidence_links: gate cannot use self evidence id ${id}`);
        }
      }
      if (check?.status === "passed" && materializedEvidenceByCategory) {
        const category = ["source", "reference", "annotation", "leakage", "version", "coverage"]
          .find((name) => check.id?.includes(`.${name}`));
        if (category) {
          const materializedIds = materializedEvidenceByCategory.get(category) ?? new Set();
          if (!links.some((id) => materializedIds.has(id))) {
            errors.push(
              `${checkLabel}.evidence.evidence_links: passed ${category} check requires a materialized external evidence asset`,
            );
          }
        }
      }
      if (check.evidence.sample_count_only !== false) {
        errors.push(`${checkLabel}.evidence.sample_count_only must be false`);
      }
    }
  }

  const decision = gate?.decision;
  const status = decision?.status;
  if (!DATA_GATE_STATUSES.has(status)) {
    errors.push(`${label}.decision.status must be ready, partial, blocked or invalid`);
  }
  const expectedIdsByField = {
    blocking_check_ids: asArray(checks).filter((check) => check?.status === "blocked").map((check) => check.id),
    partial_check_ids: asArray(checks).filter((check) => check?.status === "partial").map((check) => check.id),
    invalidating_check_ids: asArray(checks).filter((check) => check?.status === "failed").map((check) => check.id),
  };
  for (const [field, expectedIds] of Object.entries(expectedIdsByField)) {
    const ids = verifyStringIdArray(decision?.[field], `${label}.decision.${field}`, errors, true);
    verifyExactSet(ids, expectedIds, `${label}.decision.${field}`, errors);
  }

  const statuses = asArray(checks).map((check) => check?.status);
  if (status === "ready") {
    if (statuses.some((checkStatus) => checkStatus !== "passed")) {
      errors.push(`${label}.decision.status cannot be ready unless every check passed`);
    }
    if (asArray(quotas).some((quota) => quota?.status !== "met")) {
      errors.push(`${label}.decision.status cannot be ready with quota gaps`);
    }
    if (asArray(gaps).length > 0) {
      errors.push(`${label}.decision.status cannot be ready with sampling-frame gaps`);
    }
  } else if (status === "partial") {
    if (!statuses.includes("partial") || statuses.some((item) => item === "blocked" || item === "failed")) {
      errors.push(`${label}.decision.status partial requires a partial check and no blocked or failed checks`);
    }
    for (const field of ["allowed_scope", "blocked_scope"]) {
      verifyDecisionContainer(decision?.[field], `${label}.decision.${field}`, errors);
    }
    verifyNonEmptyStringArray(decision?.prohibited_claims, `${label}.decision.prohibited_claims`, errors);
  } else if (status === "blocked") {
    if (!statuses.includes("blocked") || statuses.includes("failed")) {
      errors.push(`${label}.decision.status blocked requires a blocked check and no failed checks`);
    }
    for (const field of ["reason", "owner", "action", "allowed_next_step"]) {
      verifyNonEmptyString(decision?.[field], `${label}.decision.${field}`, errors);
    }
    verifyNonEmptyStringArray(decision?.prohibited_claims, `${label}.decision.prohibited_claims`, errors);
  } else if (status === "invalid") {
    if (!statuses.includes("failed")) {
      errors.push(`${label}.decision.status invalid requires a failed check`);
    }
    for (const field of ["reason", "owner", "action"]) {
      verifyNonEmptyString(decision?.[field], `${label}.decision.${field}`, errors);
    }
    verifyNonEmptyStringArray(decision?.prohibited_claims, `${label}.decision.prohibited_claims`, errors);
  }
}

const MATERIALIZATION_SENTINEL = /(?:^|[-_:])(planned|pending|placeholder|declared)(?:$|[-_:])|not-materialized|design-only/i;

function isMaterializedString(value) {
  return typeof value === "string" && value.trim().length > 0 && !MATERIALIZATION_SENTINEL.test(value);
}

function verifyMaterializedString(value, label, errors) {
  if (!isMaterializedString(value)) {
    errors.push(`${label}: must identify a materialized non-sentinel value`);
    return false;
  }
  return true;
}

function verifySha256Identity(value, label, errors) {
  if (!verifyMaterializedString(value, label, errors)) return false;
  if (!/^sha256:[A-Za-z0-9._-]+$/.test(value)) {
    errors.push(`${label}: must be a sha256 content identity`);
    return false;
  }
  return true;
}

function collectMaterializedOutputs(value, label, errors, requiredTypes) {
  const idsByType = new Map();
  if (!verifyNonEmptyArray(value, label, errors)) return idsByType;
  for (const [index, output] of value.entries()) {
    const outputLabel = `${label}[${index}]`;
    if (!verifyNonEmptyObject(output, outputLabel, errors)) continue;
    verifyNonEmptyString(output.id, `${outputLabel}.id`, errors);
    verifyNonEmptyString(output.type, `${outputLabel}.type`, errors);
    verifySha256Identity(output.hash, `${outputLabel}.hash`, errors);
    if (output.status !== "materialized") {
      errors.push(`${outputLabel}.status: must be materialized`);
    }
    if (typeof output.id === "string" && typeof output.type === "string") {
      idsByType.set(output.type, output.id);
    }
  }
  for (const type of requiredTypes) {
    if (!idsByType.has(type)) errors.push(`${label}: missing materialized output type ${type}`);
  }
  return idsByType;
}

function verifyCaseReadyMaterialization(value, relativePath, errors) {
  const byCategory = new Map(
    ["source", "reference", "annotation", "leakage", "version", "coverage"]
      .map((category) => [category, new Set()]),
  );
  for (const [index, source] of asArray(value?.input?.sources).entries()) {
    const label = `${relativePath}: input.sources[${index}]`;
    if (source?.status !== "materialized") errors.push(`${label}.status: ready requires materialized`);
    verifyMaterializedString(source?.provenance?.snapshot, `${label}.provenance.snapshot`, errors);
    verifyMaterializedString(source?.provenance?.extraction, `${label}.provenance.extraction`, errors);
    if (source?.authorization?.status !== "verified-current") {
      errors.push(`${label}.authorization.status: ready requires verified-current`);
    }
    if (source?.status === "materialized" && typeof source?.id === "string") {
      byCategory.get("source").add(source.id);
    }
  }
  for (const [index, quota] of asArray(value?.input?.sampling?.allocation?.per_stratum).entries()) {
    if (!(typeof quota?.actual_count === "number" && quota.actual_count > 0)) {
      errors.push(`${relativePath}: input.sampling.allocation.per_stratum[${index}].actual_count: ready requires a positive materialized count`);
    }
  }

  const referenceOutputs = collectMaterializedOutputs(
    value?.input?.reference?.outputs,
    `${relativePath}: input.reference.outputs`,
    errors,
    ["reference-items", "authority-snapshot-report"],
  );
  for (const id of referenceOutputs.values()) byCategory.get("reference").add(id);
  const annotationOutputs = collectMaterializedOutputs(
    value?.input?.annotation?.outputs,
    `${relativePath}: input.annotation.outputs`,
    errors,
    ["raw-labels", "adjudication-records", "quality-control-report"],
  );
  for (const id of annotationOutputs.values()) byCategory.get("annotation").add(id);
  const leakageOutputs = collectMaterializedOutputs(
    value?.input?.split?.assignment_audit?.outputs,
    `${relativePath}: input.split.assignment_audit.outputs`,
    errors,
    ["item-to-group-map", "cross-split-collision-report", "near-duplicate-report", "temporal-cutoff-report"],
  );
  for (const id of leakageOutputs.values()) byCategory.get("leakage").add(id);

  const identity = value?.input?.dataset_version?.identity;
  if (identity?.status !== "materialized") {
    errors.push(`${relativePath}: input.dataset_version.identity.status: ready requires materialized`);
  }
  for (const field of ["content_hash", "schema_hash"]) {
    verifySha256Identity(identity?.[field], `${relativePath}: input.dataset_version.identity.${field}`, errors);
  }
  if (
    !verifyMaterializedString(
      identity?.created_at,
      `${relativePath}: input.dataset_version.identity.created_at`,
      errors,
    ) ||
    Number.isNaN(Date.parse(identity.created_at))
  ) {
    errors.push(`${relativePath}: input.dataset_version.identity.created_at: must be a parseable timestamp`);
  }
  for (const [index, content] of asArray(value?.input?.dataset_version?.contents).entries()) {
    const label = `${relativePath}: input.dataset_version.contents[${index}]`;
    verifyMaterializedString(content?.role, `${label}.role`, errors);
    if (verifySha256Identity(content?.hash, `${label}.hash`, errors) && typeof content?.id === "string") {
      byCategory.get("version").add(content.id);
      if (content.role?.includes("item")) byCategory.get("coverage").add(content.id);
    }
  }
  if (identity?.status === "materialized" && typeof value?.input?.dataset_version?.id === "string") {
    byCategory.get("version").add(value.input.dataset_version.id);
  }
  return byCategory;
}

function verifyTaskScenarioDataTemplates(templateValues, errors) {
  const charter = templateValues.get("dataset-charter.yaml");
  const sources = templateValues.get("source-register.yaml");
  const sampling = templateValues.get("sampling-plan.yaml");
  const standard = templateValues.get("reference-standard.yaml");
  const annotation = templateValues.get("annotation-protocol.yaml");
  const split = templateValues.get("split-manifest.yaml");
  const dataset = templateValues.get("dataset-manifest.yaml");
  const gate = templateValues.get("data-quality-gate.yaml");

  const ids = {
    dataset_charter_id: charter?.metadata?.id,
    source_register_id: sources?.metadata?.id,
    sampling_plan_id: sampling?.metadata?.id,
    reference_standard_id: standard?.metadata?.id,
    annotation_protocol_id: annotation?.metadata?.id,
    split_manifest_id: split?.metadata?.id,
    dataset_manifest_id: dataset?.metadata?.id,
  };
  for (const [relativePath, value] of [
    ["source-register.yaml", sources], ["sampling-plan.yaml", sampling],
    ["reference-standard.yaml", standard], ["annotation-protocol.yaml", annotation],
    ["split-manifest.yaml", split], ["dataset-manifest.yaml", dataset],
  ]) {
    verifyEqualReference(value?.dataset_charter_id, ids.dataset_charter_id, `${relativePath}: dataset_charter_id`, errors);
  }
  for (const [relativePath, value, field] of [
    ["sampling-plan.yaml", sampling, "source_register_id"],
    ["reference-standard.yaml", standard, "source_register_id"],
    ["annotation-protocol.yaml", annotation, "reference_standard_id"],
    ["split-manifest.yaml", split, "sampling_plan_id"],
    ["split-manifest.yaml", split, "source_register_id"],
    ["data-quality-gate.yaml", gate, "dataset_manifest_id"],
  ]) {
    verifyEqualReference(value?.[field], ids[field], `${relativePath}: ${field}`, errors);
  }
  verifyEqualReference(
    sampling?.sampling_frame?.frame_id,
    charter?.sampling_frame?.frame_id,
    "sampling-plan.yaml: sampling_frame.frame_id",
    errors,
  );
  for (const field of ["source_register_id", "sampling_plan_id", "reference_standard_id", "annotation_protocol_id", "split_manifest_id"]) {
    verifyEqualReference(dataset?.[field], ids[field], `dataset-manifest.yaml: ${field}`, errors);
  }

  const traceFields = ["target_ids", "construct_ids", "question_ids", "risk_ids", "scenario_family_ids", "task_ids"];
  const canonicalTrace = {};
  for (const field of traceFields) {
    canonicalTrace[field] = verifyStringIdList(charter?.traceability?.[field], `dataset-charter.yaml: traceability.${field}`, errors);
  }
  verifyTemplateCharter(charter, "dataset-charter.yaml", errors);
  for (const field of ["purpose", "target_population", "unit_of_analysis", "sampling_frame", "scope_controls", "evidence_boundary"]) verifyNonEmptyObject(charter?.[field], `dataset-charter.yaml: ${field}`, errors);
  const partitionIds = verifyObjectEntities(charter?.partitions, ["id", "role", "question_ids", "risk_ids", "population_relation", "allowed_claim"], "dataset-charter.yaml: partitions", errors);
  const declaredRoles = [];
  for (const [index, partition] of asArray(charter?.partitions).entries()) {
    const label = `dataset-charter.yaml: partitions[${index}]`;
    if (!DATA_ROLES.has(partition?.role)) errors.push(`${label}.role: must be distribution, challenge or regression`);
    else declaredRoles.push(partition.role);
    for (const [field, known] of [["question_ids", canonicalTrace.question_ids], ["risk_ids", canonicalTrace.risk_ids]]) {
      const refs = verifyStringIdList(partition?.[field], `${label}.${field}`, errors);
      verifyReferencesKnown(refs, new Set(known), `${label}.${field}`, errors);
    }
    verifyNonEmptyString(partition?.population_relation, `${label}.population_relation`, errors);
    verifyNonEmptyString(partition?.allowed_claim, `${label}.allowed_claim`, errors);
  }
  for (const role of DATA_ROLES) if (!declaredRoles.includes(role)) errors.push(`dataset-charter.yaml: partitions must cover role ${role}`);

  const sourceIds = verifyObjectEntities(
    sources?.sources,
    ["id", "name", "type", "purpose", "partition_ids", "provenance", "lineage", "authorization", "privacy", "license_and_access", "retention", "quality_limitations"],
    "source-register.yaml: sources",
    errors,
  );
  for (const [index, source] of asArray(sources?.sources).entries()) {
    const label = `source-register.yaml: sources[${index}]`;
    const sourcePartitions = verifyStringIdList(source?.partition_ids, `${label}.partition_ids`, errors);
    verifyReferencesKnown(sourcePartitions, new Set(partitionIds), `${label}.partition_ids`, errors);
    for (const field of ["provenance", "lineage", "authorization", "privacy", "license_and_access", "retention"]) {
      verifyNonEmptyObject(source?.[field], `${label}.${field}`, errors);
    }
    verifyTemplateSourceGovernance(source, label, errors);
    verifyNonEmptyArray(source?.quality_limitations, `${label}.quality_limitations`, errors);
  }
  for (const field of ["target_ids", "question_ids", "risk_ids"]) {
    if (sources?.traceability?.[field] !== undefined) verifyMatchingIdSet(sources.traceability[field], canonicalTrace[field], `source-register.yaml: traceability.${field}`, errors);
  }
  verifyMatchingIdSet(sources?.traceability?.partition_ids, partitionIds, "source-register.yaml: traceability.partition_ids", errors);
  verifyNonEmptyObject(sources?.source_governance, "source-register.yaml: source_governance", errors);

  verifyDecisionContainer(sampling?.population, "sampling-plan.yaml: population", errors);
  if (verifyNonEmptyObject(sampling?.sampling_frame, "sampling-plan.yaml: sampling_frame", errors)) {
    verifyNonEmptyString(sampling.sampling_frame.frame_id, "sampling-plan.yaml: sampling_frame.frame_id", errors);
    verifySamplingGaps(sampling.sampling_frame.gaps, "sampling-plan.yaml: sampling_frame.gaps", errors);
  }
  const stratumIds = verifyObjectEntities(sampling?.strata, ["id", "risk_ids", "scenario_family_ids", "definition"], "sampling-plan.yaml: strata", errors);
  for (const [index, stratum] of asArray(sampling?.strata).entries()) {
    for (const [field, known] of [["risk_ids", canonicalTrace.risk_ids], ["scenario_family_ids", canonicalTrace.scenario_family_ids]]) {
      const refs = verifyStringIdList(stratum?.[field], `sampling-plan.yaml: strata[${index}].${field}`, errors);
      verifyReferencesKnown(refs, new Set(known), `sampling-plan.yaml: strata[${index}].${field}`, errors);
    }
  }
  for (const field of ["selection", "allocation", "deduplication", "weighting"]) verifyNonEmptyObject(sampling?.[field], `sampling-plan.yaml: ${field}`, errors);
  const quotas = sampling?.allocation?.per_stratum;
  verifyRequiredEntryFields(quotas, ["stratum_id", "target_count", "actual_count", "status", "rationale"], "sampling-plan.yaml: allocation.per_stratum", errors);
  const allowedQuotaStatuses = new Set(["met", "gap", "blocked"]);
  for (const [index, quota] of asArray(quotas).entries()) {
    const label = `sampling-plan.yaml: allocation.per_stratum[${index}]`;
    if (!stratumIds.includes(quota?.stratum_id)) errors.push(`${label}.stratum_id: unknown id ${quota?.stratum_id}`);
    for (const field of ["target_count", "actual_count"]) {
      const count = quota?.[field];
      if (!((typeof count === "number" && count >= 0) || (typeof count === "string" && count.length > 0))) errors.push(`${label}.${field}: must be a non-negative number or non-empty blocked placeholder`);
    }
    if (!allowedQuotaStatuses.has(quota?.status)) errors.push(`${label}.status: must be met, gap or blocked`);
    if (quota?.status === "met" && (typeof quota.actual_count !== "number" || typeof quota.target_count !== "number" || quota.actual_count < quota.target_count)) errors.push(`${label}.status: met requires numeric actual_count at least target_count`);
  }
  verifyRequiredEntryFields(sampling?.partition_assignment, ["partition_id", "role", "source_ids", "method", "denominator_policy"], "sampling-plan.yaml: partition_assignment", errors);
  const usedPartitions = new Set(); const usedSources = new Set();
  for (const [index, assignment] of asArray(sampling?.partition_assignment).entries()) {
    const label = `sampling-plan.yaml: partition_assignment[${index}]`;
    if (!DATA_ROLES.has(assignment?.role)) errors.push(`${label}.role: must be distribution, challenge or regression`);
    verifyReferencesKnown([assignment?.partition_id], new Set(partitionIds), `${label}.partition_id`, errors, usedPartitions);
    verifyReferencesKnown(verifyStringIdList(assignment?.source_ids, `${label}.source_ids`, errors), new Set(sourceIds), `${label}.source_ids`, errors, usedSources);
  }
  for (const id of partitionIds) if (!usedPartitions.has(id)) errors.push(`sampling-plan.yaml: partition ${id} is not assigned`);
  for (const id of sourceIds) if (!usedSources.has(id)) errors.push(`sampling-plan.yaml: source ${id} is not assigned`);

  for (const field of ["reference_policy", "oracle_hierarchy", "uncertainty", "versioning"]) verifyNonEmptyObject(standard?.[field], `reference-standard.yaml: ${field}`, errors);
  for (const field of ["principle", "precedence", "conflict_action"]) verifyDecisionContainer(standard?.reference_policy?.[field], `reference-standard.yaml: reference_policy.${field}`, errors);
  const referenceIds = asArray(standard?.reference_items)
    .map((item) => item?.id)
    .filter((id) => typeof id === "string" && id.length > 0);
  verifyReferenceContent({
    items: standard?.reference_items,
    invariants: standard?.invariants,
    knownRiskIds: canonicalTrace.risk_ids,
    knownSourceIds: sourceIds,
    knownTaskIds: canonicalTrace.task_ids,
    label: "reference-standard.yaml: reference",
    errors,
  });
  verifyNonEmptyArray(standard?.limitations, "reference-standard.yaml: limitations", errors);

  verifyObjectEntities(annotation?.label_schema, ["id", "definition", "values", "evidence_required"], "annotation-protocol.yaml: label_schema", errors);
  verifyTemplateAnnotation(annotation, "annotation-protocol.yaml", errors);
  for (const field of ["instructions", "annotators", "blind_independent_passes", "disagreement", "arbitration", "quality_control", "privacy_handling", "outputs"]) {
    verifyNonEmptyObject(annotation?.[field], `annotation-protocol.yaml: ${field}`, errors);
  }
  if (typeof annotation?.blind_independent_passes?.required_annotators !== "number" || annotation.blind_independent_passes.required_annotators < 2) errors.push("annotation-protocol.yaml: blind_independent_passes.required_annotators must be at least 2");
  if (annotation?.disagreement?.preserve_raw_labels !== true) errors.push("annotation-protocol.yaml: disagreement.preserve_raw_labels must be true");
  verifyNonEmptyArray(annotation?.arbitration?.required_for, "annotation-protocol.yaml: arbitration.required_for", errors);
  verifyMatchingIdSet(annotation?.traceability?.reference_item_ids, referenceIds, "annotation-protocol.yaml: traceability.reference_item_ids", errors);

  if (verifyNonEmptyObject(split?.grouping_keys, "split-manifest.yaml: grouping_keys", errors)) {
    for (const field of ["parent", "entity", "document", "template", "time"]) {
      verifyNonEmptyString(split.grouping_keys[field], `split-manifest.yaml: grouping_keys.${field}`, errors);
    }
  }
  verifyTemplateSplit(split, "split-manifest.yaml", errors);
  verifyObjectEntities(split?.leakage_controls, ["id", "boundary", "key", "rule", "check", "failure_action"], "split-manifest.yaml: leakage_controls", errors);
  const boundaries = new Set(asArray(split?.leakage_controls).map((item) => item?.boundary));
  for (const field of ["parent", "entity", "document", "template", "time"]) if (!boundaries.has(field)) errors.push(`split-manifest.yaml: leakage_controls must cover ${field}`);
  const splitIds = verifyObjectEntities(split?.splits, ["id", "purpose", "partition_roles", "source_ids", "time_window", "assignment_rule", "protected", "allowed_use"], "split-manifest.yaml: splits", errors);
  for (const [index, item] of asArray(split?.splits).entries()) {
    const label = `split-manifest.yaml: splits[${index}]`;
    for (const role of verifyNonEmptyStringArray(item?.partition_roles, `${label}.partition_roles`, errors)) if (!DATA_ROLES.has(role)) errors.push(`${label}.partition_roles: unknown role ${role}`);
    verifyReferencesKnown(verifyStringIdList(item?.source_ids, `${label}.source_ids`, errors), new Set(sourceIds), `${label}.source_ids`, errors);
    if (typeof item?.protected !== "boolean") errors.push(`${label}.protected: must be a boolean`);
    verifyNonEmptyArray(item?.allowed_use, `${label}.allowed_use`, errors);
    const serialized = JSON.stringify(item.allowed_use).toLowerCase();
    if (item.protected === true && /(train|training|authoring|development)/.test(serialized)) errors.push(`${label}.allowed_use: protected split must not be exposed to training or development`);
  }

  if (verifyNonEmptyObject(dataset?.dataset_identity, "dataset-manifest.yaml: dataset_identity", errors)) {
    for (const field of ["immutable_id", "created_at", "content_hash", "schema_hash", "status"]) verifyNonEmptyString(dataset.dataset_identity[field], `dataset-manifest.yaml: dataset_identity.${field}`, errors);
    verifyEqualReference(dataset.dataset_identity.immutable_id, dataset?.metadata?.id, "dataset-manifest.yaml: dataset_identity.immutable_id", errors);
  }
  verifyObjectEntities(dataset?.contents, ["id", "path", "media_type", "hash", "record_role"], "dataset-manifest.yaml: contents", errors);
  verifyTemplateDataset(dataset, "dataset-manifest.yaml", errors);
  verifyNonEmptyObject(dataset?.item_schema, "dataset-manifest.yaml: item_schema", errors);
  verifyNonEmptyArray(dataset?.joins, "dataset-manifest.yaml: joins", errors);
  verifyAccessViews(dataset?.views, "dataset-manifest.yaml: views", errors);
  verifyRequiredEntryFields(dataset?.partition_summary, ["partition_id", "role", "count", "denominator", "reporting"], "dataset-manifest.yaml: partition_summary", errors);
  verifyMatchingIdSet(asArray(dataset?.partition_summary).map((item) => item?.partition_id), partitionIds, "dataset-manifest.yaml: partition_summary.partition_id", errors);
  verifyNonEmptyObject(dataset?.provenance_summary, "dataset-manifest.yaml: provenance_summary", errors);
  if (verifyNonEmptyObject(dataset?.versioning, "dataset-manifest.yaml: versioning", errors) && dataset.versioning.immutable !== true) errors.push("dataset-manifest.yaml: versioning.immutable must be true");
  verifyNonEmptyObject(dataset?.drift_and_refresh, "dataset-manifest.yaml: drift_and_refresh", errors);
  for (const field of ["monitors", "triggers"]) verifyNonEmptyArray(dataset?.drift_and_refresh?.[field], `dataset-manifest.yaml: drift_and_refresh.${field}`, errors);
  for (const field of ["refresh_process", "comparison"]) verifyNonEmptyString(dataset?.drift_and_refresh?.[field], `dataset-manifest.yaml: drift_and_refresh.${field}`, errors);
  for (const [field, expected] of [["partition_ids", partitionIds], ["source_ids", sourceIds], ["reference_item_ids", referenceIds], ["split_ids", splitIds]]) verifyMatchingIdSet(dataset?.traceability?.[field], expected, `dataset-manifest.yaml: traceability.${field}`, errors);
  for (const [relativePath, value, fields] of [
    ["sampling-plan.yaml", sampling, ["question_ids", "risk_ids", "scenario_family_ids", "task_ids"]],
    ["reference-standard.yaml", standard, ["question_ids", "risk_ids", "task_ids"]],
    ["annotation-protocol.yaml", annotation, ["question_ids", "risk_ids", "task_ids"]],
    ["split-manifest.yaml", split, ["risk_ids", "task_ids"]],
    ["dataset-manifest.yaml", dataset, traceFields],
    ["data-quality-gate.yaml", gate, ["question_ids", "risk_ids", "task_ids"]],
  ]) {
    for (const field of fields) verifyMatchingIdSet(value?.traceability?.[field], canonicalTrace[field], `${relativePath}: traceability.${field}`, errors);
  }
  verifyMatchingIdSet(standard?.traceability?.source_ids, sourceIds, "reference-standard.yaml: traceability.source_ids", errors);
  verifyMatchingIdSet(split?.traceability?.partition_ids, partitionIds, "split-manifest.yaml: traceability.partition_ids", errors);
  verifyMatchingIdSet(gate?.traceability?.source_ids, sourceIds, "data-quality-gate.yaml: traceability.source_ids", errors);
  verifyMatchingIdSet(gate?.traceability?.split_ids, splitIds, "data-quality-gate.yaml: traceability.split_ids", errors);

  const templateEvidenceIds = collectNestedIds(Object.fromEntries(templateValues));
  for (const [index, check] of asArray(gate?.checks).entries()) {
    if (typeof check?.critical !== "boolean") errors.push(`data-quality-gate.yaml: checks[${index}].critical must be a boolean`);
    for (const field of ["category", "requirement", "failure_action", "owner"]) verifyNonEmptyString(check?.[field], `data-quality-gate.yaml: checks[${index}].${field}`, errors);
  }
  verifyExactSet(Object.keys(gate?.status_values ?? {}), [...DATA_GATE_STATUSES], "data-quality-gate.yaml: status_values", errors);
  verifyExactSet(Object.keys(gate?.check_status_values ?? {}), [...DATA_CHECK_STATUSES], "data-quality-gate.yaml: check_status_values", errors);
  verifyGate({
    gate,
    checks: gate?.checks,
    quotas,
    gaps: sampling?.sampling_frame?.gaps,
    knownEvidenceIds: templateEvidenceIds,
    label: "data-quality-gate.yaml",
    errors,
  });
}

function collectNestedIds(value, ids = new Set()) {
  if (Array.isArray(value)) {
    for (const entry of value) collectNestedIds(entry, ids);
  } else if (isNonEmptyObject(value)) {
    if (typeof value.id === "string" && value.id.length > 0) ids.add(value.id);
    for (const child of Object.values(value)) collectNestedIds(child, ids);
  }
  return ids;
}

function verifyTaskScenarioDataCase(value, relativePath, errors) {
  if (!value) return;
  verifyNonEmptyObject(value?.input, `${relativePath}: input`, errors);
  const canonicalUpstream = A15_CANONICAL_UPSTREAM[relativePath];
  const definitionMap = {
    dataset_charter_ids: [value?.input?.charter?.id],
    source_ids: asArray(value?.input?.sources).map((item) => item?.id),
    partition_ids: asArray(value?.input?.charter?.partitions).map((item) => item?.id),
    reference_item_ids: asArray(value?.input?.reference?.items).map((item) => item?.id),
    annotation_protocol_ids: [value?.input?.annotation?.protocol_id],
    split_ids: asArray(value?.input?.split?.splits).map((item) => item?.id),
    dataset_version_ids: [value?.input?.dataset_version?.id],
    quality_gate_ids: [value?.input?.quality_gate?.id],
    trace_ids: asArray(value?.expected?.trace_closure).map((item) => item?.id),
  };
  const allKnown = collectNestedIds(value.input);
  for (const id of [
    value?.input?.reference?.standard_id,
    value?.input?.annotation?.protocol_id,
    value?.input?.split?.manifest_id,
    value?.input?.sampling?.frame_id,
  ]) {
    if (typeof id === "string" && id.length > 0) allKnown.add(id);
  }
  for (const field of A15_UPSTREAM_FIELDS) {
    const expectedIds = canonicalUpstream?.[field] ?? [];
    const ids = verifyMatchingIdSet(
      value?.references?.[field],
      expectedIds,
      `${relativePath}: references.${field}`,
      errors,
    );
    verifyMatchingIdSet(
      value?.input?.charter?.upstream_traceability?.[field],
      expectedIds,
      `${relativePath}: input.charter.upstream_traceability.${field}`,
      errors,
    );
    for (const id of ids) allKnown.add(id);
  }
  for (const [field, rawIds] of Object.entries(definitionMap)) {
    const definedIds = rawIds.filter((id) => typeof id === "string" && id.length > 0);
    verifyMatchingIdSet(value?.references?.[field], definedIds, `${relativePath}: references.${field}`, errors);
    for (const id of definedIds) allKnown.add(id);
  }
  for (const field of ["charter", "sampling", "reference", "annotation", "split", "dataset_version", "quality_gate"]) verifyNonEmptyObject(value?.input?.[field], `${relativePath}: input.${field}`, errors);
  verifyCaseCharter(value?.input?.charter, `${relativePath}: input.charter`, errors);
  verifyCaseAnnotation(value?.input?.annotation, `${relativePath}: input.annotation`, errors);
  verifyCaseSplit(value?.input?.split, `${relativePath}: input.split`, errors);
  verifyCaseDataset(value?.input?.dataset_version, `${relativePath}: input.dataset_version`, errors);
  verifyNonEmptyArray(value?.input?.sources, `${relativePath}: input.sources`, errors);
  verifyDataRoles(value?.input?.charter?.partitions, `${relativePath}: input.charter.partitions`, errors);
  for (const [index, source] of asArray(value?.input?.sources).entries()) {
    const label = `${relativePath}: input.sources[${index}]`;
    for (const field of ["provenance", "lineage", "authorization", "privacy", "license_and_retention"]) verifyNonEmptyObject(source?.[field], `${label}.${field}`, errors);
    verifyCaseSourceGovernance(source, label, errors);
  }
  if (verifyNonEmptyObject(value?.input?.sampling?.sampling_frame, `${relativePath}: input.sampling.sampling_frame`, errors)) {
    verifySamplingGaps(
      value.input.sampling.sampling_frame.gaps,
      `${relativePath}: input.sampling.sampling_frame.gaps`,
      errors,
    );
  }
  const quotas = value?.input?.sampling?.allocation?.per_stratum;
  verifyRequiredEntryFields(quotas, ["stratum_id", "target_count", "actual_count", "status", "rationale"], `${relativePath}: input.sampling.allocation.per_stratum`, errors);
  for (const [index, quota] of asArray(quotas).entries()) {
    if (typeof quota?.target_count !== "number") errors.push(`${relativePath}: input.sampling.allocation.per_stratum[${index}].target_count must be a number`);
    if (typeof quota?.actual_count !== "number") errors.push(`${relativePath}: input.sampling.allocation.per_stratum[${index}].actual_count must be a number`);
    if (!["met", "gap", "blocked"].includes(quota?.status)) errors.push(`${relativePath}: input.sampling.allocation.per_stratum[${index}].status must be met, gap or blocked`);
    if (
      quota?.status === "met" &&
      (typeof quota.actual_count !== "number" ||
        typeof quota.target_count !== "number" ||
        quota.actual_count < quota.target_count)
    ) {
      errors.push(`${relativePath}: input.sampling.allocation.per_stratum[${index}].status met requires actual_count at least target_count`);
    }
  }
  verifyReferenceContent({
    items: value?.input?.reference?.items,
    invariants: value?.input?.reference?.invariants,
    knownRiskIds: canonicalUpstream?.risk_ids ?? [],
    knownSourceIds: definitionMap.source_ids,
    knownTaskIds: canonicalUpstream?.task_ids ?? [],
    label: `${relativePath}: input.reference`,
    errors,
  });
  for (const field of ["blind_independent", "disagreement", "arbitration"]) verifyNonEmptyObject(value?.input?.annotation?.[field], `${relativePath}: input.annotation.${field}`, errors);
  if (value?.input?.annotation?.blind_independent?.annotators < 2) errors.push(`${relativePath}: input.annotation.blind_independent.annotators must be at least 2`);
  if (value?.input?.annotation?.disagreement?.preserve_raw !== true) errors.push(`${relativePath}: input.annotation.disagreement.preserve_raw must be true`);
  const boundaries = new Set(asArray(value?.input?.split?.leakage_controls).map((item) => item?.boundary));
  for (const boundary of ["parent", "entity", "document", "template", "time"]) if (!boundaries.has(boundary)) errors.push(`${relativePath}: input.split.leakage_controls must cover ${boundary}`);
  if (value?.input?.dataset_version?.identity?.immutable !== true) errors.push(`${relativePath}: input.dataset_version.identity.immutable must be true`);
  verifyNonEmptyString(value?.input?.dataset_version?.identity?.content_hash, `${relativePath}: input.dataset_version.identity.content_hash`, errors);
  verifyNonEmptyString(value?.input?.dataset_version?.identity?.schema_hash, `${relativePath}: input.dataset_version.identity.schema_hash`, errors);
  verifyAccessViews(value?.input?.dataset_version?.views, `${relativePath}: input.dataset_version.views`, errors);
  verifyExactSet(Object.keys(value?.input?.quality_gate?.status_values ?? {}), [...DATA_GATE_STATUSES], `${relativePath}: input.quality_gate.status_values`, errors);
  const caseChecks = value?.input?.quality_gate?.checks;
  verifyRequiredEntryFields(caseChecks, ["id", "requirement", "evidence", "status"], `${relativePath}: input.quality_gate.checks`, errors);
  const gateExternalEvidenceIds = collectNestedIds({
    charter: value?.input?.charter,
    sources: value?.input?.sources,
    sampling: value?.input?.sampling,
    reference: value?.input?.reference,
    annotation: value?.input?.annotation,
    split: value?.input?.split,
    dataset_version: value?.input?.dataset_version,
  });
  for (const id of [
    value?.input?.reference?.standard_id,
    value?.input?.annotation?.protocol_id,
    value?.input?.split?.manifest_id,
    value?.input?.sampling?.frame_id,
  ]) {
    if (typeof id === "string" && id.length > 0) gateExternalEvidenceIds.add(id);
  }
  const forbiddenGateEvidenceIds = collectNestedIds(value?.input?.quality_gate);
  if (typeof value?.input?.quality_gate?.id === "string") {
    forbiddenGateEvidenceIds.add(value.input.quality_gate.id);
  }
  const materializedEvidenceByCategory = value?.input?.quality_gate?.decision?.status === "ready"
    ? verifyCaseReadyMaterialization(value, relativePath, errors)
    : null;
  verifyGate({
    gate: value?.input?.quality_gate,
    checks: caseChecks,
    quotas,
    gaps: value?.input?.sampling?.sampling_frame?.gaps,
    knownEvidenceIds: gateExternalEvidenceIds,
    forbiddenEvidenceIds: forbiddenGateEvidenceIds,
    materializedEvidenceByCategory,
    label: `${relativePath}: input.quality_gate`,
    errors,
  });

  const traces = value?.expected?.trace_closure;
  verifyObjectEntities(traces, ["id", "links", "action"], `${relativePath}: expected.trace_closure`, errors);
  const traced = new Set();
  for (const [index, trace] of asArray(traces).entries()) {
    const links = verifyStringIdList(trace?.links, `${relativePath}: expected.trace_closure[${index}].links`, errors);
    verifyReferencesKnown(links, allKnown, `${relativePath}: expected.trace_closure[${index}].links`, errors, traced);
  }
  for (const ids of Object.values(value?.references ?? {})) {
    for (const id of asArray(ids)) {
      if (typeof id === "string" && !traced.has(id) && !asArray(value?.references?.trace_ids).includes(id)) errors.push(`${relativePath}: reference ${id} is not covered by expected.trace_closure`);
    }
  }
  verifyMatchingIdSet(value?.evidence?.traceability, definitionMap.trace_ids, `${relativePath}: evidence.traceability`, errors);
  verifyNonEmptyArray(value?.evidence?.design_artifacts, `${relativePath}: evidence.design_artifacts`, errors);
  verifyNonEmptyArray(value?.expected?.next_actions, `${relativePath}: expected.next_actions`, errors);
  verifyNonEmptyArray(value?.evidence?.limitations, `${relativePath}: evidence.limitations`, errors);
}

const SCORER_GATE_STATUSES = new Set(["ready", "partial", "blocked", "invalid"]);
const SCORER_CHECK_STATUSES = new Set(["passed", "partial", "blocked", "failed"]);
const SCORER_IMPLEMENTATION_TYPES = new Set([
  "deterministic", "programmatic", "human", "llm-as-judge", "composite",
]);
const SCORE_RECORD_STATUSES = new Set([
  "scored", "uncertain", "abstained", "unscorable", "inconclusive",
]);

const A16_TEMPLATE_GATE_CHECKS = {
  "check.identity": "reproducibility",
  "check.precedence": "safety",
  "check.reliability": "reliability",
  "check.validity": "validity",
  "check.calibration": "calibration",
  "check.error-profile": "error",
  "check.bias-robustness": "robustness",
  "check.security": "security",
};

const A16_CASE_GATE_CHECKS = {
  "examples/refund-agent/evaluation-case.yaml": {
    "refund.scorer.check.identity": "reproducibility",
    "refund.scorer.check.precedence": "safety",
    "refund.scorer.check.reliability": "reliability",
    "refund.scorer.check.validity": "validity",
    "refund.scorer.check.calibration": "calibration",
    "refund.scorer.check.error-profile": "error",
    "refund.scorer.check.bias-security": "bias-robustness-security",
  },
  "examples/contract-agent/evaluation-case.yaml": {
    "contract.scorer.check.identity": "reproducibility",
    "contract.scorer.check.precedence": "safety",
    "contract.scorer.check.reliability": "reliability",
    "contract.scorer.check.validity": "validity",
    "contract.scorer.check.calibration": "calibration",
    "contract.scorer.check.error-profile": "error",
    "contract.scorer.check.bias-security": "bias-robustness-security",
  },
  "examples/knowledge-assistant/evaluation-case.yaml": {
    "knowledge.scorer.check.identity": "reproducibility",
    "knowledge.scorer.check.precedence": "safety",
    "knowledge.scorer.check.reliability": "reliability",
    "knowledge.scorer.check.validity": "validity",
    "knowledge.scorer.check.calibration": "calibration",
    "knowledge.scorer.check.error-profile": "error",
    "knowledge.scorer.check.bias-security": "bias-robustness-security",
  },
};

function verifyA16EvidenceBoundary(value, label, errors) {
  if (!verifyNonEmptyObject(value, label, errors)) return;
  verifyNonEmptyStringArray(value.establishes, `${label}.establishes`, errors);
  verifyNonEmptyStringArray(value.does_not_establish, `${label}.does_not_establish`, errors);
}

function verifyA16Traceability(value, label, errors) {
  if (!verifyNonEmptyObject(value, label, errors)) return;
  for (const [field, ids] of Object.entries(value)) {
    if (!field.endsWith("_ids")) {
      errors.push(`${label}.${field}: traceability fields must end in _ids`);
      continue;
    }
    verifyStringIdList(ids, `${label}.${field}`, errors);
  }
}

function verifyA16EntityArray(value, fields, label, errors) {
  return verifyObjectEntities(value, fields, label, errors);
}

const A16_EVIDENCE_CATEGORIES = new Set([
  "identity", "precedence", "reliability", "validity", "calibration",
  "error-profile", "bias-robustness-security",
]);

const A16_CHECK_EVIDENCE_CATEGORY = new Map([
  ["reproducibility", "identity"],
  ["identity", "identity"],
  ["safety", "precedence"],
  ["precedence", "precedence"],
  ["reliability", "reliability"],
  ["validity", "validity"],
  ["calibration", "calibration"],
  ["error", "error-profile"],
  ["error-profile", "error-profile"],
  ["robustness", "bias-robustness-security"],
  ["security", "bias-robustness-security"],
  ["bias-robustness", "bias-robustness-security"],
  ["bias-robustness-security", "bias-robustness-security"],
]);

function verifyA16MaterializedRecords(value, label, forbiddenIds, errors) {
  if (!verifyNonEmptyArray(value, label, errors)) return [];
  const records = [];
  for (const [index, record] of value.entries()) {
    const recordLabel = `${label}[${index}]`;
    if (!verifyNonEmptyObject(record, recordLabel, errors)) continue;
    verifyNonEmptyString(record.id, `${recordLabel}.id`, errors);
    verifyNonEmptyString(record.category, `${recordLabel}.category`, errors);
    if (typeof record.category === "string" && !A16_EVIDENCE_CATEGORIES.has(record.category)) {
      errors.push(`${recordLabel}.category must be a supported scorer validation evidence category`);
    }
    verifyA16StrictSha256(record.hash, `${recordLabel}.hash`, errors);
    if (record.status !== "materialized") errors.push(`${recordLabel}.status must be materialized`);
    if (typeof record.id === "string" && record.id.length > 0) {
      records.push({id: record.id, category: record.category});
      if (forbiddenIds?.has(record.id)) errors.push(`${recordLabel}.id must not reuse a scorer design, validation report or gate id`);
    }
  }
  return records;
}

function verifyA16DisjointScorerIdentities({ manifestId, immutableId, implementationIds, label, errors }) {
  const identities = [manifestId, immutableId, ...implementationIds].filter((id) => typeof id === "string" && id.length > 0);
  for (const duplicate of new Set(identities.filter((id, index) => identities.indexOf(id) !== index))) {
    errors.push(`${label}: scorer manifest, immutable identity and implementation ids must be pairwise disjoint; duplicate ${duplicate}`);
  }
}

function verifyA16StructuredIdentity(value, label, errors) {
  if (!isMaterializedString(value) || /not-implemented|not-observed/i.test(value)) {
    errors.push(`${label}: must identify a materialized non-sentinel value`);
    return;
  }
  if (!/^[A-Za-z][A-Za-z0-9._-]+$/.test(value)) errors.push(`${label}: must be a structured identity`);
}

function verifyA16StrictSha256(value, label, errors) {
  if (!isMaterializedString(value) || /not-implemented|not-observed/i.test(value)) {
    errors.push(`${label}: must identify a materialized non-sentinel value`);
    return;
  }
  if (!/^sha256:[a-f0-9]{64}$/i.test(value)) errors.push(`${label}: must be sha256 followed by exactly 64 hexadecimal characters`);
}

function verifyA16ReadyScorerIdentity(identity, label, errors) {
  for (const field of ["immutable_id", "runtime_identity", "input_schema_version", "output_schema_version"]) {
    verifyA16StructuredIdentity(identity?.[field], `${label}.${field}`, errors);
  }
  for (const field of ["implementation_hash", "config_hash"]) verifyA16StrictSha256(identity?.[field], `${label}.${field}`, errors);
}

function verifyA16ExecutedAt(value, label, errors) {
  const match = typeof value === "string" ? value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-](\d{2}):(\d{2}))$/,
  ) : null;
  if (!match) {
    errors.push(`${label}: must be a valid non-future ISO timestamp`);
    return;
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , zone, offsetHourText, offsetMinuteText] = match;
  const [year, month, day, hour, minute, second] = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number);
  const daysInMonth = month >= 1 && month <= 12 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 0;
  const offsetHour = Number(offsetHourText);
  const offsetMinute = Number(offsetMinuteText);
  const offsetValid = zone === "Z" || (offsetHour < 14 && offsetMinute <= 59) || (offsetHour === 14 && offsetMinute === 0);
  const timestamp = Date.parse(value);
  if (
    !Number.isFinite(timestamp) || month < 1 || month > 12 || day < 1 || day > daysInMonth ||
    hour > 23 || minute > 59 || second > 59 || !offsetValid || timestamp > Date.now()
  ) {
    errors.push(`${label}: must be a valid non-future ISO timestamp`);
  }
}

function verifyA16AcceptedResult(value, label, errors) {
  if (!verifyNonEmptyObject(value, label, errors)) return;
  if (!new Set(["accepted", "passed"]).has(value.status)) {
    errors.push(`${label}.status must be accepted or passed`);
  }
  verifyNonEmptyString(value.evidence_id, `${label}.evidence_id`, errors);
  verifyNonEmptyString(value.metric, `${label}.metric`, errors);
  if (typeof value.observed_value !== "number" || !Number.isFinite(value.observed_value)) {
    errors.push(`${label}.observed_value must be a finite number`);
  }
}

function verifyA16Threshold(result, threshold, label, errors) {
  if (!verifyNonEmptyObject(threshold, `${label}.threshold`, errors)) return;
  verifyNonEmptyString(threshold.metric, `${label}.threshold.metric`, errors);
  if (typeof result?.metric === "string" && result.metric !== threshold.metric) {
    errors.push(`${label}.metric must match the predeclared threshold metric`);
  }
  if (!new Set(["gte", "lte", "equals"]).has(threshold.operator)) {
    errors.push(`${label}.threshold.operator must be gte, lte or equals`);
  }
  if (typeof threshold.value !== "number" || !Number.isFinite(threshold.value)) {
    errors.push(`${label}.threshold.value must be a finite number`);
    return;
  }
  const observed = result?.observed_value;
  if (typeof observed !== "number" || !Number.isFinite(observed)) return;
  const passed = threshold.operator === "gte" ? observed >= threshold.value :
    threshold.operator === "lte" ? observed <= threshold.value : observed === threshold.value;
  if (!passed) errors.push(`${label}.observed_value does not satisfy the predeclared threshold`);
}

function verifyA16ThresholdDeclarations(acceptance, label, errors) {
  if (!verifyNonEmptyObject(acceptance, label, errors)) return;
  if (acceptance.thresholds_declared_before_execution !== true) errors.push(`${label}.thresholds_declared_before_execution must be true`);
  verifyNonEmptyStringArray(acceptance.required_results, `${label}.required_results`, errors);
  const declaredThresholds = acceptance.thresholds;
  verifyExactSet(Object.keys(declaredThresholds ?? {}), ["reliability", "validity", "calibration", "bias_and_robustness", "security"], `${label}.thresholds`, errors);
  for (const [name, threshold] of Object.entries(declaredThresholds ?? {})) {
    verifyNonEmptyString(threshold?.metric, `${label}.thresholds.${name}.metric`, errors);
    if (!new Set(["gte", "lte", "equals"]).has(threshold?.operator)) errors.push(`${label}.thresholds.${name}.operator must be gte, lte or equals`);
    if (typeof threshold?.value !== "number" || !Number.isFinite(threshold.value)) errors.push(`${label}.thresholds.${name}.value must be a finite number`);
  }
  const errorThresholds = acceptance.error_thresholds;
  verifyExactSet(Object.keys(errorThresholds ?? {}), ["false_pass", "false_fail", "abstain_error", "unscorable_detection_error"], `${label}.error_thresholds`, errors);
  for (const [name, threshold] of Object.entries(errorThresholds ?? {})) {
    if (typeof threshold?.max_count !== "number" || !Number.isFinite(threshold.max_count) || threshold.max_count < 0) errors.push(`${label}.error_thresholds.${name}.max_count must be a non-negative number`);
  }
}

function verifyA16ExecutedValidation(validation, manifest, label, forbiddenEvidenceIds, errors) {
  const independent = validation?.evidence?.independent_from_scorer_development ??
    validation?.evidence?.independent_from_development;
  if (independent !== true) errors.push(`${label}: validation evidence must be independently produced`);
  if (validation?.evidence?.materialized !== true) errors.push(`${label}: validation evidence.materialized must be true`);
  if (validation?.acceptance?.thresholds_declared_before_execution !== true) {
    errors.push(`${label}: validation thresholds must be declared before execution`);
  }
  const sampleRecords = verifyA16MaterializedRecords(validation?.evidence?.sample_records, `${label}: validation.evidence.sample_records`, forbiddenEvidenceIds, errors);
  const evidenceRecords = verifyA16MaterializedRecords(validation?.evidence?.evidence_links, `${label}: validation.evidence.evidence_links`, forbiddenEvidenceIds, errors);
  const allRecords = [...sampleRecords, ...evidenceRecords];
  const allRecordIds = allRecords.map((record) => record.id);
  for (const duplicate of new Set(allRecordIds.filter((id, index) => allRecordIds.indexOf(id) !== index))) {
    errors.push(`${label}: validation evidence record ids must be unique across sample_records and evidence_links; duplicate ${duplicate}`);
  }
  const independentEvidenceIds = new Set(allRecords.map((record) => record.id));
  const evidenceIdsByCategory = new Map();
  for (const record of allRecords) {
    if (!evidenceIdsByCategory.has(record.category)) evidenceIdsByCategory.set(record.category, new Set());
    evidenceIdsByCategory.get(record.category).add(record.id);
  }

  const validationStatus = validation?.validation_identity?.status ?? validation?.status;
  if (!new Set(["executed", "validated", "accepted"]).has(validationStatus)) {
    errors.push(`${label}: validation identity status must be executed, validated or accepted`);
  }
  const reportId = validation?.metadata?.id ?? validation?.id;
  verifyEqualReference(
    validation?.validation_identity?.report_id,
    reportId,
    `${label}: validation.validation_identity.report_id`,
    errors,
  );
  verifyEqualReference(
    validation?.validation_identity?.scorer_immutable_id,
    manifest?.scorer_identity?.immutable_id,
    `${label}: validation.validation_identity.scorer_immutable_id`,
    errors,
  );
  verifyA16StructuredIdentity(
    validation?.validation_identity?.dataset_version,
    `${label}: validation.validation_identity.dataset_version`,
    errors,
  );
  verifyA16ExecutedAt(validation?.validation_identity?.executed_at, `${label}: validation.validation_identity.executed_at`, errors);
  return {independentEvidenceIds, evidenceIdsByCategory};
}

function verifyA16ReadyValidation(validation, manifest, label, forbiddenEvidenceIds, errors, executedValidation = null) {
  const {independentEvidenceIds, evidenceIdsByCategory} = executedValidation ??
    verifyA16ExecutedValidation(validation, manifest, label, forbiddenEvidenceIds, errors);
  const results = {
    reliability: validation?.dimensions?.reliability?.result,
    validity: validation?.dimensions?.validity?.result,
    calibration: validation?.dimensions?.calibration?.result,
    bias_and_robustness: validation?.bias_and_robustness?.results,
    security: validation?.security?.results,
  };
  const declaredThresholds = validation?.acceptance?.thresholds;
  verifyExactSet(Object.keys(declaredThresholds ?? {}), Object.keys(results), `${label}: validation.acceptance.thresholds`, errors);
  for (const [name, result] of Object.entries(results)) {
    const resultLabel = name === "bias_and_robustness" ?
      `${label}: validation.bias_and_robustness.results` :
      name === "security" ? `${label}: validation.security.results` :
        `${label}: validation.dimensions.${name}.result`;
    verifyA16AcceptedResult(result, resultLabel, errors);
    if (typeof result?.evidence_id === "string" && !independentEvidenceIds.has(result.evidence_id)) {
      errors.push(`${resultLabel}.evidence_id must resolve to independent materialized validation evidence`);
    }
    const expectedEvidenceCategory = new Set(["bias_and_robustness", "security"]).has(name) ?
      "bias-robustness-security" : name;
    if (
      typeof result?.evidence_id === "string" &&
      independentEvidenceIds.has(result.evidence_id) &&
      !evidenceIdsByCategory.get(expectedEvidenceCategory)?.has(result.evidence_id)
    ) {
      errors.push(`${resultLabel}.evidence_id must resolve to ${expectedEvidenceCategory} validation evidence`);
    }
    if (forbiddenEvidenceIds?.has(result?.evidence_id)) errors.push(`${resultLabel}.evidence_id must not reuse a scorer design, validation report or gate id`);
    if (
      typeof result?.observed_value === "number" &&
      (result.observed_value < 0 || (name !== "security" && result.observed_value > 1))
    ) {
      errors.push(`${resultLabel}.observed_value must be within its declared bounded domain`);
    }
    verifyA16Threshold(result, declaredThresholds?.[name], resultLabel, errors);
  }

  const thresholds = validation?.acceptance?.error_thresholds;
  if (!verifyNonEmptyObject(thresholds, `${label}: validation.acceptance.error_thresholds`, errors)) return;
  for (const name of ["false_pass", "false_fail", "abstain_error", "unscorable_detection_error"]) {
    const threshold = thresholds[name];
    const thresholdLabel = `${label}: validation.acceptance.error_thresholds.${name}`;
    if (!verifyNonEmptyObject(threshold, thresholdLabel, errors)) continue;
    if (typeof threshold.max_count !== "number" || !Number.isFinite(threshold.max_count) || threshold.max_count < 0) {
      errors.push(`${thresholdLabel}.max_count must be a non-negative number`);
    }
    const observed = validation?.error_profile?.[name]?.observed_count;
    if (typeof observed !== "number" || !Number.isFinite(observed) || observed < 0) {
      errors.push(`${label}: validation.error_profile.${name}.observed_count must be a non-negative number`);
    } else if (typeof threshold.max_count === "number" && observed > threshold.max_count) {
      errors.push(`${label}: validation.error_profile.${name}.observed_count exceeds predeclared max_count`);
    }
  }
}

function verifyA16PartialScope(value, label, executedValidation, expectedCategories, errors) {
  if (!verifyNonEmptyObject(value, label, errors)) return;
  verifyA16StructuredIdentity(value.id, `${label}.id`, errors);
  verifyNonEmptyStringArray(value.allowed_uses, `${label}.allowed_uses`, errors);
  verifyNonEmptyStringArray(value.prohibited_uses, `${label}.prohibited_uses`, errors);
  const evidenceIds = verifyStringIdList(value.evidence_ids, `${label}.evidence_ids`, errors);
  const actualCategories = new Set();
  for (const id of evidenceIds) {
    if (!executedValidation.independentEvidenceIds.has(id)) {
      errors.push(`${label}.evidence_ids: unknown independent materialized validation evidence id ${id}`);
      continue;
    }
    const category = [...executedValidation.evidenceIdsByCategory.entries()]
      .find(([, ids]) => ids.has(id))?.[0];
    if (!expectedCategories.has(category)) {
      errors.push(`${label}.evidence_ids: unrelated evidence category ${category ?? "unknown"} for partial checks`);
    } else {
      actualCategories.add(category);
    }
  }
  verifyExactSet([...actualCategories], [...expectedCategories], `${label}.evidence_categories`, errors);
}

function verifyA16GateCheckTaxonomy(checks, expectedChecks, label, errors) {
  const expected = expectedChecks ?? {};
  const expectedIds = Object.keys(expected);
  const expectedCategories = Object.values(expected);
  const actualChecks = asArray(checks);
  verifyMatchingIdSet(actualChecks.map((check) => check?.id), expectedIds, `${label}.checks.id`, errors);
  verifyExactSet(actualChecks.map((check) => check?.category), expectedCategories, `${label}.checks.category`, errors);
  for (const [index, check] of actualChecks.entries()) {
    const checkLabel = `${label}.checks[${index}]`;
    const expectedCategory = expected[check?.id];
    if (expectedCategory && check?.category !== expectedCategory) {
      errors.push(`${checkLabel}.category: check ${check.id} must use ${expectedCategory}`);
    }
    if (check?.critical !== true) errors.push(`${checkLabel}.critical must be true`);
  }
}

function verifyA16Gate({ gate, validation, manifest, expectedChecks, knownEvidenceIds = null, forbiddenEvidenceIds = new Set(), label, errors }) {
  verifyExactSet(Object.keys(gate?.status_values ?? {}), [...SCORER_GATE_STATUSES], `${label}.status_values`, errors);
  const checks = gate?.checks;
  const checkIds = verifyA16EntityArray(
    checks,
    ["id", "category", "requirement", "evidence", "status", "failure_action"],
    `${label}.checks`,
    errors,
  );
  verifyA16GateCheckTaxonomy(checks, expectedChecks, label, errors);
  const forbidden = new Set(forbiddenEvidenceIds);
  for (const id of collectNestedIds({manifest, gate: {...gate, checks: undefined}, validation: {...validation, evidence: undefined, dimensions: undefined, error_profile: undefined, bias_and_robustness: undefined, security: undefined}})) forbidden.add(id);
  for (const id of [
    manifest?.metadata?.id, manifest?.id, manifest?.scorer_identity?.immutable_id,
    gate?.metadata?.id, gate?.id, validation?.metadata?.id, validation?.id,
    validation?.validation_identity?.report_id, validation?.validation_identity?.scorer_immutable_id,
    ...checkIds,
  ]) if (typeof id === "string" && id.length > 0) forbidden.add(id);
  for (const field of ["scorer_charter_id", "scoring_unit_spec_id", "observation_contract_id", "rubric_id", "adjudication_protocol_id"]) {
    if (typeof manifest?.[field] === "string") forbidden.add(manifest[field]);
  }
  for (const field of ["scorer_manifest_id", "rubric_id", "adjudication_protocol_id"]) if (typeof validation?.[field] === "string") forbidden.add(validation[field]);
  for (const field of ["scorer_manifest_id", "validation_report_id"]) if (typeof gate?.[field] === "string") forbidden.add(gate[field]);
  const decisionStatus = gate?.decision?.status;
  const executedValidation = new Set(["partial", "ready"]).has(decisionStatus) ?
    verifyA16ExecutedValidation(validation, manifest, label, forbidden, errors) : null;
  const blocked = [];
  const partial = [];
  const failed = [];
  for (const [index, check] of asArray(checks).entries()) {
    const checkLabel = `${label}.checks[${index}]`;
    if (typeof check?.critical !== "boolean") errors.push(`${checkLabel}.critical: must be a boolean`);
    if (!SCORER_CHECK_STATUSES.has(check?.status)) errors.push(`${checkLabel}.status: must be passed, partial, blocked or failed`);
    if (check?.status === "blocked") blocked.push(check?.id);
    if (check?.status === "partial") partial.push(check?.id);
    if (check?.status === "failed") failed.push(check?.id);
    if (verifyNonEmptyObject(check?.evidence, `${checkLabel}.evidence`, errors)) {
      if (typeof check.evidence.materialized !== "boolean") errors.push(`${checkLabel}.evidence.materialized: must be a boolean`);
      if (typeof check.evidence.planned_only !== "boolean") errors.push(`${checkLabel}.evidence.planned_only: must be a boolean`);
      verifyNonEmptyString(check.evidence.semantic_basis, `${checkLabel}.evidence.semantic_basis`, errors);
      const links = verifyStringIdList(check.evidence.evidence_links, `${checkLabel}.evidence.evidence_links`, errors);
      if (knownEvidenceIds) verifyReferencesKnown(links, knownEvidenceIds, `${checkLabel}.evidence.evidence_links`, errors);
      for (const link of links) {
        if (link === check?.id || checkIds.includes(link) || link === gate?.metadata?.id) {
          errors.push(`${checkLabel}.evidence.evidence_links: gate cannot use self evidence id ${link}`);
        }
        if (check?.evidence?.materialized === true && forbidden.has(link)) errors.push(`${checkLabel}.evidence.evidence_links: must not reuse a scorer design, validation report or gate id ${link}`);
      }
      if (new Set(["passed", "partial"]).has(check?.status)) {
        if (check.evidence.materialized !== true || check.evidence.planned_only !== false) {
          errors.push(`${checkLabel}: passed or partial check requires non-planned materialized evidence`);
        }
        if (!links.some((id) => executedValidation?.independentEvidenceIds.has(id))) {
          errors.push(`${checkLabel}.evidence.evidence_links: passed or partial check must resolve to independent materialized validation evidence`);
        }
        const expectedCategory = A16_CHECK_EVIDENCE_CATEGORY.get(check?.category);
        if (!expectedCategory) {
          errors.push(`${checkLabel}.category is not compatible with a scorer validation evidence category`);
        } else if (!links.some((id) => executedValidation?.evidenceIdsByCategory.get(expectedCategory)?.has(id))) {
          errors.push(`${checkLabel}.evidence.evidence_links: requires independent materialized ${expectedCategory} evidence`);
        }
      }
    }
  }
  const decision = gate?.decision;
  if (!verifyNonEmptyObject(decision, `${label}.decision`, errors)) return;
  if (!SCORER_GATE_STATUSES.has(decision.status)) errors.push(`${label}.decision.status: must be ready, partial, blocked or invalid`);
  for (const field of ["blocking_check_ids", "partial_check_ids", "invalidating_check_ids"]) {
    verifyStringIdArray(decision[field], `${label}.decision.${field}`, errors, true);
  }
  verifyNonEmptyString(decision.reason, `${label}.decision.reason`, errors);
  verifyNonEmptyString(decision.allowed_next_step, `${label}.decision.allowed_next_step`, errors);
  verifyNonEmptyStringArray(decision.prohibited_claims, `${label}.decision.prohibited_claims`, errors);

  verifyExactSet(decision.blocking_check_ids ?? [], blocked, `${label}.decision.blocking_check_ids`, errors);
  verifyExactSet(decision.partial_check_ids ?? [], partial, `${label}.decision.partial_check_ids`, errors);
  verifyExactSet(decision.invalidating_check_ids ?? [], failed, `${label}.decision.invalidating_check_ids`, errors);

  if (decision.status === "blocked") {
    if (blocked.length === 0) errors.push(`${label}.decision.status blocked requires a blocked check`);
  }
  if (decision.status === "partial") {
    if (partial.length === 0) errors.push(`${label}.decision.status partial requires a partial check`);
    if (blocked.length > 0 || failed.length > 0) errors.push(`${label}.decision.status partial cannot retain blocked or failed checks`);
    const partialChecks = asArray(checks).filter((check) => check?.status === "partial");
    if (partialChecks.some((check) => check?.evidence?.materialized !== true || check?.evidence?.planned_only !== false)) {
      errors.push(`${label}.decision.status partial requires non-planned materialized evidence for every partial check`);
    }
    if (!new Set(["implemented", "validated"]).has(manifest?.scorer_identity?.status)) {
      errors.push(`${label}.decision.status partial requires implemented or validated scorer identity`);
    }
    verifyA16ReadyScorerIdentity(manifest?.scorer_identity, `${label}: scorer_identity`, errors);
    if (validation?.acceptance?.current_conclusion !== "partial") {
      errors.push(`${label}.decision.status partial requires validation acceptance.current_conclusion partial`);
    }
    verifyA16PartialScope(
      decision.partial_scope,
      `${label}.decision.partial_scope`,
      executedValidation ?? {independentEvidenceIds: new Set(), evidenceIdsByCategory: new Map()},
      new Set(partialChecks.map((check) => A16_CHECK_EVIDENCE_CATEGORY.get(check?.category)).filter(Boolean)),
      errors,
    );
  }
  if (decision.status === "invalid") {
    if (failed.length === 0) errors.push(`${label}.decision.status invalid requires a failed check`);
  }
  if (decision.status !== "ready") return;

  if (asArray(checks).some((check) => check?.critical && check?.status !== "passed")) {
    errors.push(`${label}.decision.status ready requires every critical check passed`);
  }
  if (asArray(checks).some((check) => check?.evidence?.materialized !== true || check?.evidence?.planned_only !== false)) {
    errors.push(`${label}.decision.status ready requires non-planned materialized evidence for every check`);
  }
  if (manifest?.scorer_identity?.status === "design-only") errors.push(`${label}.decision.status ready cannot use design-only scorer identity`);
  verifyA16ReadyScorerIdentity(manifest?.scorer_identity, `${label}: scorer_identity`, errors);
  if (validation?.evidence?.materialized !== true) errors.push(`${label}.decision.status ready requires validation evidence.materialized true`);
  verifyA16ReadyValidation(validation, manifest, label, forbidden, errors, executedValidation);
  if (validation?.acceptance?.current_conclusion !== "ready") errors.push(`${label}.decision.status ready requires validation acceptance.current_conclusion ready`);
}

function verifyReferenceToScorerTemplates(templateValues, errors) {
  const charter = templateValues.get("scorer-charter.yaml");
  const unit = templateValues.get("scoring-unit-spec.yaml");
  const observation = templateValues.get("observation-contract.yaml");
  const rubric = templateValues.get("scoring-rubric.yaml");
  const adjudication = templateValues.get("adjudication-protocol.yaml");
  const manifest = templateValues.get("scorer-manifest.yaml");
  const validation = templateValues.get("scorer-validation-report.yaml");
  const gate = templateValues.get("scorer-quality-gate.yaml");
  for (const [name, value] of templateValues) {
    verifyNonEmptyString(value?.metadata?.version, `${name}: metadata.version`, errors);
    if (value?.traceability !== undefined) verifyA16Traceability(value.traceability, `${name}: traceability`, errors);
    if (value?.evidence_boundary !== undefined) verifyA16EvidenceBoundary(value.evidence_boundary, `${name}: evidence_boundary`, errors);
  }
  for (const [name, value, field, expected] of [
    ["scoring-unit-spec.yaml", unit, "scorer_charter_id", charter?.metadata?.id],
    ["observation-contract.yaml", observation, "scoring_unit_spec_id", unit?.metadata?.id],
    ["scoring-rubric.yaml", rubric, "scorer_charter_id", charter?.metadata?.id],
    ["scoring-rubric.yaml", rubric, "scoring_unit_spec_id", unit?.metadata?.id],
    ["scoring-rubric.yaml", rubric, "observation_contract_id", observation?.metadata?.id],
    ["adjudication-protocol.yaml", adjudication, "rubric_id", rubric?.metadata?.id],
    ["scorer-manifest.yaml", manifest, "scorer_charter_id", charter?.metadata?.id],
    ["scorer-manifest.yaml", manifest, "scoring_unit_spec_id", unit?.metadata?.id],
    ["scorer-manifest.yaml", manifest, "observation_contract_id", observation?.metadata?.id],
    ["scorer-manifest.yaml", manifest, "rubric_id", rubric?.metadata?.id],
    ["scorer-manifest.yaml", manifest, "adjudication_protocol_id", adjudication?.metadata?.id],
    ["scorer-validation-report.yaml", validation, "scorer_manifest_id", manifest?.metadata?.id],
    ["scorer-validation-report.yaml", validation, "rubric_id", rubric?.metadata?.id],
    ["scorer-validation-report.yaml", validation, "adjudication_protocol_id", adjudication?.metadata?.id],
    ["scorer-quality-gate.yaml", gate, "scorer_manifest_id", manifest?.metadata?.id],
    ["scorer-quality-gate.yaml", gate, "validation_report_id", validation?.metadata?.id],
  ]) verifyEqualReference(value?.[field], expected, `${name}: ${field}`, errors);

  verifyEqualReference(
    validation?.validation_identity?.report_id,
    validation?.metadata?.id,
    "scorer-validation-report.yaml: validation_identity.report_id",
    errors,
  );
  verifyEqualReference(
    validation?.validation_identity?.scorer_immutable_id,
    manifest?.scorer_identity?.immutable_id,
    "scorer-validation-report.yaml: validation_identity.scorer_immutable_id",
    errors,
  );
  verifyA16StructuredIdentity(
    validation?.validation_identity?.dataset_version,
    "scorer-validation-report.yaml: validation_identity.dataset_version",
    errors,
  );
  verifyEqualReference(
    validation?.validation_identity?.dataset_version,
    "independent-calibration-set.example.v1",
    "scorer-validation-report.yaml: validation_identity.dataset_version",
    errors,
  );

  if (charter?.non_compensation?.critical_failures_override !== true) errors.push("scorer-charter.yaml: non_compensation.critical_failures_override must be true");
  verifyNonEmptyStringArray(charter?.authority_order, "scorer-charter.yaml: authority_order", errors);
  for (const field of ["unit", "construct_interpretation", "output_scope"]) verifyNonEmptyString(charter?.scoring_claim?.[field], `scorer-charter.yaml: scoring_claim.${field}`, errors);
  verifyExactSet(charter?.scoring_claim?.allowed_statuses ?? [], [...SCORE_RECORD_STATUSES], "scorer-charter.yaml: scoring_claim.allowed_statuses", errors);

  const unitIds = verifyA16EntityArray(unit?.units, ["id", "level", "identity_keys", "parent_key", "aggregation_boundary"], "scoring-unit-spec.yaml: units", errors);
  verifyExactSet(asArray(unit?.units).map((entry) => entry?.level), ["trial", "atomic-claim", "tool-call", "state-transition", "turn", "trajectory"], "scoring-unit-spec.yaml: units.level", errors);
  for (const [index, entry] of asArray(unit?.units).entries()) {
    verifyNonEmptyStringArray(entry?.identity_keys, `scoring-unit-spec.yaml: units[${index}].identity_keys`, errors);
    verifyStringIdArray(entry?.child_units, `scoring-unit-spec.yaml: units[${index}].child_units`, errors, true);
    verifyReferencesKnown(asArray(entry?.child_units), new Set(unitIds), `scoring-unit-spec.yaml: units[${index}].child_units`, errors);
  }
  if (unit?.missing_or_duplicate_identity !== "unscorable") errors.push("scoring-unit-spec.yaml: missing_or_duplicate_identity must be unscorable");

  for (const field of ["identity", "initial_state", "event_stream", "final_output", "final_state", "evidence_metadata"]) {
    if (verifyNonEmptyObject(observation?.bundle?.[field], `observation-contract.yaml: bundle.${field}`, errors)) verifyNonEmptyStringArray(observation.bundle[field].required, `observation-contract.yaml: bundle.${field}.required`, errors);
  }
  if (observation?.completeness?.critical_missing_action !== "unscorable") errors.push("observation-contract.yaml: completeness.critical_missing_action must be unscorable");
  for (const field of ["immutable_after_capture", "hashes_required", "clock_and_ordering_recorded", "candidate_cannot_write_reference_fields"]) if (observation?.integrity?.[field] !== true) errors.push(`observation-contract.yaml: integrity.${field} must be true`);

  if (rubric?.rubric_type !== "analytic") errors.push("scoring-rubric.yaml: rubric_type must be analytic");
  const dimensions = rubric?.dimensions;
  const dimensionIds = verifyA16EntityArray(dimensions, ["id", "construct_id", "scoring_unit_ids", "definition", "scale", "anchors", "boundary_examples"], "scoring-rubric.yaml: dimensions", errors);
  for (const [index, dimension] of asArray(dimensions).entries()) {
    verifyStringIdList(dimension?.scoring_unit_ids, `scoring-rubric.yaml: dimensions[${index}].scoring_unit_ids`, errors);
    verifyReferencesKnown(asArray(dimension?.scoring_unit_ids), new Set(unitIds), `scoring-rubric.yaml: dimensions[${index}].scoring_unit_ids`, errors);
    if (verifyNonEmptyObject(dimension?.scale, `scoring-rubric.yaml: dimensions[${index}].scale`, errors)) verifyNonEmptyArray(dimension.scale.values, `scoring-rubric.yaml: dimensions[${index}].scale.values`, errors);
    verifyNonEmptyArray(dimension?.anchors, `scoring-rubric.yaml: dimensions[${index}].anchors`, errors);
    for (const [anchorIndex, anchor] of asArray(dimension?.anchors).entries()) {
      if (typeof anchor?.score !== "number") errors.push(`scoring-rubric.yaml: dimensions[${index}].anchors[${anchorIndex}].score must be a number`);
      verifyNonEmptyStringArray(anchor?.observable_conditions, `scoring-rubric.yaml: dimensions[${index}].anchors[${anchorIndex}].observable_conditions`, errors);
      verifyNonEmptyStringArray(anchor?.required_evidence, `scoring-rubric.yaml: dimensions[${index}].anchors[${anchorIndex}].required_evidence`, errors);
    }
  }
  for (const [index, critical] of asArray(rubric?.critical_errors).entries()) {
    verifyNonEmptyString(critical?.id, `scoring-rubric.yaml: critical_errors[${index}].id`, errors);
    verifyNonEmptyStringArray(critical?.risk_ids, `scoring-rubric.yaml: critical_errors[${index}].risk_ids`, errors);
    if (critical?.compensable !== false) errors.push(`scoring-rubric.yaml: critical_errors[${index}].compensable must be false`);
    if (critical?.judge_override_allowed !== false) errors.push(`scoring-rubric.yaml: critical_errors[${index}].judge_override_allowed must be false`);
  }
  verifyExactSet(Object.keys(rubric?.uncertainty ?? {}), ["uncertain", "abstain", "inconclusive"], "scoring-rubric.yaml: uncertainty", errors);
  if (rubric?.unscorable?.output?.status !== "unscorable" || rubric?.unscorable?.output?.score !== null) errors.push("scoring-rubric.yaml: unscorable output must use status unscorable and null score");

  if (adjudication?.disagreement?.preserve_raw_decisions !== true) errors.push("adjudication-protocol.yaml: disagreement.preserve_raw_decisions must be true");
  verifyNonEmptyStringArray(adjudication?.disagreement?.categories, "adjudication-protocol.yaml: disagreement.categories", errors);
  verifyNonEmptyArray(adjudication?.workflow, "adjudication-protocol.yaml: workflow", errors);
  if (adjudication?.outcomes?.no_majority_rule !== true || adjudication?.outcomes?.no_forced_resolution !== true) errors.push("adjudication-protocol.yaml: outcomes must prohibit majority and forced resolution");
  verifyNonEmptyString(adjudication?.critical_failure_rule, "adjudication-protocol.yaml: critical_failure_rule", errors);

  const implementationIds = verifyA16EntityArray(manifest?.implementations, ["id", "type", "role", "authority", "status"], "scorer-manifest.yaml: implementations", errors);
  if (verifyNonEmptyObject(manifest?.scorer_identity, "scorer-manifest.yaml: scorer_identity", errors)) {
    for (const field of ["immutable_id", "status", "input_schema_version", "output_schema_version"]) {
      verifyNonEmptyString(manifest.scorer_identity[field], `scorer-manifest.yaml: scorer_identity.${field}`, errors);
    }
    if (!new Set(["design-only", "implemented", "validated"]).has(manifest.scorer_identity.status)) {
      errors.push("scorer-manifest.yaml: scorer_identity.status must be design-only, implemented or validated");
    }
  }
  verifyA16DisjointScorerIdentities({
    manifestId: manifest?.metadata?.id,
    immutableId: manifest?.scorer_identity?.immutable_id,
    implementationIds,
    label: "scorer-manifest.yaml",
    errors,
  });
  verifyExactSet(asArray(manifest?.implementations).map((entry) => entry?.type), [...SCORER_IMPLEMENTATION_TYPES], "scorer-manifest.yaml: implementations.type", errors);
  for (const [index, implementation] of asArray(manifest?.implementations).entries()) {
    for (const field of ["id", "type", "role", "authority", "status"]) verifyNonEmptyString(implementation?.[field], `scorer-manifest.yaml: implementations[${index}].${field}`, errors);
    if (!SCORER_IMPLEMENTATION_TYPES.has(implementation?.type)) errors.push(`scorer-manifest.yaml: implementations[${index}].type is unsupported`);
  }
  verifyMatchingIdSet(manifest?.precedence?.order, implementationIds.filter((id) => !id.endsWith(".composite")), "scorer-manifest.yaml: precedence.order", errors);
  verifyNonEmptyString(manifest?.precedence?.conflict_rule, "scorer-manifest.yaml: precedence.conflict_rule", errors);
  verifyNonEmptyStringArray(manifest?.precedence?.judge_cannot_override, "scorer-manifest.yaml: precedence.judge_cannot_override", errors);
  verifyExactSet(manifest?.output_record?.status_values ?? [], [...SCORE_RECORD_STATUSES], "scorer-manifest.yaml: output_record.status_values", errors);
  verifyNonEmptyStringArray(manifest?.output_record?.required, "scorer-manifest.yaml: output_record.required", errors);
  for (const field of ["reference_fields_read_only", "candidate_output_untrusted", "prompt_injection_treated_as_data", "secrets_prohibited", "logs_redacted"]) if (manifest?.security?.[field] !== true) errors.push(`scorer-manifest.yaml: security.${field} must be true`);
  verifyNonEmptyString(manifest?.security?.network_access, "scorer-manifest.yaml: security.network_access", errors);
  if (verifyNonEmptyObject(manifest?.failure_behavior, "scorer-manifest.yaml: failure_behavior", errors)) {
    for (const field of ["missing_input", "unsupported_scope", "internal_error", "reference_conflict"]) verifyNonEmptyString(manifest.failure_behavior[field], `scorer-manifest.yaml: failure_behavior.${field}`, errors);
  }

  if (typeof validation?.evidence?.materialized !== "boolean") errors.push("scorer-validation-report.yaml: evidence.materialized must be a boolean");
  const recordSchema = validation?.evidence?.record_schema;
  if (verifyNonEmptyObject(recordSchema, "scorer-validation-report.yaml: evidence.record_schema", errors)) {
    verifyExactSet(recordSchema.required ?? [], ["id", "category", "hash", "status"], "scorer-validation-report.yaml: evidence.record_schema.required", errors);
    verifyExactSet(recordSchema.category_values ?? [], [...A16_EVIDENCE_CATEGORIES], "scorer-validation-report.yaml: evidence.record_schema.category_values", errors);
    if (recordSchema.hash_format !== "sha256:<64-hex>") errors.push("scorer-validation-report.yaml: evidence.record_schema.hash_format must be sha256:<64-hex>");
    if (recordSchema.materialized_status !== "materialized") errors.push("scorer-validation-report.yaml: evidence.record_schema.materialized_status must be materialized");
  }
  for (const dimension of ["reliability", "validity", "calibration"]) {
    verifyNonEmptyStringArray(validation?.dimensions?.[dimension]?.methods, `scorer-validation-report.yaml: dimensions.${dimension}.methods`, errors);
    if (isMissing(validation?.dimensions?.[dimension]?.result)) errors.push(`scorer-validation-report.yaml: dimensions.${dimension}.result is required`);
  }
  verifyExactSet(Object.keys(validation?.error_profile ?? {}), ["false_pass", "false_fail", "abstain_error", "unscorable_detection_error"], "scorer-validation-report.yaml: error_profile", errors);
  verifyNonEmptyStringArray(validation?.bias_and_robustness?.bias_slices, "scorer-validation-report.yaml: bias_and_robustness.bias_slices", errors);
  verifyNonEmptyStringArray(validation?.bias_and_robustness?.perturbations, "scorer-validation-report.yaml: bias_and_robustness.perturbations", errors);
  verifyNonEmptyStringArray(validation?.security?.tests, "scorer-validation-report.yaml: security.tests", errors);
  verifyA16ThresholdDeclarations(validation?.acceptance, "scorer-validation-report.yaml: acceptance", errors);

  const templateEvidenceIds = collectNestedIds(Object.fromEntries(templateValues));
  for (const record of [...asArray(validation?.evidence?.sample_records), ...asArray(validation?.evidence?.evidence_links)]) {
    const id = typeof record === "string" ? record : record?.id;
    if (typeof id === "string") templateEvidenceIds.add(id);
  }
  verifyNonEmptyString(gate?.ready_rule, "scorer-quality-gate.yaml: ready_rule", errors);
  const partialScopeSchema = gate?.partial_scope_schema;
  if (verifyNonEmptyObject(partialScopeSchema, "scorer-quality-gate.yaml: partial_scope_schema", errors)) {
    if (partialScopeSchema.required_when !== "decision.status=partial") errors.push("scorer-quality-gate.yaml: partial_scope_schema.required_when must be decision.status=partial");
    verifyExactSet(partialScopeSchema.required ?? [], ["id", "allowed_uses", "prohibited_uses", "evidence_ids"], "scorer-quality-gate.yaml: partial_scope_schema.required", errors);
    verifyNonEmptyString(partialScopeSchema.evidence_rule, "scorer-quality-gate.yaml: partial_scope_schema.evidence_rule", errors);
  }
  verifyExactSet(
    gate?.required_check_categories ?? [],
    Object.values(A16_TEMPLATE_GATE_CHECKS),
    "scorer-quality-gate.yaml: required_check_categories",
    errors,
  );
  if (gate?.all_checks_critical !== true) errors.push("scorer-quality-gate.yaml: all_checks_critical must be true");
  if (gate?.exceptions?.allowed !== false) errors.push("scorer-quality-gate.yaml: exceptions.allowed must be false");
  verifyNonEmptyString(gate?.exceptions?.rationale, "scorer-quality-gate.yaml: exceptions.rationale", errors);
  const templateForbiddenEvidenceIds = collectNestedIds({
    charter, unit, observation, rubric, adjudication, manifest,
    validation: {...validation, evidence: undefined},
    gate: {...gate, checks: asArray(gate?.checks).map((check) => ({...check, evidence: undefined}))},
  });
  verifyA16Gate({gate, validation, manifest, expectedChecks: A16_TEMPLATE_GATE_CHECKS, knownEvidenceIds: templateEvidenceIds, forbiddenEvidenceIds: templateForbiddenEvidenceIds, label: "scorer-quality-gate.yaml", errors});
  void dimensionIds;
}

function verifyReferenceToScorerCase(value, relativePath, errors) {
  if (!value) return;
  const canonical = A16_CANONICAL_UPSTREAM[relativePath];
  for (const field of A16_UPSTREAM_FIELDS) verifyMatchingIdSet(value?.references?.[field], canonical?.[field] ?? [], `${relativePath}: references.${field}`, errors);
  const canonicalScorerIdentity = A16_CANONICAL_SCORER_IDENTITIES[relativePath];
  verifyMatchingIdSet(
    value?.references?.scorer_identity_ids,
    canonicalScorerIdentity ? [canonicalScorerIdentity] : [],
    `${relativePath}: references.scorer_identity_ids`,
    errors,
  );
  verifyEqualReference(
    value?.input?.scorers?.identity?.immutable_id,
    canonicalScorerIdentity,
    `${relativePath}: input.scorers.identity.immutable_id`,
    errors,
  );
  for (const field of ["scorer_charter", "observation_contract", "rubric", "adjudication", "validation", "quality_gate"]) verifyNonEmptyObject(value?.input?.[field], `${relativePath}: input.${field}`, errors);
  verifyNonEmptyObject(value?.input?.scoring_units, `${relativePath}: input.scoring_units`, errors);
  verifyNonEmptyArray(value?.input?.scoring_units?.units, `${relativePath}: input.scoring_units.units`, errors);
  verifyNonEmptyObject(value?.input?.scorers, `${relativePath}: input.scorers`, errors);
  verifyNonEmptyArray(value?.input?.scorers?.implementations, `${relativePath}: input.scorers.implementations`, errors);

  const definitionMap = {
    scorer_charter_ids: [value?.input?.scorer_charter?.id],
    scoring_unit_spec_ids: [value?.input?.scoring_units?.spec_id],
    scoring_unit_ids: asArray(value?.input?.scoring_units?.units).map((entry) => entry?.id),
    observation_contract_ids: [value?.input?.observation_contract?.id],
    rubric_ids: [value?.input?.rubric?.id],
    adjudication_protocol_ids: [value?.input?.adjudication?.id],
    scorer_manifest_ids: [value?.input?.scorers?.manifest_id],
    scorer_identity_ids: [value?.input?.scorers?.identity?.immutable_id],
    scorer_ids: asArray(value?.input?.scorers?.implementations).map((entry) => entry?.id),
    scorer_validation_ids: [value?.input?.validation?.id],
    scorer_quality_gate_ids: [value?.input?.quality_gate?.id],
    scoring_trace_ids: asArray(value?.expected?.trace_closure).map((entry) => entry?.id),
  };
  for (const [field, ids] of Object.entries(definitionMap)) verifyMatchingIdSet(value?.references?.[field], ids.filter(Boolean), `${relativePath}: references.${field}`, errors);

  for (const field of A16_UPSTREAM_FIELDS) {
    verifyMatchingIdSet(
      value?.input?.scorer_charter?.upstream_traceability?.[field],
      canonical?.[field] ?? [],
      `${relativePath}: input.scorer_charter.upstream_traceability.${field}`,
      errors,
    );
  }
  const charterId = value?.input?.scorer_charter?.id;
  const unitIds = definitionMap.scoring_unit_ids.filter(Boolean);
  const observationId = value?.input?.observation_contract?.id;
  const rubricId = value?.input?.rubric?.id;
  const adjudicationId = value?.input?.adjudication?.id;
  const scorerManifestId = value?.input?.scorers?.manifest_id;
  const validationId = value?.input?.validation?.id;
  const scorerIdentityId = value?.input?.scorers?.identity?.immutable_id;
  for (const [label, actual, expected] of [
    ["input.scoring_units.scorer_charter_id", value?.input?.scoring_units?.scorer_charter_id, charterId],
    ["input.observation_contract.scoring_unit_spec_id", value?.input?.observation_contract?.scoring_unit_spec_id, value?.input?.scoring_units?.spec_id],
    ["input.observation_contract.scoring_unit_ids", value?.input?.observation_contract?.scoring_unit_ids, unitIds],
    ["input.rubric.scorer_charter_id", value?.input?.rubric?.scorer_charter_id, charterId],
    ["input.rubric.scoring_unit_spec_id", value?.input?.rubric?.scoring_unit_spec_id, value?.input?.scoring_units?.spec_id],
    ["input.rubric.observation_contract_id", value?.input?.rubric?.observation_contract_id, observationId],
    ["input.adjudication.rubric_id", value?.input?.adjudication?.rubric_id, rubricId],
    ["input.validation.rubric_id", value?.input?.validation?.rubric_id, rubricId],
    ["input.validation.adjudication_protocol_id", value?.input?.validation?.adjudication_protocol_id, adjudicationId],
    ["input.scorers.scorer_charter_id", value?.input?.scorers?.scorer_charter_id, charterId],
    ["input.scorers.scoring_unit_spec_id", value?.input?.scorers?.scoring_unit_spec_id, value?.input?.scoring_units?.spec_id],
    ["input.scorers.observation_contract_id", value?.input?.scorers?.observation_contract_id, observationId],
    ["input.scorers.rubric_id", value?.input?.scorers?.rubric_id, rubricId],
    ["input.scorers.adjudication_protocol_id", value?.input?.scorers?.adjudication_protocol_id, adjudicationId],
    ["input.validation.scorer_manifest_id", value?.input?.validation?.scorer_manifest_id, scorerManifestId],
    ["input.quality_gate.scorer_manifest_id", value?.input?.quality_gate?.scorer_manifest_id, scorerManifestId],
    ["input.quality_gate.validation_report_id", value?.input?.quality_gate?.validation_report_id, validationId],
    ["input.validation.validation_identity.report_id", value?.input?.validation?.validation_identity?.report_id, validationId],
    ["input.validation.validation_identity.scorer_immutable_id", value?.input?.validation?.validation_identity?.scorer_immutable_id, scorerIdentityId],
  ]) {
    if (Array.isArray(expected)) verifyMatchingIdSet(actual, expected, `${relativePath}: ${label}`, errors);
    else verifyEqualReference(actual, expected, `${relativePath}: ${label}`, errors);
  }
  verifyA16StructuredIdentity(
    value?.input?.validation?.validation_identity?.dataset_version,
    `${relativePath}: input.validation.validation_identity.dataset_version`,
    errors,
  );
  verifyEqualReference(
    value?.input?.validation?.validation_identity?.dataset_version,
    A16_CANONICAL_VALIDATION_DATASETS[relativePath],
    `${relativePath}: input.validation.validation_identity.dataset_version`,
    errors,
  );

  for (const [index, scorer] of asArray(value?.input?.scorers?.implementations).entries()) {
    for (const field of ["id", "type", "role", "status"]) verifyNonEmptyString(scorer?.[field], `${relativePath}: input.scorers.implementations[${index}].${field}`, errors);
    if (!SCORER_IMPLEMENTATION_TYPES.has(scorer?.type)) errors.push(`${relativePath}: input.scorers.implementations[${index}].type is unsupported`);
  }
  const caseScorerIdentity = value?.input?.scorers?.identity;
  if (verifyNonEmptyObject(caseScorerIdentity, `${relativePath}: input.scorers.identity`, errors)) {
    for (const field of ["immutable_id", "status", "implementation_hash", "config_hash", "runtime_identity", "input_schema_version", "output_schema_version"]) verifyNonEmptyString(caseScorerIdentity[field], `${relativePath}: input.scorers.identity.${field}`, errors);
    if (!new Set(["design-only", "implemented", "validated"]).has(caseScorerIdentity.status)) errors.push(`${relativePath}: input.scorers.identity.status must be design-only, implemented or validated`);
  }
  verifyA16DisjointScorerIdentities({
    manifestId: value?.input?.scorers?.manifest_id,
    immutableId: caseScorerIdentity?.immutable_id,
    implementationIds: definitionMap.scorer_ids.filter(Boolean),
    label: `${relativePath}: input.scorers`,
    errors,
  });
  const caseScorerSecurity = value?.input?.scorers?.security;
  if (verifyNonEmptyObject(caseScorerSecurity, `${relativePath}: input.scorers.security`, errors)) {
    for (const field of ["reference_fields_read_only", "candidate_output_untrusted", "prompt_injection_treated_as_data", "secrets_prohibited", "logs_redacted"]) if (caseScorerSecurity[field] !== true) errors.push(`${relativePath}: input.scorers.security.${field} must be true`);
    verifyNonEmptyString(caseScorerSecurity.network_access, `${relativePath}: input.scorers.security.network_access`, errors);
  }
  for (const [index, unit] of asArray(value?.input?.scoring_units?.units).entries()) {
    for (const field of ["id", "level", "purpose"]) verifyNonEmptyString(unit?.[field], `${relativePath}: input.scoring_units.units[${index}].${field}`, errors);
    verifyNonEmptyStringArray(unit?.identity_keys, `${relativePath}: input.scoring_units.units[${index}].identity_keys`, errors);
  }
  for (const field of ["identity", "initial_state", "event_stream", "final_output", "final_state", "evidence_metadata"]) verifyNonEmptyStringArray(value?.input?.observation_contract?.bundle?.[field], `${relativePath}: input.observation_contract.bundle.${field}`, errors);
  if (value?.input?.observation_contract?.critical_missing_action !== "unscorable") errors.push(`${relativePath}: input.observation_contract.critical_missing_action must be unscorable`);
  if (value?.input?.observation_contract?.candidate_cannot_write_reference_fields !== true) errors.push(`${relativePath}: input.observation_contract.candidate_cannot_write_reference_fields must be true`);
  if (value?.input?.rubric?.type !== "analytic") errors.push(`${relativePath}: input.rubric.type must be analytic`);
  const caseDimensionIds = verifyA16EntityArray(value?.input?.rubric?.dimensions, ["id", "construct_id", "scoring_unit_ids", "scale", "anchors"], `${relativePath}: input.rubric.dimensions`, errors);
  for (const [index, dimension] of asArray(value?.input?.rubric?.dimensions).entries()) {
    verifyReferencesKnown([dimension?.construct_id], new Set(canonical?.construct_ids ?? []), `${relativePath}: input.rubric.dimensions[${index}].construct_id`, errors);
    const ids = verifyStringIdList(dimension?.scoring_unit_ids, `${relativePath}: input.rubric.dimensions[${index}].scoring_unit_ids`, errors);
    verifyReferencesKnown(ids, new Set(unitIds), `${relativePath}: input.rubric.dimensions[${index}].scoring_unit_ids`, errors);
    if (verifyNonEmptyObject(dimension?.scale, `${relativePath}: input.rubric.dimensions[${index}].scale`, errors)) verifyNonEmptyArray(dimension.scale.values, `${relativePath}: input.rubric.dimensions[${index}].scale.values`, errors);
    verifyNonEmptyArray(dimension?.anchors, `${relativePath}: input.rubric.dimensions[${index}].anchors`, errors);
    for (const [anchorIndex, anchor] of asArray(dimension?.anchors).entries()) {
      if (typeof anchor?.score !== "number") errors.push(`${relativePath}: input.rubric.dimensions[${index}].anchors[${anchorIndex}].score must be a number`);
      verifyNonEmptyStringArray(anchor?.observable_conditions, `${relativePath}: input.rubric.dimensions[${index}].anchors[${anchorIndex}].observable_conditions`, errors);
      verifyNonEmptyStringArray(anchor?.required_evidence, `${relativePath}: input.rubric.dimensions[${index}].anchors[${anchorIndex}].required_evidence`, errors);
    }
  }
  verifyNonEmptyArray(value?.input?.rubric?.critical_errors, `${relativePath}: input.rubric.critical_errors`, errors);
  for (const [index, critical] of asArray(value?.input?.rubric?.critical_errors).entries()) {
    verifyNonEmptyString(critical?.id, `${relativePath}: input.rubric.critical_errors[${index}].id`, errors);
    const risks = verifyStringIdList(critical?.risk_ids, `${relativePath}: input.rubric.critical_errors[${index}].risk_ids`, errors);
    verifyReferencesKnown(risks, new Set(canonical?.risk_ids ?? []), `${relativePath}: input.rubric.critical_errors[${index}].risk_ids`, errors);
    if (critical?.compensable !== false) errors.push(`${relativePath}: input.rubric.critical_errors[${index}].compensable must be false`);
    if (critical?.judge_override_allowed !== false) errors.push(`${relativePath}: input.rubric.critical_errors[${index}].judge_override_allowed must be false`);
  }
  if (value?.input?.adjudication?.disagreement?.preserve_raw_decisions !== true) errors.push(`${relativePath}: input.adjudication.disagreement.preserve_raw_decisions must be true`);
  verifyNonEmptyArray(value?.input?.adjudication?.disagreement?.categories, `${relativePath}: input.adjudication.disagreement.categories`, errors);
  verifyNonEmptyArray(value?.input?.adjudication?.outcomes, `${relativePath}: input.adjudication.outcomes`, errors);
  verifyNonEmptyString(value?.input?.adjudication?.critical_rule, `${relativePath}: input.adjudication.critical_rule`, errors);
  verifyExactSet(value?.input?.scorers?.output_statuses ?? [], [...SCORE_RECORD_STATUSES], `${relativePath}: input.scorers.output_statuses`, errors);
  const implementationIds = definitionMap.scorer_ids.filter(Boolean);
  const nonCompositeIds = asArray(value?.input?.scorers?.implementations)
    .filter((implementation) => implementation?.type !== "composite")
    .map((implementation) => implementation?.id)
    .filter(Boolean);
  verifyMatchingIdSet(value?.input?.scorers?.precedence?.order, nonCompositeIds, `${relativePath}: input.scorers.precedence.order`, errors);
  verifyNonEmptyStringArray(value?.input?.scorers?.precedence?.judge_cannot_override, `${relativePath}: input.scorers.precedence.judge_cannot_override`, errors);
  verifyExactSet(Object.keys(value?.input?.validation?.error_profile ?? {}), ["false_pass", "false_fail", "abstain_error", "unscorable_detection_error"], `${relativePath}: input.validation.error_profile`, errors);
  verifyNonEmptyArray(value?.input?.validation?.bias_and_robustness?.slices, `${relativePath}: input.validation.bias_and_robustness.slices`, errors);
  verifyNonEmptyArray(value?.input?.validation?.bias_and_robustness?.perturbations, `${relativePath}: input.validation.bias_and_robustness.perturbations`, errors);
  verifyNonEmptyArray(value?.input?.validation?.security?.tests, `${relativePath}: input.validation.security.tests`, errors);
  verifyA16ThresholdDeclarations(value?.input?.validation?.acceptance, `${relativePath}: input.validation.acceptance`, errors);
  verifyNonEmptyStringArray(value?.evidence?.design_artifacts, `${relativePath}: evidence.design_artifacts`, errors);
  verifyNonEmptyStringArray(value?.evidence?.limitations, `${relativePath}: evidence.limitations`, errors);

  const knownIds = collectNestedIds(value?.input);
  for (const ids of Object.values(canonical ?? {})) for (const id of ids) knownIds.add(id);
  for (const ids of Object.values(definitionMap)) for (const id of ids) if (id) knownIds.add(id);
  const traces = value?.expected?.trace_closure;
  const traceIds = verifyA16EntityArray(traces, ["id", "links", "action"], `${relativePath}: expected.trace_closure`, errors);
  const traced = new Set();
  for (const [index, trace] of asArray(traces).entries()) {
    const links = verifyStringIdList(trace?.links, `${relativePath}: expected.trace_closure[${index}].links`, errors);
    verifyReferencesKnown(links, knownIds, `${relativePath}: expected.trace_closure[${index}].links`, errors, traced);
  }
  for (const [field, ids] of Object.entries(value?.references ?? {})) {
    if (field === "scoring_trace_ids") continue;
    for (const id of asArray(ids)) if (!traced.has(id)) errors.push(`${relativePath}: reference ${id} is not covered by expected.trace_closure`);
  }
  for (const id of caseDimensionIds) {
    if (!traced.has(id)) errors.push(`${relativePath}: rubric dimension ${id} is not covered by expected.trace_closure`);
  }
  verifyMatchingIdSet(value?.evidence?.traceability, traceIds, `${relativePath}: evidence.traceability`, errors);

  const validation = value?.input?.validation;
  const manifest = {
    id: value?.input?.scorers?.manifest_id,
    scorer_identity: value?.input?.scorers?.identity,
    implementations: value?.input?.scorers?.implementations,
    scorer_charter_id: value?.input?.scorers?.scorer_charter_id,
    scoring_unit_spec_id: value?.input?.scorers?.scoring_unit_spec_id,
    observation_contract_id: value?.input?.scorers?.observation_contract_id,
    rubric_id: value?.input?.scorers?.rubric_id,
    adjudication_protocol_id: value?.input?.scorers?.adjudication_protocol_id,
  };
  for (const record of [...asArray(validation?.evidence?.sample_records), ...asArray(validation?.evidence?.evidence_links)]) {
    const id = typeof record === "string" ? record : record?.id;
    if (typeof id === "string") knownIds.add(id);
  }
  const caseForbiddenEvidenceIds = new Set([
    ...Object.values(canonical ?? {}).flat(),
    ...Object.values(definitionMap).flat().filter(Boolean),
    ...caseDimensionIds,
    ...asArray(value?.input?.rubric?.critical_errors).map((entry) => entry?.id).filter(Boolean),
  ]);
  verifyA16Gate({gate: value?.input?.quality_gate, validation, manifest, expectedChecks: A16_CASE_GATE_CHECKS[relativePath], knownEvidenceIds: knownIds, forbiddenEvidenceIds: caseForbiddenEvidenceIds, label: `${relativePath}: input.quality_gate`, errors});
}

function verifyA16GlobalScorerIdentityUniqueness(exampleValues, errors) {
  const seen = new Map();
  for (const [relativePath, value] of exampleValues) {
    const identityId = value?.input?.scorers?.identity?.immutable_id;
    if (typeof identityId !== "string" || identityId.length === 0) continue;
    if (seen.has(identityId)) {
      errors.push(`${relativePath}: scorer identity ${identityId} duplicates ${seen.get(identityId)}; canonical case scorer identities must be globally unique`);
    } else {
      seen.set(identityId, relativePath);
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

async function verifyHtml(unitDir, errors, verifyLocalHrefs = false) {
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
  if (verifyLocalHrefs) {
    const hrefPattern = /<[a-z][^>]*\bhref\s*=\s*(["'])(.*?)\1/gi;
    for (const match of source.matchAll(hrefPattern)) {
      const href = match[2].trim();
      if (
        href.length === 0 ||
        href.startsWith("#") ||
        /^(?:https?:|mailto:|data:)/i.test(href) ||
        path.isAbsolute(href)
      ) {
        continue;
      }
      const relativeTarget = href.split(/[?#]/, 1)[0];
      if (relativeTarget.length === 0) continue;
      let decodedTarget;
      try {
        decodedTarget = decodeURIComponent(relativeTarget);
      } catch {
        errors.push(`index.html: invalid local href ${href}`);
        continue;
      }
      const target = path.resolve(path.dirname(htmlPath), decodedTarget);
      if (!(await exists(target))) errors.push(`index.html: broken local href ${href}`);
    }
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

  const exampleValues = new Map();
  for (const examplePath of manifest?.contents?.examples ?? []) {
    if (!isSafeRelativePath(examplePath)) continue;
    const contract = PROFILE_CONTRACTS[profileName]?.example ?? EXAMPLE_CONTRACT;
    const value = await verifyYaml(resolvedUnitDir, examplePath, contract, errors);
    exampleValues.set(examplePath, value);
    if (profileName === "requirements-to-evidence-v1") {
      verifyEvaluationCaseReferences(value, examplePath, errors);
    } else if (profileName === "target-boundary-version-v1") {
      verifyTargetBoundaryVersionCase(value, examplePath, errors);
    } else if (profileName === "question-to-task-scenario-v1") {
      verifyQuestionTaskScenarioCase(value, examplePath, errors);
    } else if (profileName === "task-scenario-to-evaluation-data-v1") {
      verifyTaskScenarioDataCase(value, examplePath, errors);
    } else if (profileName === "reference-to-scorer-v1") {
      verifyReferenceToScorerCase(value, examplePath, errors);
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
  } else if (profileName === "task-scenario-to-evaluation-data-v1") {
    verifyTaskScenarioDataTemplates(templateValues, errors);
  } else if (profileName === "reference-to-scorer-v1") {
    verifyA16GlobalScorerIdentityUniqueness(exampleValues, errors);
    verifyReferenceToScorerTemplates(templateValues, errors);
  }

  await verifyHtml(
    resolvedUnitDir,
    errors,
    ["task-scenario-to-evaluation-data-v1", "reference-to-scorer-v1"].includes(profileName),
  );
  return errors;
}
