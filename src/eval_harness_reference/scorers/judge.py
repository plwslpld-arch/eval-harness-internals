"""默认不联网的可选 Judge 接口与 Scorer 适配器。"""

from __future__ import annotations

from typing import Protocol

from pydantic import Field

from ..identity import canonical_digest
from ..models import FrozenModel, ObservationBundle, ScoreRecord, ScoreStatus


class JudgeResult(FrozenModel):
    value: float
    passed: bool
    reason: str = Field(min_length=1, max_length=2000)


class Judge(Protocol):
    judge_id: str

    def judge(self, observation: ObservationBundle) -> JudgeResult:
        """根据明确 Observation 返回测量，不管理重试或网络。"""


class JudgeScorer:
    def __init__(self, scorer_id: str, judge: Judge) -> None:
        self._scorer_id = scorer_id
        self._judge = judge

    def score(self, bundle: ObservationBundle) -> ScoreRecord:
        result = self._judge.judge(bundle)
        score_id = "score-" + canonical_digest(
            {
                "bundle": bundle.digest,
                "scorer": self._scorer_id,
                "judge": self._judge.judge_id,
            }
        )[7:19]
        return ScoreRecord(
            score_id=score_id,
            trial_id=bundle.trial_id,
            canonical_attempt_id=bundle.canonical_attempt_id,
            observation_bundle_digest=bundle.digest,
            scorer_id=self._scorer_id,
            status=ScoreStatus.PASSED if result.passed else ScoreStatus.FAILED,
            value=result.value,
            reason=result.reason,
        )
