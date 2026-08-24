from __future__ import annotations

from pathlib import Path
import json

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
    for command in ("run", "inspect", "score", "compare", "gate"):
        assert command in result.output


def test_run_command_executes_shipping_pipeline(tmp_path: Path) -> None:
    config = REPO_ROOT / "reference" / "examples" / "shipping" / "eval.yaml"
    output = tmp_path / "shipping-run"

    result = runner.invoke(app, ["run", str(config), "--output", str(output)])

    assert result.exit_code == 0, result.output
    assert "buggy-release：failed" in result.output
    assert "fixed-release：passed" in result.output
    assert (output / "report.html").is_file()
    assert (output / "evidence.json").is_file()


def test_saved_run_can_be_inspected_rescored_and_regated(tmp_path: Path) -> None:
    config = REPO_ROOT / "reference" / "examples" / "shipping" / "eval.yaml"
    output = tmp_path / "shipping-run"
    run_result = runner.invoke(app, ["run", str(config), "--output", str(output)])
    assert run_result.exit_code == 0, run_result.output

    inspect_result = runner.invoke(app, ["inspect", str(output)])
    assert inspect_result.exit_code == 0, inspect_result.output
    assert "评测：shipping-boundary" in inspect_result.output
    assert "计划 Trial：6" in inspect_result.output
    assert "buggy-release：failed" in inspect_result.output

    score_result = runner.invoke(app, ["score", str(output)])
    assert score_result.exit_code == 0, score_result.output
    assert "重新评分：6 条" in score_result.output
    rescore = json.loads((output / "rescore.json").read_text(encoding="utf-8"))
    assert len(rescore["scores"]) == 6
    assert {metric["metric_id"] for metric in rescore["metrics"]} == {
        "buggy:pass-rate",
        "fixed:pass-rate",
    }

    gate_result = runner.invoke(app, ["gate", str(output)])
    assert gate_result.exit_code == 0, gate_result.output
    assert "buggy-release：failed" in gate_result.output
    assert "fixed-release：passed" in gate_result.output
    regate = json.loads((output / "regate.json").read_text(encoding="utf-8"))
    assert [decision["status"] for decision in regate] == ["failed", "passed"]


def test_run_command_rejects_invalid_yaml_with_concise_chinese_error(
    tmp_path: Path,
) -> None:
    config = tmp_path / "invalid.yaml"
    config.write_text("evaluation_id: demo\nunknown: true\n", encoding="utf-8")

    result = runner.invoke(app, ["run", str(config)])

    assert result.exit_code != 0
    assert "配置无效" in result.output
    assert "Traceback" not in result.output


def test_compare_command_pairs_candidate_and_baseline_trials(tmp_path: Path) -> None:
    config = REPO_ROOT / "reference" / "examples" / "shipping" / "eval.yaml"
    output = tmp_path / "shipping-run"
    run_result = runner.invoke(app, ["run", str(config), "--output", str(output)])
    assert run_result.exit_code == 0, run_result.output

    result = runner.invoke(
        app,
        [
            "compare",
            str(output),
            "--candidate-target",
            "fixed",
            "--baseline-target",
            "buggy",
            "--seed",
            "17",
            "--iterations",
            "200",
        ],
    )

    assert result.exit_code == 0, result.output
    assert "配对 Trial：3" in result.output
    payload = json.loads((output / "comparison.json").read_text(encoding="utf-8"))
    assert payload["pair_count"] == 3
    assert payload["mean_difference"] > 0


def test_inspect_rejects_artifact_whose_bytes_do_not_match_digest(tmp_path: Path) -> None:
    config = REPO_ROOT / "reference" / "examples" / "shipping" / "eval.yaml"
    output = tmp_path / "shipping-run"
    assert runner.invoke(app, ["run", str(config), "--output", str(output)]).exit_code == 0
    evidence = json.loads((output / "evidence.json").read_text(encoding="utf-8"))
    relative_path = evidence["bundles"][0]["artifacts"][0]["relative_path"]
    (output / relative_path).write_text("已被篡改\n", encoding="utf-8")

    result = runner.invoke(app, ["inspect", str(output)])

    assert result.exit_code != 0
    assert "摘要不一致" in result.output


def test_run_command_supports_agent_trace_import_without_model_access(tmp_path: Path) -> None:
    (tmp_path / "dataset.jsonl").write_text(
        json.dumps(
            {
                "sample_id": "trace-1",
                "input": {},
                "expected": {"trace_event_count": 2},
            }
        )
        + "\n",
        encoding="utf-8",
    )
    (tmp_path / "agent.jsonl").write_text(
        "\n".join(
            [
                json.dumps({"event_id": "e1", "sequence": 1, "type": "tool_call"}),
                json.dumps(
                    {
                        "event_id": "e2",
                        "sequence": 2,
                        "type": "agent_completed",
                        "parent_event_id": "e1",
                    }
                ),
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    (tmp_path / "eval.yaml").write_text(
        """evaluation_id: trace-import
dataset: dataset.jsonl
repetitions: 1
max_concurrency: 2
targets:
  - target_id: imported
    adapter: agent_trace
    trace: agent.jsonl
scorer:
  scorer_id: trace-count:v1
  field: trace_event_count
gate:
  minimum: 1.0
""",
        encoding="utf-8",
    )

    result = runner.invoke(
        app,
        ["run", str(tmp_path / "eval.yaml"), "--output", str(tmp_path / "run")],
    )

    assert result.exit_code == 0, result.output
    assert "imported-release：passed" in result.output


def test_run_command_rejects_dataset_path_outside_config_directory(tmp_path: Path) -> None:
    outside = tmp_path.parent / "outside-dataset.jsonl"
    outside.write_text(
        json.dumps({"sample_id": "x", "input": {}, "expected": {}}) + "\n",
        encoding="utf-8",
    )
    config = tmp_path / "eval.yaml"
    config.write_text(
        f"""evaluation_id: traversal
dataset: ../{outside.name}
repetitions: 1
targets:
  - target_id: demo
    adapter: agent_trace
    trace: trace.jsonl
scorer:
  scorer_id: demo
  field: value
gate:
  minimum: 1.0
""",
        encoding="utf-8",
    )

    result = runner.invoke(app, ["run", str(config)])

    assert result.exit_code != 0
    assert "配置目录之外" in result.output
