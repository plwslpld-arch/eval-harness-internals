from __future__ import annotations

import sys

import pytest

from eval_harness_reference.models import Sample, Trial
from eval_harness_reference.targets.base import InfrastructureError
from eval_harness_reference.targets.subprocess import SubprocessTarget


def make_trial() -> Trial:
    return Trial(
        trial_id="run-1:local:amount-100:r1",
        run_id="run-1",
        target_id="local",
        sample=Sample(sample_id="amount-100", input={"amount": 100}),
        repetition=1,
    )


def test_subprocess_target_uses_argv_and_parses_json_output() -> None:
    target = SubprocessTarget(
        [sys.executable, "-c", "print('{\"fee\": 0}')"],
        timeout_seconds=2,
    )

    result = target.run(make_trial())

    assert result.kind == "completed"
    assert result.output == {"fee": 0}


def test_nonzero_target_exit_is_product_failure() -> None:
    target = SubprocessTarget(
        [sys.executable, "-c", "import sys; print('bad', file=sys.stderr); raise SystemExit(2)"],
        timeout_seconds=2,
    )

    result = target.run(make_trial())

    assert result.kind == "product_failure"
    assert result.output["exit_code"] == 2
    assert result.output["stderr"] == "bad"


def test_timeout_is_classified_as_infrastructure_error() -> None:
    target = SubprocessTarget(
        [sys.executable, "-c", "import time; time.sleep(1)"],
        timeout_seconds=0.01,
    )

    with pytest.raises(InfrastructureError) as caught:
        target.run(make_trial())

    assert caught.value.code == "target_timeout"


def test_string_command_is_rejected_instead_of_using_a_shell() -> None:
    with pytest.raises(TypeError, match="argv"):
        SubprocessTarget("python -c pass", timeout_seconds=1)  # type: ignore[arg-type]
