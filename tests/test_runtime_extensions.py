from __future__ import annotations

import json
import threading
import time
from pathlib import Path

import pytest
from pydantic import ValidationError

from eval_harness_reference.models import ArtifactRef, Sample, Trial
from eval_harness_reference.runner import RetryPolicy, run_trial_batch
from eval_harness_reference.scorers.judge import JudgeResult, JudgeScorer
from eval_harness_reference.targets.base import TargetResult
from eval_harness_reference.targets.trace_import import AgentTraceImportTarget


def make_trial(index: int) -> Trial:
    return Trial(
        trial_id=f"trial-{index}",
        run_id="run-1",
        target_id="target",
        sample=Sample(sample_id=f"sample-{index}", input={}, expected={}),
        repetition=1,
    )


def test_batch_runner_limits_concurrency_and_preserves_plan_order() -> None:
    lock = threading.Lock()
    active = 0
    peak = 0

    class SlowTarget:
        def run(self, trial: Trial) -> TargetResult:
            nonlocal active, peak
            with lock:
                active += 1
                peak = max(peak, active)
            time.sleep(0.03)
            with lock:
                active -= 1
            return TargetResult(kind="completed", output={"trial": trial.trial_id})

    trials = [make_trial(index) for index in range(6)]
    results = run_trial_batch(
        trials,
        target_factory=lambda _: SlowTarget(),
        policy=RetryPolicy(max_infra_attempts=1),
        max_concurrency=2,
    )

    assert 1 < peak <= 2
    assert [result.trial.trial_id for result in results] == [trial.trial_id for trial in trials]


def test_agent_trace_import_validates_jsonl_and_exposes_final_output(tmp_path: Path) -> None:
    trace = tmp_path / "agent.jsonl"
    trace.write_text(
        "\n".join(
            [
                json.dumps({"event_id": "e1", "sequence": 1, "type": "tool_call"}),
                json.dumps(
                    {
                        "event_id": "e2",
                        "sequence": 2,
                        "type": "agent_completed",
                        "parent_event_id": "e1",
                        "payload": {"output": {"answer": 42}},
                    }
                ),
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    result = AgentTraceImportTarget(trace).run(make_trial(1))

    assert result.kind == "completed"
    assert result.output["trace_event_count"] == 2
    assert result.output["final_output"] == {"answer": 42}


def test_agent_trace_import_rejects_broken_parent(tmp_path: Path) -> None:
    trace = tmp_path / "broken.jsonl"
    trace.write_text(
        json.dumps(
            {
                "event_id": "e1",
                "sequence": 1,
                "type": "agent_completed",
                "parent_event_id": "missing",
            }
        )
        + "\n",
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="parent_event_id"):
        AgentTraceImportTarget(trace).run(make_trial(1))


def test_offline_judge_adapter_preserves_reason_and_lineage() -> None:
    class StubJudge:
        judge_id = "offline-stub-v1"

        def judge(self, observation):
            return JudgeResult(value=0.8, passed=True, reason="满足离线规则")

    scorer = JudgeScorer("judge-scorer", StubJudge())
    from eval_harness_reference.models import ObservationBundle

    bundle = ObservationBundle(
        bundle_id="bundle-1",
        digest="sha256:" + "a" * 64,
        trial_id="trial-1",
        canonical_attempt_id="attempt-1",
    )

    score = scorer.score(bundle)

    assert score.value == 0.8
    assert score.reason == "满足离线规则"
    assert score.canonical_attempt_id == "attempt-1"
    assert score.observation_bundle_digest == bundle.digest


@pytest.mark.parametrize(
    "relative_path",
    ["../secret", "artifacts/../../secret", "/absolute/path", r"C:\\secret"],
)
def test_artifact_reference_rejects_paths_outside_run_directory(relative_path: str) -> None:
    with pytest.raises(ValidationError):
        ArtifactRef(
            kind="output",
            digest="sha256:" + "b" * 64,
            relative_path=relative_path,
        )
