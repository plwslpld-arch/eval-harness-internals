"""跨执行、评分和门禁层共享的领域对象。"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class FrozenModel(BaseModel):
    """禁止运行证据在创建后被原地改写。"""

    model_config = ConfigDict(frozen=True, extra="forbid")


class AttemptStatus(StrEnum):
    SUCCEEDED = "succeeded"
    INFRA_FAILED = "infra_failed"
    CANCELLED = "cancelled"


class TrialStatus(StrEnum):
    COMPLETED = "completed"
    BLOCKED = "blocked"
    INVALID = "invalid"


class ScoreStatus(StrEnum):
    PASSED = "passed"
    FAILED = "failed"
    UNCERTAIN = "uncertain"
    UNSCORABLE = "unscorable"
    INVALID = "invalid"


class GateStatus(StrEnum):
    PASSED = "passed"
    FAILED = "failed"
    BLOCKED = "blocked"
    INCONCLUSIVE = "inconclusive"


class TargetSpec(FrozenModel):
    target_id: str = Field(min_length=1)
    adapter: str = Field(min_length=1)
    config: dict[str, object] = Field(default_factory=dict)


class EvaluationSpec(FrozenModel):
    evaluation_id: str = Field(min_length=1)
    targets: list[TargetSpec] = Field(min_length=1)
    repetitions: int = Field(ge=1, le=1000)

    @model_validator(mode="after")
    def target_ids_are_unique(self) -> "EvaluationSpec":
        target_ids = [target.target_id for target in self.targets]
        if len(target_ids) != len(set(target_ids)):
            raise ValueError("target_id 必须唯一")
        return self


class Sample(FrozenModel):
    sample_id: str = Field(min_length=1)
    input: dict[str, object]
    expected: dict[str, object] = Field(default_factory=dict)


class Trial(FrozenModel):
    trial_id: str = Field(min_length=1)
    run_id: str = Field(min_length=1)
    target_id: str = Field(min_length=1)
    sample: Sample
    repetition: int = Field(ge=1)


class Attempt(FrozenModel):
    attempt_id: str = Field(min_length=1)
    trial_id: str = Field(min_length=1)
    ordinal: int = Field(ge=1)
    status: AttemptStatus
    canonical: bool = False
    error_code: str | None = None


class TraceEvent(FrozenModel):
    event_id: str = Field(min_length=1)
    sequence: int = Field(ge=1)
    type: str = Field(min_length=1)
    parent_event_id: str | None = None
    payload: dict[str, object] = Field(default_factory=dict)


class ArtifactRef(FrozenModel):
    kind: str = Field(min_length=1)
    digest: str = Field(pattern=r"^sha256:[0-9a-f]{64}$")
    relative_path: str = Field(min_length=1)


class ObservationBundle(FrozenModel):
    bundle_id: str = Field(min_length=1)
    digest: str = Field(pattern=r"^sha256:[0-9a-f]{64}$")
    trial_id: str = Field(min_length=1)
    canonical_attempt_id: str = Field(min_length=1)
    events: list[TraceEvent] = Field(default_factory=list)
    artifacts: list[ArtifactRef] = Field(default_factory=list)


class ScoreRecord(FrozenModel):
    score_id: str = Field(min_length=1)
    trial_id: str = Field(min_length=1)
    canonical_attempt_id: str = Field(min_length=1)
    observation_bundle_digest: str = Field(pattern=r"^sha256:[0-9a-f]{64}$")
    scorer_id: str = Field(min_length=1)
    status: ScoreStatus = ScoreStatus.UNSCORABLE
    value: float | None = None
    reason: str = Field(default="", max_length=2000)


class MetricEstimate(FrozenModel):
    metric_id: str = Field(min_length=1)
    numerator: int = Field(ge=0)
    denominator: int = Field(gt=0)
    value: float
    score_ids: list[str] = Field(default_factory=list)


class GateDecision(FrozenModel):
    gate_id: str = Field(min_length=1)
    status: GateStatus
    metric_ids: list[str] = Field(default_factory=list)
    reason: str = Field(min_length=1, max_length=2000)
