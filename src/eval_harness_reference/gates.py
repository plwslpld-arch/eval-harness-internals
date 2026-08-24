"""把有效 Metric 转换为显式质量决定。"""

from __future__ import annotations

from pydantic import Field

from .models import (
    FrozenModel,
    GateDecision,
    GateStatus,
    MetricEstimate,
    ScoreRecord,
    ScoreStatus,
)


class ThresholdPolicy(FrozenModel):
    gate_id: str = Field(min_length=1)
    metric_id: str = Field(min_length=1)
    minimum: float


def evaluate_gate(
    policy: ThresholdPolicy,
    metrics: list[MetricEstimate],
    scores: list[ScoreRecord],
) -> GateDecision:
    unusable = {
        ScoreStatus.INVALID,
        ScoreStatus.UNSCORABLE,
        ScoreStatus.UNCERTAIN,
    }
    if any(score.status in unusable for score in scores):
        return GateDecision(
            gate_id=policy.gate_id,
            status=GateStatus.INCONCLUSIVE,
            metric_ids=[policy.metric_id],
            reason="存在无效、不完整或无法裁决的关键评分证据",
        )
    selected = [metric for metric in metrics if metric.metric_id == policy.metric_id]
    if len(selected) != 1:
        return GateDecision(
            gate_id=policy.gate_id,
            status=GateStatus.BLOCKED,
            metric_ids=[policy.metric_id],
            reason="缺少唯一的门禁指标",
        )
    metric = selected[0]
    status = GateStatus.PASSED if metric.value >= policy.minimum else GateStatus.FAILED
    comparator = "达到" if status is GateStatus.PASSED else "低于"
    return GateDecision(
        gate_id=policy.gate_id,
        status=status,
        metric_ids=[metric.metric_id],
        reason=f"指标 {metric.value:.4f} {comparator}冻结阈值 {policy.minimum:.4f}",
    )
