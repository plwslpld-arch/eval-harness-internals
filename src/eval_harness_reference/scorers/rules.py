"""优先使用环境事实的确定性规则评分器。"""

from __future__ import annotations

from ..identity import canonical_digest
from ..models import ObservationBundle, ScoreRecord, ScoreStatus


class FieldEqualsScorer:
    def __init__(self, scorer_id: str, *, field: str, expected: object) -> None:
        self._scorer_id = scorer_id
        self._field = field
        self._expected = expected

    def score(self, bundle: ObservationBundle) -> ScoreRecord:
        output: dict[str, object] | None = None
        for event in reversed(bundle.events):
            if event.type != "target_completed":
                continue
            candidate = event.payload.get("output")
            if isinstance(candidate, dict):
                output = candidate
                break

        score_id = "score-" + canonical_digest(
            {
                "bundle": bundle.digest,
                "scorer": self._scorer_id,
                "field": self._field,
                "expected": self._expected,
            }
        )[7:19]
        common = {
            "score_id": score_id,
            "trial_id": bundle.trial_id,
            "canonical_attempt_id": bundle.canonical_attempt_id,
            "observation_bundle_digest": bundle.digest,
            "scorer_id": self._scorer_id,
        }
        if output is None or self._field not in output:
            return ScoreRecord(
                **common,
                status=ScoreStatus.UNSCORABLE,
                reason=f"缺少可评分字段：{self._field}",
            )
        if output[self._field] == self._expected:
            return ScoreRecord(
                **common,
                status=ScoreStatus.PASSED,
                value=1.0,
                reason="观察值满足冻结规则",
            )
        return ScoreRecord(
            **common,
            status=ScoreStatus.FAILED,
            value=0.0,
            reason="观察值不满足冻结规则",
        )


class FieldMatchesExpectedScorer:
    def __init__(self, scorer_id: str, *, field: str) -> None:
        self._scorer_id = scorer_id
        self._field = field

    def score(self, bundle: ObservationBundle) -> ScoreRecord:
        output: dict[str, object] | None = None
        expected: dict[str, object] | None = None
        for event in reversed(bundle.events):
            if event.type != "target_completed":
                continue
            candidate_output = event.payload.get("output")
            candidate_expected = event.payload.get("expected")
            if isinstance(candidate_output, dict):
                output = candidate_output
            if isinstance(candidate_expected, dict):
                expected = candidate_expected
            break
        score_id = "score-" + canonical_digest(
            {"bundle": bundle.digest, "scorer": self._scorer_id, "field": self._field}
        )[7:19]
        common = {
            "score_id": score_id,
            "trial_id": bundle.trial_id,
            "canonical_attempt_id": bundle.canonical_attempt_id,
            "observation_bundle_digest": bundle.digest,
            "scorer_id": self._scorer_id,
        }
        if (
            output is None
            or expected is None
            or self._field not in output
            or self._field not in expected
        ):
            return ScoreRecord(
                **common,
                status=ScoreStatus.UNSCORABLE,
                reason=f"缺少观察值或期望值字段：{self._field}",
            )
        matched = output[self._field] == expected[self._field]
        return ScoreRecord(
            **common,
            status=ScoreStatus.PASSED if matched else ScoreStatus.FAILED,
            value=1.0 if matched else 0.0,
            reason="观察值符合样本期望" if matched else "观察值不符合样本期望",
        )
