from __future__ import annotations

from eval_harness_reference.comparison import paired_bootstrap
from eval_harness_reference.metrics import aggregate_pass_rate
from eval_harness_reference.models import ScoreRecord, ScoreStatus


DIGEST = "sha256:" + "c" * 64


def make_score(trial_id: str, status: ScoreStatus) -> ScoreRecord:
    return ScoreRecord(
        score_id=f"score-{trial_id}",
        trial_id=trial_id,
        canonical_attempt_id=f"attempt-{trial_id}",
        observation_bundle_digest=DIGEST,
        scorer_id="rule:v1",
        status=status,
        value=1.0 if status is ScoreStatus.PASSED else 0.0,
    )


def test_metric_denominator_uses_planned_trials() -> None:
    scores = [
        make_score("trial-1", ScoreStatus.PASSED),
        make_score("trial-2", ScoreStatus.FAILED),
    ]

    metric = aggregate_pass_rate(scores, ["trial-1", "trial-2", "trial-3"])

    assert metric.numerator == 1
    assert metric.denominator == 3
    assert metric.value == 1 / 3


def test_paired_bootstrap_is_stable_for_a_fixed_seed() -> None:
    baseline = {"a": 0.0, "b": 1.0, "c": 0.0, "d": 1.0}
    candidate = {"a": 1.0, "b": 1.0, "c": 1.0, "d": 1.0}

    first = paired_bootstrap(candidate, baseline, seed=7, iterations=500)
    second = paired_bootstrap(candidate, baseline, seed=7, iterations=500)

    assert first == second
    assert first.mean_difference == 0.5
    assert first.pair_count == 4
