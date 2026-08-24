"""使用预声明 Trial 分母聚合 Score。"""

from __future__ import annotations

from .models import MetricEstimate, ScoreRecord, ScoreStatus


def aggregate_pass_rate(
    scores: list[ScoreRecord],
    planned_trial_ids: list[str],
) -> MetricEstimate:
    if not planned_trial_ids:
        raise ValueError("planned_trial_ids 不能为空")
    if len(planned_trial_ids) != len(set(planned_trial_ids)):
        raise ValueError("planned_trial_ids 不能重复")
    score_ids = [score.score_id for score in scores]
    if len(score_ids) != len(set(score_ids)):
        raise ValueError("score_id 不能重复")
    planned = set(planned_trial_ids)
    if any(score.trial_id not in planned for score in scores):
        raise ValueError("Score 引用了计划外 Trial")
    numerator = sum(score.status is ScoreStatus.PASSED for score in scores)
    denominator = len(planned_trial_ids)
    return MetricEstimate(
        metric_id="pass-rate",
        numerator=numerator,
        denominator=denominator,
        value=numerator / denominator,
        score_ids=score_ids,
    )
