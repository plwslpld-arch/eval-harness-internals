"""Reference Harness 命令行入口。"""

from __future__ import annotations

import json
from pathlib import Path

import typer

from .pipeline import (
    ScoreReplay,
    load_evidence,
    load_report,
    recompute_gates,
    recompute_metrics,
    recompute_scores,
    run_evaluation,
)


app = typer.Typer(
    help="运行、检查、评分并门禁本地确定性评测。",
    no_args_is_help=True,
)


def _require_path(path: Path, label: str) -> None:
    if not path.exists():
        typer.echo(f"错误：{label}不存在：{path}", err=True)
        raise typer.Exit(code=2)


def _fail(label: str, error: Exception) -> None:
    typer.echo(f"错误：{label}：{error}", err=True)
    raise typer.Exit(code=2) from error


def _write_json(path: Path, payload: object) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


@app.command()
def run(
    config: Path,
    output: Path = typer.Option(Path("output/eval-run"), "--output", "-o"),
) -> None:
    """从冻结配置运行一次评测。"""

    _require_path(config, "配置文件")
    try:
        result = run_evaluation(config, output_dir=output)
    except (OSError, ValueError) as error:
        _fail("配置无效", error)
    typer.echo(f"评测报告：{result.paths.html}")
    for decision in result.report.gates:
        typer.echo(f"{decision.gate_id}：{decision.status.value}")


@app.command()
def inspect(run_dir: Path) -> None:
    """检查已保存的运行证据。"""

    _require_path(run_dir, "运行目录")
    try:
        evidence = load_evidence(run_dir)
        report = load_report(run_dir)
        evidence_trial_ids = [trial.trial_id for trial in evidence.trials]
        if report.trial_ids != evidence_trial_ids:
            raise ValueError("report.json 与 evidence.json 的 Trial 清单不一致")
        missing_artifacts = [
            artifact.relative_path
            for bundle in evidence.bundles
            for artifact in bundle.artifacts
            if not (run_dir / artifact.relative_path).is_file()
        ]
        if missing_artifacts:
            raise ValueError(f"缺少 Artifact：{missing_artifacts[0]}")
    except (OSError, ValueError) as error:
        _fail("运行证据无效", error)
    typer.echo(f"评测：{report.evaluation_id}")
    typer.echo(f"计划 Trial：{len(report.trial_ids)}")
    typer.echo(f"Observation Bundle：{len(evidence.bundles)}")
    typer.echo(f"评分记录：{len(report.scores)}")
    for decision in report.gates:
        typer.echo(f"{decision.gate_id}：{decision.status.value}")


@app.command()
def score(run_dir: Path) -> None:
    """根据已保存 Observation 重新评分。"""

    _require_path(run_dir, "运行目录")
    try:
        evidence = load_evidence(run_dir)
        scores = recompute_scores(evidence)
        metrics = recompute_metrics(evidence, scores)
        replay = ScoreReplay(scores=scores, metrics=metrics)
        _write_json(run_dir / "rescore.json", replay.model_dump(mode="json"))
    except (OSError, ValueError) as error:
        _fail("重新评分失败", error)
    typer.echo(f"重新评分：{len(scores)} 条")
    for metric in metrics:
        typer.echo(f"{metric.metric_id}：{metric.numerator}/{metric.denominator}")


@app.command()
def gate(run_dir: Path) -> None:
    """根据已保存 Metric 重新执行门禁。"""

    _require_path(run_dir, "运行目录")
    try:
        evidence = load_evidence(run_dir)
        replay_path = run_dir / "rescore.json"
        if replay_path.is_file():
            replay = ScoreReplay.model_validate_json(
                replay_path.read_text(encoding="utf-8")
            )
            scores, metrics = replay.scores, replay.metrics
        else:
            report = load_report(run_dir)
            scores, metrics = report.scores, report.metrics
        decisions = recompute_gates(evidence, scores, metrics)
        _write_json(
            run_dir / "regate.json",
            [decision.model_dump(mode="json") for decision in decisions],
        )
    except (OSError, ValueError) as error:
        _fail("重新门禁失败", error)
    typer.echo("重新门禁：")
    for decision in decisions:
        typer.echo(f"{decision.gate_id}：{decision.status.value}")
