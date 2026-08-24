from __future__ import annotations

import pytest
from pydantic import ValidationError

from eval_harness_reference.models import (
    ArtifactRef,
    Attempt,
    AttemptStatus,
    EvaluationSpec,
    GateDecision,
    GateStatus,
    MetricEstimate,
    ObservationBundle,
    Sample,
    ScoreRecord,
    TargetSpec,
    TraceEvent,
    Trial,
)


def test_score_requires_canonical_attempt_and_bundle_digest() -> None:
    with pytest.raises(ValidationError):
        ScoreRecord(
            score_id="score-1",
            trial_id="trial-1",
            scorer_id="rule:v1",
        )


def test_status_layers_do_not_share_one_success_flag() -> None:
    assert {status.value for status in AttemptStatus} == {
        "succeeded",
        "infra_failed",
        "cancelled",
    }
    assert GateStatus.INCONCLUSIVE.value == "inconclusive"


def test_evaluation_spec_requires_unique_targets() -> None:
    target = TargetSpec(target_id="buggy", adapter="python")
    with pytest.raises(ValidationError, match="target_id"):
        EvaluationSpec(
            evaluation_id="shipping",
            targets=[target, target],
            repetitions=1,
        )


def test_trial_and_attempt_keep_statistics_separate() -> None:
    sample = Sample(sample_id="amount-100", input={"amount": 100})
    trial = Trial(
        trial_id="run-1:buggy:amount-100:r1",
        run_id="run-1",
        target_id="buggy",
        sample=sample,
        repetition=1,
    )
    attempt = Attempt(
        attempt_id="attempt-2",
        trial_id=trial.trial_id,
        ordinal=2,
        status=AttemptStatus.INFRA_FAILED,
        canonical=False,
    )
    assert trial.repetition == 1
    assert attempt.ordinal == 2
    assert attempt.canonical is False


def test_observation_metric_and_gate_form_explicit_lineage() -> None:
    digest = "sha256:" + "a" * 64
    artifact = ArtifactRef(kind="stdout", digest=digest, relative_path="artifacts/a.txt")
    event = TraceEvent(event_id="event-1", sequence=1, type="target_started")
    bundle = ObservationBundle(
        bundle_id="bundle-1",
        digest=digest,
        trial_id="trial-1",
        canonical_attempt_id="attempt-1",
        events=[event],
        artifacts=[artifact],
    )
    metric = MetricEstimate(
        metric_id="pass-rate",
        numerator=9,
        denominator=10,
        value=0.9,
        score_ids=["score-1"],
    )
    gate = GateDecision(
        gate_id="release",
        status=GateStatus.PASSED,
        metric_ids=[metric.metric_id],
        reason="满足冻结阈值",
    )
    assert bundle.canonical_attempt_id == "attempt-1"
    assert gate.metric_ids == ["pass-rate"]
