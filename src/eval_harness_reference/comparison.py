"""对共享配对键进行可复现非参数比较。"""

from __future__ import annotations

import random
from statistics import fmean

from pydantic import Field

from .models import FrozenModel


class ComparisonResult(FrozenModel):
    pair_count: int = Field(gt=0)
    mean_difference: float
    confidence_low: float
    confidence_high: float
    seed: int
    iterations: int = Field(gt=0)


def paired_bootstrap(
    candidate: dict[str, float],
    baseline: dict[str, float],
    *,
    seed: int,
    iterations: int,
) -> ComparisonResult:
    keys = sorted(set(candidate) & set(baseline))
    if not keys:
        raise ValueError("Candidate 与 Baseline 没有共享配对键")
    if iterations <= 0:
        raise ValueError("iterations 必须大于 0")
    differences = [candidate[key] - baseline[key] for key in keys]
    generator = random.Random(seed)
    estimates = sorted(
        fmean(generator.choice(differences) for _ in differences)
        for _ in range(iterations)
    )
    low_index = int((iterations - 1) * 0.025)
    high_index = int((iterations - 1) * 0.975)
    return ComparisonResult(
        pair_count=len(keys),
        mean_difference=fmean(differences),
        confidence_low=estimates[low_index],
        confidence_high=estimates[high_index],
        seed=seed,
        iterations=iterations,
    )
