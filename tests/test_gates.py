from __future__ import annotations

from eval_harness_reference.gates import ThresholdPolicy, evaluate_gate
from eval_harness_reference.models import (
    GateStatus,
    MetricEstimate,
    ScoreRecord,
    ScoreStatus,
)


DIGEST = "sha256:" + "d" * 64


def metric(value: float) -> MetricEstimate:
    return MetricEstimate(
        metric_id="pass-rate",
        numerator=int(value * 10),
        denominator=10,
        value=value,
        score_ids=["score-1"],
    )


def score(status: ScoreStatus) -> ScoreRecord:
    return ScoreRecord(
        score_id="score-1",
        trial_id="trial-1",
        canonical_attempt_id="attempt-1",
        observation_bundle_digest=DIGEST,
        scorer_id="rule:v1",
        status=status,
    )


def test_invalid_critical_evidence_cannot_pass_gate() -> None:
    decision = evaluate_gate(
        ThresholdPolicy(gate_id="release", metric_id="pass-rate", minimum=0.8),
        [metric(1.0)],
        [score(ScoreStatus.INVALID)],
    )

    assert decision.status is GateStatus.INCONCLUSIVE


def test_valid_metric_applies_predeclared_threshold() -> None:
    policy = ThresholdPolicy(gate_id="release", metric_id="pass-rate", minimum=0.8)

    assert evaluate_gate(policy, [metric(0.9)], [score(ScoreStatus.PASSED)]).status is GateStatus.PASSED
    assert evaluate_gate(policy, [metric(0.7)], [score(ScoreStatus.FAILED)]).status is GateStatus.FAILED
