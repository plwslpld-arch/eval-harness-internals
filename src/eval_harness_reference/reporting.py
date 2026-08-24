"""把评测证据导出为可离线核对的报告。"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from jinja2 import Template

from .models import FrozenModel, GateDecision, MetricEstimate, ScoreRecord


class EvaluationReport(FrozenModel):
    evaluation_id: str
    trial_ids: list[str]
    scores: list[ScoreRecord]
    metrics: list[MetricEstimate]
    gates: list[GateDecision]


@dataclass(frozen=True)
class ReportPaths:
    json: Path
    markdown: Path
    html: Path


def _markdown(report: EvaluationReport) -> str:
    lines = [
        f"# 评测报告：{report.evaluation_id}",
        "",
        "## 运行摘要",
        "",
        f"- 计划 Trial：{len(report.trial_ids)}",
        f"- 评分记录：{len(report.scores)}",
        "",
        "## 评分记录",
        "",
        "| Score | Trial | 状态 | 值 |",
        "| --- | --- | --- | --- |",
    ]
    lines.extend(
        f"| {score.score_id} | {score.trial_id} | {score.status.value} | {score.value if score.value is not None else '—'} |"
        for score in report.scores
    )
    lines.extend(["", "## 指标", "", "| Metric | 分子/分母 | 值 |", "| --- | --- | --- |"])
    lines.extend(
        f"| {metric.metric_id} | {metric.numerator}/{metric.denominator} | {metric.value:.4f} |"
        for metric in report.metrics
    )
    lines.extend(["", "## 质量门禁", "", "| Gate | 状态 | 依据指标 | 原因 |", "| --- | --- | --- | --- |"])
    lines.extend(
        f"| {gate.gate_id} | {gate.status.value} | {', '.join(gate.metric_ids)} | {gate.reason} |"
        for gate in report.gates
    )
    return "\n".join(lines) + "\n"


def write_report(report: EvaluationReport, output_dir: Path) -> ReportPaths:
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / "report.json"
    markdown_path = output_dir / "report.md"
    html_path = output_dir / "report.html"
    payload = report.model_dump(mode="json")
    json_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    markdown_path.write_text(_markdown(report), encoding="utf-8")
    template_path = Path(__file__).parent / "templates" / "report.html.j2"
    template = Template(template_path.read_text(encoding="utf-8"))
    html_path.write_text(template.render(report=payload), encoding="utf-8")
    return ReportPaths(json=json_path, markdown=markdown_path, html=html_path)
