from __future__ import annotations

import json
from pathlib import Path

from eval_harness_reference.models import (
    GateDecision,
    GateStatus,
    MetricEstimate,
    ScoreRecord,
    ScoreStatus,
)
from eval_harness_reference.reporting import EvaluationReport, write_report


DIGEST = "sha256:" + "e" * 64


def make_report() -> EvaluationReport:
    score = ScoreRecord(
        score_id="score-1",
        trial_id="trial-1",
        canonical_attempt_id="attempt-1",
        observation_bundle_digest=DIGEST,
        scorer_id="fee-rule:v1",
        status=ScoreStatus.PASSED,
        value=1.0,
    )
    metric = MetricEstimate(
        metric_id="pass-rate",
        numerator=1,
        denominator=1,
        value=1.0,
        score_ids=[score.score_id],
    )
    gate = GateDecision(
        gate_id="release",
        status=GateStatus.PASSED,
        metric_ids=[metric.metric_id],
        reason="满足冻结阈值",
    )
    return EvaluationReport(
        evaluation_id="shipping",
        trial_ids=["trial-1"],
        scores=[score],
        metrics=[metric],
        gates=[gate],
    )


def test_reports_preserve_chinese_labels_and_lineage(tmp_path: Path) -> None:
    paths = write_report(make_report(), tmp_path)

    payload = json.loads(paths.json.read_text(encoding="utf-8"))
    markdown = paths.markdown.read_text(encoding="utf-8")
    html = paths.html.read_text(encoding="utf-8")

    assert payload["gates"][0]["metric_ids"] == ["pass-rate"]
    assert "质量门禁" in markdown
    assert "评分记录" in markdown
    assert "pass-rate" in html
    assert "score-1" in html
    assert "<html lang=\"zh-CN\">" in html
