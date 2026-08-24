"""Target Adapter 的最小公开契约。"""

from __future__ import annotations

from typing import Literal, Protocol

from pydantic import Field

from ..models import FrozenModel, Trial


class InfrastructureError(RuntimeError):
    """表示 Harness 可以按预声明策略恢复的基础设施错误。"""

    def __init__(self, code: str, message: str = "") -> None:
        super().__init__(message or code)
        self.code = code


class TargetResult(FrozenModel):
    kind: Literal["completed", "product_failure"]
    output: dict[str, object] = Field(default_factory=dict)


class TargetAdapter(Protocol):
    def run(self, trial: Trial) -> TargetResult:
        """执行一次 Trial，不负责 Harness 基础设施重试。"""
