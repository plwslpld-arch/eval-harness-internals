"""Trial 执行与基础设施 Attempt 恢复。"""

from __future__ import annotations

from pydantic import Field, model_validator

from .models import Attempt, AttemptStatus, FrozenModel, Trial, TrialStatus
from .targets.base import InfrastructureError, TargetAdapter


class RetryPolicy(FrozenModel):
    max_infra_attempts: int = Field(ge=1, le=20)


class TrialResult(FrozenModel):
    trial: Trial
    status: TrialStatus
    attempts: list[Attempt]
    output: dict[str, object] | None = None
    product_failed: bool = False

    @model_validator(mode="after")
    def has_at_most_one_canonical_attempt(self) -> "TrialResult":
        if sum(attempt.canonical for attempt in self.attempts) > 1:
            raise ValueError("每个 Trial 最多只能有一个 canonical Attempt")
        return self


def run_trial(
    trial: Trial,
    target: TargetAdapter,
    policy: RetryPolicy,
) -> TrialResult:
    """执行 Trial；只为基础设施错误创建新的 Attempt。"""

    attempts: list[Attempt] = []
    for ordinal in range(1, policy.max_infra_attempts + 1):
        attempt_id = f"{trial.trial_id}:a{ordinal}"
        try:
            target_result = target.run(trial)
        except InfrastructureError as error:
            attempts.append(
                Attempt(
                    attempt_id=attempt_id,
                    trial_id=trial.trial_id,
                    ordinal=ordinal,
                    status=AttemptStatus.INFRA_FAILED,
                    canonical=False,
                    error_code=error.code,
                )
            )
            continue

        attempts.append(
            Attempt(
                attempt_id=attempt_id,
                trial_id=trial.trial_id,
                ordinal=ordinal,
                status=AttemptStatus.SUCCEEDED,
                canonical=True,
            )
        )
        return TrialResult(
            trial=trial,
            status=TrialStatus.COMPLETED,
            attempts=attempts,
            output=target_result.output,
            product_failed=target_result.kind == "product_failure",
        )

    return TrialResult(
        trial=trial,
        status=TrialStatus.BLOCKED,
        attempts=attempts,
    )
