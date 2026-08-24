"""从冻结 YAML 配置运行一条完整本地评测管线。"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field

from .artifacts import ArtifactStore, build_observation_bundle
from .gates import ThresholdPolicy, evaluate_gate
from .identity import canonical_digest
from .metrics import aggregate_pass_rate
from .models import (
    EvaluationSpec,
    GateDecision,
    MetricEstimate,
    ObservationBundle,
    Sample,
    ScoreRecord,
    TargetSpec,
    TraceEvent,
    Trial,
)
from .planner import plan_trials
from .reporting import EvaluationReport, ReportPaths, write_report
from .runner import RetryPolicy, TrialResult, run_trial
from .scorers.rules import FieldMatchesExpectedScorer
from .targets.subprocess import SubprocessTarget
from .tracing import TraceWriter


class PipelineTargetConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target_id: str = Field(min_length=1)
    adapter: Literal["python_script"]
    script: str = Field(min_length=1)


class PipelineScorerConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scorer_id: str = Field(min_length=1)
    field: str = Field(min_length=1)


class PipelineGateConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    minimum: float = Field(ge=0, le=1)


class PipelineConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    evaluation_id: str = Field(min_length=1)
    dataset: str = Field(min_length=1)
    repetitions: int = Field(ge=1, le=1000)
    targets: list[PipelineTargetConfig] = Field(min_length=1)
    scorer: PipelineScorerConfig
    gate: PipelineGateConfig


@dataclass(frozen=True)
class PipelineResult:
    report: EvaluationReport
    trial_results: list[TrialResult]
    paths: ReportPaths


class RunEvidence(BaseModel):
    """足以在不重跑 Target 的前提下复核评分和门禁。"""

    model_config = ConfigDict(frozen=True, extra="forbid")
    config: PipelineConfig
    trials: list[Trial]
    bundles: list[ObservationBundle]


class ScoreReplay(BaseModel):
    """从冻结 Observation Bundle 重新计算的评分与指标。"""

    model_config = ConfigDict(frozen=True, extra="forbid")
    scores: list[ScoreRecord]
    metrics: list[MetricEstimate]


def _load_config(path: Path) -> PipelineConfig:
    payload = yaml.safe_load(path.read_text(encoding="utf-8"))
    return PipelineConfig.model_validate(payload)


def _load_samples(path: Path) -> list[Sample]:
    samples: list[Sample] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            samples.append(Sample.model_validate_json(line))
        except ValueError as error:
            raise ValueError(f"Dataset 第 {line_number} 行无效：{error}") from error
    if not samples:
        raise ValueError("Dataset 不能为空")
    return samples


def _write_model(path: Path, model: BaseModel) -> None:
    path.write_text(
        json.dumps(model.model_dump(mode="json"), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def load_evidence(run_dir: Path) -> RunEvidence:
    return RunEvidence.model_validate_json(
        (run_dir / "evidence.json").read_text(encoding="utf-8")
    )


def load_report(run_dir: Path) -> EvaluationReport:
    return EvaluationReport.model_validate_json(
        (run_dir / "report.json").read_text(encoding="utf-8")
    )


def recompute_scores(evidence: RunEvidence) -> list[ScoreRecord]:
    scorer = FieldMatchesExpectedScorer(
        evidence.config.scorer.scorer_id,
        field=evidence.config.scorer.field,
    )
    return [scorer.score(bundle) for bundle in evidence.bundles]


def recompute_metrics(
    evidence: RunEvidence, scores: list[ScoreRecord]
) -> list[MetricEstimate]:
    metrics: list[MetricEstimate] = []
    for target in sorted(evidence.config.targets, key=lambda item: item.target_id):
        target_trials = [
            trial.trial_id for trial in evidence.trials if trial.target_id == target.target_id
        ]
        trial_id_set = set(target_trials)
        target_scores = [score for score in scores if score.trial_id in trial_id_set]
        metrics.append(
            aggregate_pass_rate(
                target_scores,
                target_trials,
                metric_id=f"{target.target_id}:pass-rate",
            )
        )
    return metrics


def recompute_gates(
    evidence: RunEvidence,
    scores: list[ScoreRecord],
    metrics: list[MetricEstimate],
) -> list[GateDecision]:
    gates: list[GateDecision] = []
    for target in sorted(evidence.config.targets, key=lambda item: item.target_id):
        target_trial_ids = {
            trial.trial_id for trial in evidence.trials if trial.target_id == target.target_id
        }
        target_scores = [score for score in scores if score.trial_id in target_trial_ids]
        metric_id = f"{target.target_id}:pass-rate"
        gates.append(
            evaluate_gate(
                ThresholdPolicy(
                    gate_id=f"{target.target_id}-release",
                    metric_id=metric_id,
                    minimum=evidence.config.gate.minimum,
                ),
                metrics,
                target_scores,
            )
        )
    return gates


def run_evaluation(config_path: Path, *, output_dir: Path) -> PipelineResult:
    config_path = config_path.resolve()
    config = _load_config(config_path)
    base_dir = config_path.parent
    samples = _load_samples((base_dir / config.dataset).resolve())
    spec = EvaluationSpec(
        evaluation_id=config.evaluation_id,
        targets=[
            TargetSpec(target_id=target.target_id, adapter=target.adapter)
            for target in config.targets
        ],
        repetitions=config.repetitions,
    )
    trials = plan_trials(spec, samples)
    target_configs = {target.target_id: target for target in config.targets}
    scorer = FieldMatchesExpectedScorer(
        config.scorer.scorer_id,
        field=config.scorer.field,
    )
    artifact_store = ArtifactStore(output_dir / "artifacts")
    trace_dir = output_dir / "traces"
    trial_results: list[TrialResult] = []
    bundles: list[ObservationBundle] = []
    scores: list[ScoreRecord] = []

    for trial in trials:
        target_config = target_configs[trial.target_id]
        script = (base_dir / target_config.script).resolve()
        target = SubprocessTarget([sys.executable, str(script)], timeout_seconds=10)
        result = run_trial(trial, target, RetryPolicy(max_infra_attempts=2))
        trial_results.append(result)
        if result.output is None:
            continue
        events = [
            TraceEvent(
                event_id=f"{trial.trial_id}:started",
                sequence=1,
                type="trial_started",
            ),
            TraceEvent(
                event_id=f"{trial.trial_id}:completed",
                sequence=2,
                type="target_completed",
                parent_event_id=f"{trial.trial_id}:started",
                payload={"output": result.output, "expected": trial.sample.expected},
            ),
        ]
        trace_name = canonical_digest({"trial_id": trial.trial_id})[7:23] + ".jsonl"
        trace_writer = TraceWriter(trace_dir / trace_name)
        for event in events:
            trace_writer.append(event)
        artifact = artifact_store.put_bytes(
            "target_output",
            (json.dumps(result.output, ensure_ascii=False, sort_keys=True) + "\n").encode(),
        )
        bundle = build_observation_bundle(result, events=events, artifacts=[artifact])
        bundles.append(bundle)
        scores.append(scorer.score(bundle))

    evidence = RunEvidence(config=config, trials=trials, bundles=bundles)
    metrics = recompute_metrics(evidence, scores)
    gates = recompute_gates(evidence, scores, metrics)

    report = EvaluationReport(
        evaluation_id=config.evaluation_id,
        trial_ids=[trial.trial_id for trial in trials],
        scores=scores,
        metrics=metrics,
        gates=gates,
    )
    output_dir.mkdir(parents=True, exist_ok=True)
    _write_model(output_dir / "evidence.json", evidence)
    (output_dir / "run.json").write_text(
        json.dumps(
            [result.model_dump(mode="json") for result in trial_results],
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    paths = write_report(report, output_dir)
    return PipelineResult(report=report, trial_results=trial_results, paths=paths)
