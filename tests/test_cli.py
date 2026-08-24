from __future__ import annotations

from pathlib import Path

from typer.testing import CliRunner

from eval_harness_reference.cli import app


runner = CliRunner()
REPO_ROOT = Path(__file__).resolve().parents[1]


def test_run_command_reports_missing_config_in_chinese(tmp_path: Path) -> None:
    result = runner.invoke(app, ["run", str(tmp_path / "missing.yaml")])

    assert result.exit_code != 0
    assert "配置文件不存在" in result.output


def test_cli_help_exposes_core_commands() -> None:
    result = runner.invoke(app, ["--help"])

    assert result.exit_code == 0
    for command in ("run", "inspect", "score", "gate"):
        assert command in result.output


def test_run_command_executes_shipping_pipeline(tmp_path: Path) -> None:
    config = REPO_ROOT / "reference" / "examples" / "shipping" / "eval.yaml"
    output = tmp_path / "shipping-run"

    result = runner.invoke(app, ["run", str(config), "--output", str(output)])

    assert result.exit_code == 0, result.output
    assert "buggy-release：failed" in result.output
    assert "fixed-release：passed" in result.output
    assert (output / "report.html").is_file()
