"""内容寻址 Artifact 与 Observation Bundle 血缘。"""

from __future__ import annotations

import hashlib
from pathlib import Path

from .identity import canonical_digest
from .models import ArtifactRef, ObservationBundle, TraceEvent
from .runner import TrialResult


class ArtifactStore:
    def __init__(self, root: Path) -> None:
        self._root = root

    def put_bytes(self, kind: str, data: bytes) -> ArtifactRef:
        hexadecimal = hashlib.sha256(data).hexdigest()
        digest = f"sha256:{hexadecimal}"
        self._root.mkdir(parents=True, exist_ok=True)
        target = self._root / hexadecimal
        if not target.exists():
            target.write_bytes(data)
        return ArtifactRef(
            kind=kind,
            digest=digest,
            relative_path=f"artifacts/{hexadecimal}",
        )


def build_observation_bundle(
    result: TrialResult,
    *,
    events: list[TraceEvent],
    artifacts: list[ArtifactRef],
) -> ObservationBundle:
    canonical = [attempt for attempt in result.attempts if attempt.canonical]
    if len(canonical) != 1:
        raise ValueError("Observation Bundle 必须绑定唯一 canonical Attempt")
    payload = {
        "trial_id": result.trial.trial_id,
        "canonical_attempt_id": canonical[0].attempt_id,
        "events": [event.model_dump(mode="json") for event in events],
        "artifacts": [artifact.model_dump(mode="json") for artifact in artifacts],
    }
    digest = canonical_digest(payload)
    return ObservationBundle(
        bundle_id=f"bundle-{digest[7:19]}",
        digest=digest,
        trial_id=result.trial.trial_id,
        canonical_attempt_id=canonical[0].attempt_id,
        events=events,
        artifacts=artifacts,
    )
