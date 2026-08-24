"""被测系统适配器。"""

from .base import InfrastructureError, TargetAdapter, TargetResult
from .deterministic import DeterministicTarget
from .subprocess import SubprocessTarget

__all__ = [
    "DeterministicTarget",
    "InfrastructureError",
    "SubprocessTarget",
    "TargetAdapter",
    "TargetResult",
]
