from __future__ import annotations

from pathlib import Path

import pytest

from eval_harness_reference.pipeline import run_evaluation


REPO_ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize(
    ("case", "trial_count"),
    [
        ("refund-agent", 6),
        ("knowledge-assistant", 6),
        ("contract-review", 6),
    ],
)
def test_advanced_case_has_deterministic_buggy_and_fixed_targets(
    tmp_path: Path, case: str, trial_count: int
) -> None:
    result = run_evaluation(
        REPO_ROOT / "reference" / "examples" / case / "eval.yaml",
        output_dir=tmp_path / case,
    )

    gates = {gate.gate_id: gate.status.value for gate in result.report.gates}
    assert gates == {"buggy-release": "failed", "fixed-release": "passed"}
    assert len(result.trial_results) == trial_count
