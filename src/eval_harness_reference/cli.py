"""Reference Harness 命令行入口。"""

from __future__ import annotations

from pathlib import Path

import typer

from .pipeline import run_evaluation


app = typer.Typer(
    help="运行、检查、评分并门禁本地确定性评测。",
    no_args_is_help=True,
)


def _require_path(path: Path, label: str) -> None:
    if not path.exists():
        typer.echo(f"错误：{label}不存在：{path}", err=True)
        raise typer.Exit(code=2)


@app.command()
def run(
    config: Path,
    output: Path = typer.Option(Path("output/eval-run"), "--output", "-o"),
) -> None:
    """从冻结配置运行一次评测。"""

    _require_path(config, "配置文件")
    result = run_evaluation(config, output_dir=output)
    typer.echo(f"评测报告：{result.paths.html}")
    for decision in result.report.gates:
        typer.echo(f"{decision.gate_id}：{decision.status.value}")


@app.command()
def inspect(run_dir: Path) -> None:
    """检查已保存的运行证据。"""

    _require_path(run_dir, "运行目录")
    typer.echo(f"运行目录：{run_dir}")


@app.command()
def score(run_dir: Path) -> None:
    """根据已保存 Observation 重新评分。"""

    _require_path(run_dir, "运行目录")
    typer.echo(f"准备评分：{run_dir}")


@app.command()
def gate(run_dir: Path) -> None:
    """根据已保存 Metric 重新执行门禁。"""

    _require_path(run_dir, "运行目录")
    typer.echo(f"准备门禁：{run_dir}")
