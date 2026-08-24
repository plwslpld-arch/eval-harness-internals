"""Scorer 的最小公开接口。"""

from __future__ import annotations

from typing import Protocol

from ..models import ObservationBundle, ScoreRecord


class Scorer(Protocol):
    def score(self, bundle: ObservationBundle) -> ScoreRecord:
        """只根据明确 Observation 生成 ScoreRecord。"""
