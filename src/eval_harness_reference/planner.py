"""把冻结规范和样本物化为稳定的统计 Trial。"""

from __future__ import annotations

from .identity import canonical_digest
from .models import EvaluationSpec, Sample, Trial


def plan_trials(spec: EvaluationSpec, samples: list[Sample]) -> list[Trial]:
    """按 Target、Sample、Repetition 的稳定顺序建立 Trial。"""

    run_id = f"run-{spec.evaluation_id}-{canonical_digest(spec)[7:19]}"
    trials: list[Trial] = []
    for target in sorted(spec.targets, key=lambda item: item.target_id):
        for sample in sorted(samples, key=lambda item: item.sample_id):
            for repetition in range(1, spec.repetitions + 1):
                trial_id = f"{run_id}:{target.target_id}:{sample.sample_id}:r{repetition}"
                trials.append(
                    Trial(
                        trial_id=trial_id,
                        run_id=run_id,
                        target_id=target.target_id,
                        sample=sample,
                        repetition=repetition,
                    )
                )
    return trials
