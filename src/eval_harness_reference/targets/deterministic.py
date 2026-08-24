"""无需网络或模型凭据的脚本化 Target。"""

from __future__ import annotations

from collections import deque
from collections.abc import Iterable

from ..models import Trial
from .base import InfrastructureError, TargetResult


class DeterministicTarget:
    def __init__(self, steps: Iterable[dict[str, object]]) -> None:
        self._steps = deque(dict(step) for step in steps)

    @classmethod
    def from_script(cls, steps: Iterable[dict[str, object]]) -> "DeterministicTarget":
        return cls(steps)

    @property
    def remaining_steps(self) -> int:
        return len(self._steps)

    def run(self, trial: Trial) -> TargetResult:
        del trial
        if not self._steps:
            raise InfrastructureError("script_exhausted")
        step = self._steps.popleft()
        kind = step.get("kind")
        if kind == "infra_error":
            raise InfrastructureError(str(step.get("code", "unknown_infra_error")))
        if kind not in {"completed", "product_failure"}:
            raise InfrastructureError("invalid_script_step")
        output = step.get("output", {})
        if not isinstance(output, dict):
            raise InfrastructureError("invalid_script_output")
        return TargetResult(kind=kind, output=output)
