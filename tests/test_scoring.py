from __future__ import annotations

from eval_harness_reference.models import ObservationBundle, ScoreStatus, TraceEvent
from eval_harness_reference.scorers.rules import FieldEqualsScorer


DIGEST = "sha256:" + "b" * 64


def make_bundle(payload: dict[str, object]) -> ObservationBundle:
    return ObservationBundle(
        bundle_id="bundle-1",
        digest=DIGEST,
        trial_id="trial-1",
        canonical_attempt_id="attempt-1",
        events=[
            TraceEvent(
                event_id="event-1",
                sequence=1,
                type="target_completed",
                payload=payload,
            )
        ],
    )


def test_missing_observation_is_unscorable_instead_of_zero() -> None:
    score = FieldEqualsScorer("fee-is-zero:v1", field="fee", expected=0).score(
        make_bundle({"output": {}})
    )

    assert score.status is ScoreStatus.UNSCORABLE
    assert score.value is None


def test_rule_scorer_distinguishes_passed_and_failed() -> None:
    scorer = FieldEqualsScorer("fee-is-zero:v1", field="fee", expected=0)

    passed = scorer.score(make_bundle({"output": {"fee": 0}}))
    failed = scorer.score(make_bundle({"output": {"fee": 10}}))

    assert passed.status is ScoreStatus.PASSED
    assert passed.value == 1.0
    assert failed.status is ScoreStatus.FAILED
    assert failed.value == 0.0
