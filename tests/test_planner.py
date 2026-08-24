from eval_harness_reference.models import EvaluationSpec, Sample, TargetSpec
from eval_harness_reference.planner import plan_trials


def test_planner_materializes_stable_cartesian_trials() -> None:
    spec = EvaluationSpec(
        evaluation_id="shipping",
        targets=[
            TargetSpec(target_id="baseline", adapter="deterministic"),
            TargetSpec(target_id="candidate", adapter="deterministic"),
        ],
        repetitions=4,
    )
    samples = [
        Sample(sample_id=f"amount-{amount}", input={"amount": amount})
        for amount in (99, 100, 101)
    ]

    first = plan_trials(spec, samples)
    second = plan_trials(spec, list(reversed(samples)))

    assert len(first) == 24
    assert [trial.trial_id for trial in first] == [trial.trial_id for trial in second]
    assert len({trial.trial_id for trial in first}) == 24
    assert first[0].trial_id.endswith(":baseline:amount-100:r1")
