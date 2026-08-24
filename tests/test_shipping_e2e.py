from __future__ import annotations

import json
from pathlib import Path

from eval_harness_reference.pipeline import run_evaluation


REPO_ROOT = Path(__file__).resolve().parents[1]


def test_shipping_evaluation_fails_buggy_and_passes_fixed(tmp_path: Path) -> None:
    result = run_evaluation(
        REPO_ROOT / "reference" / "examples" / "shipping" / "eval.yaml",
        output_dir=tmp_path / "run",
    )

    gates = {gate.gate_id: gate.status.value for gate in result.report.gates}
    assert gates == {"buggy-release": "failed", "fixed-release": "passed"}
    assert len(result.trial_results) == 6
    assert sum(len(trial.attempts) for trial in result.trial_results) == 6
    assert len(result.report.scores) == 6
    assert (tmp_path / "run" / "report.json").is_file()
    assert (tmp_path / "run" / "report.md").is_file()
    assert (tmp_path / "run" / "report.html").is_file()
    trace_lines = list((tmp_path / "run" / "traces").glob("*.jsonl"))
    assert len(trace_lines) == 6

    report = json.loads((tmp_path / "run" / "report.json").read_text(encoding="utf-8"))
    metric_denominators = {item["metric_id"]: item["denominator"] for item in report["metrics"]}
    assert metric_denominators == {"buggy:pass-rate": 3, "fixed:pass-rate": 3}
