from __future__ import annotations

import json
from pathlib import Path

import pytest

from eval_harness_reference.artifacts import ArtifactStore, build_observation_bundle
from eval_harness_reference.models import Sample, TraceEvent, Trial
from eval_harness_reference.runner import RetryPolicy, run_trial
from eval_harness_reference.targets.deterministic import DeterministicTarget
from eval_harness_reference.tracing import TraceWriter


def make_result():
    trial = Trial(
        trial_id="run-1:candidate:amount-100:r1",
        run_id="run-1",
        target_id="candidate",
        sample=Sample(sample_id="amount-100", input={"amount": 100}),
        repetition=1,
    )
    return run_trial(
        trial,
        DeterministicTarget.from_script(
            [{"kind": "completed", "output": {"fee": 0}}]
        ),
        RetryPolicy(max_infra_attempts=1),
    )


def test_trace_writer_rejects_unknown_parent_and_duplicate_event(tmp_path: Path) -> None:
    writer = TraceWriter(tmp_path / "trace.jsonl")
    root = TraceEvent(event_id="event-1", sequence=1, type="trial_started")
    child = TraceEvent(
        event_id="event-2",
        sequence=2,
        type="target_completed",
        parent_event_id="event-1",
    )
    writer.append(root)
    writer.append(child)

    with pytest.raises(ValueError, match="重复"):
        writer.append(root)
    with pytest.raises(ValueError, match="父事件"):
        TraceWriter(tmp_path / "other.jsonl").append(child)

    rows = [json.loads(line) for line in (tmp_path / "trace.jsonl").read_text(encoding="utf-8").splitlines()]
    assert [row["event_id"] for row in rows] == ["event-1", "event-2"]


def test_artifact_store_deduplicates_identical_bytes(tmp_path: Path) -> None:
    store = ArtifactStore(tmp_path / "artifacts")

    first = store.put_bytes("stdout", "测试通过".encode())
    second = store.put_bytes("stdout", "测试通过".encode())

    assert first.digest == second.digest
    assert first.relative_path == second.relative_path
    assert len(list((tmp_path / "artifacts").iterdir())) == 1


def test_observation_bundle_binds_only_canonical_attempt(tmp_path: Path) -> None:
    result = make_result()
    store = ArtifactStore(tmp_path / "artifacts")
    artifact = store.put_bytes("target_output", b'{"fee":0}')
    events = [TraceEvent(event_id="event-1", sequence=1, type="target_completed")]

    bundle = build_observation_bundle(result, events=events, artifacts=[artifact])

    assert bundle.canonical_attempt_id == result.attempts[0].attempt_id
    assert bundle.trial_id == result.trial.trial_id
    assert bundle.digest.startswith("sha256:")
