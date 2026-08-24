from __future__ import annotations

from eval_harness_reference.models import AttemptStatus, Sample, Trial, TrialStatus
from eval_harness_reference.runner import RetryPolicy, run_trial
from eval_harness_reference.targets.deterministic import DeterministicTarget


def make_trial() -> Trial:
    return Trial(
        trial_id="run-1:candidate:amount-100:r1",
        run_id="run-1",
        target_id="candidate",
        sample=Sample(sample_id="amount-100", input={"amount": 100}),
        repetition=1,
    )


def test_infrastructure_error_creates_recovery_attempt() -> None:
    target = DeterministicTarget.from_script(
        [
            {"kind": "infra_error", "code": "worker_lost"},
            {"kind": "completed", "output": {"fee": 0}},
        ]
    )

    result = run_trial(make_trial(), target, RetryPolicy(max_infra_attempts=2))

    assert [attempt.status for attempt in result.attempts] == [
        AttemptStatus.INFRA_FAILED,
        AttemptStatus.SUCCEEDED,
    ]
    assert [attempt.canonical for attempt in result.attempts] == [False, True]
    assert result.status is TrialStatus.COMPLETED


def test_product_failure_is_not_retried_by_harness() -> None:
    target = DeterministicTarget.from_script(
        [
            {"kind": "product_failure", "output": {"error": "步骤超限"}},
            {"kind": "completed", "output": {"fee": 0}},
        ]
    )

    result = run_trial(make_trial(), target, RetryPolicy(max_infra_attempts=3))

    assert len(result.attempts) == 1
    assert result.attempts[0].status is AttemptStatus.SUCCEEDED
    assert result.attempts[0].canonical is True
    assert result.product_failed is True
    assert target.remaining_steps == 1


def test_exhausted_infrastructure_attempts_have_no_canonical_result() -> None:
    target = DeterministicTarget.from_script(
        [
            {"kind": "infra_error", "code": "timeout"},
            {"kind": "infra_error", "code": "timeout"},
        ]
    )

    result = run_trial(make_trial(), target, RetryPolicy(max_infra_attempts=2))

    assert result.status is TrialStatus.BLOCKED
    assert sum(attempt.canonical for attempt in result.attempts) == 0
