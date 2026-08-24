from __future__ import annotations

import re
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SECTIONS = {
    "engineering": (
        [
            "01-minimal-eval-loop.md",
            "02-run-identity-and-reproducibility.md",
            "03-retries-and-recovery.md",
            "04-llm-as-judge.md",
            "05-statistical-comparison.md",
            "06-agent-environments.md",
            "07-quality-gates.md",
            "08-eval-to-rl.md",
        ],
        1800,
    ),
    "comparisons": (
        [
            "01-task-dataset-target.md",
            "02-runner-concurrency-cache-retry.md",
            "03-trace-artifact-lineage.md",
            "04-scorer-judge-outcomes.md",
            "05-metric-statistics-uncertainty.md",
            "06-agent-environment-final-state.md",
            "07-report-ci-release-gate.md",
        ],
        1500,
    ),
    "cases": (
        [
            "shipping-boundary.md",
            "refund-agent.md",
            "knowledge-assistant.md",
            "contract-review-agent.md",
        ],
        1700,
    ),
    "labs": (
        [
            "01-run-one-deterministic-eval.md",
            "02-add-a-target-adapter.md",
            "03-write-a-scorer.md",
            "04-repeat-and-compare.md",
            "05-evaluate-an-agent-trace.md",
            "06-build-a-release-gate.md",
        ],
        1100,
    ),
}
HEADINGS = [
    "## 本篇要解决什么问题",
    "## 核心机制",
    "## 完整流程",
    "## 关键数据与不变量",
    "## 动手实验",
    "## 预期输出与答案",
    "## 如何核对",
    "## 本篇不能证明什么",
]


def test_curriculum_chapters_are_deep_runnable_and_navigable() -> None:
    for section, (files, minimum) in SECTIONS.items():
        for filename in files:
            path = REPO_ROOT / "docs" / section / filename
            text = path.read_text(encoding="utf-8")
            assert len(re.sub(r"\s+", "", text)) >= minimum, (section, filename)
            for heading in HEADINGS:
                assert heading in text, f"{section}/{filename} 缺少 {heading}"
            assert re.search(r"!\[[^]]+\]\([^)]*\.svg\)", text), filename
            assert "[上一节]" in text and "[下一节]" in text
            assert "```" in text, f"{section}/{filename} 缺少可运行或可核对片段"


def test_curriculum_navigation_and_diagrams_resolve() -> None:
    link_pattern = re.compile(r"!?\[[^]]*\]\(([^)]+)\)")
    for section, (files, _) in SECTIONS.items():
        for filename in files:
            path = REPO_ROOT / "docs" / section / filename
            text = path.read_text(encoding="utf-8")
            for target in link_pattern.findall(text):
                if target.startswith(("http://", "https://", "#")):
                    continue
                clean = target.split("#", 1)[0].split("?", 1)[0]
                if clean:
                    assert (path.parent / clean).resolve().exists(), (path, target)
