from __future__ import annotations

import re
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[1]
COURSES = {
    "lm-evaluation-harness": [
        "README.md",
        "01-entry-task-loading.md",
        "02-request-execution.md",
        "03-scoring-aggregation-tests.md",
    ],
    "inspect-ai": [
        "README.md",
        "01-eval-task-solver.md",
        "02-sandbox-sample-run.md",
        "03-scorer-log-retry.md",
    ],
    "openai-evals": [
        "README.md",
        "01-registry-eval-spec.md",
        "02-completion-sample-run.md",
        "03-recorder-metrics-boundaries.md",
    ],
    "promptfoo": [
        "README.md",
        "01-config-provider-prompt.md",
        "02-test-case-runtime.md",
        "03-assertion-results-ci.md",
    ],
    "deepeval": [
        "README.md",
        "01-dataset-golden-test-case.md",
        "02-metric-execution.md",
        "03-async-cache-errors.md",
    ],
}
HEADINGS = [
    "## 本篇要解决什么问题",
    "## 先建立源码地图",
    "## 完整调用链",
    "## 关键数据结构",
    "## 实现取舍与失败语义",
    "## 动手实验",
    "## 预期输出与答案",
    "## 如何核对",
    "## 本篇不能证明什么",
]


def test_harness_courses_are_source_verified_learning_sequences() -> None:
    for course, files in COURSES.items():
        for filename in files:
            text = (REPO_ROOT / "docs" / "harnesses" / course / filename).read_text(
                encoding="utf-8"
            )
            assert len(re.sub(r"\s+", "", text)) >= 1700, (course, filename)
            for heading in HEADINGS:
                assert heading in text, f"{course}/{filename} 缺少 {heading}"
            assert re.search(r"!\[[^]]+\]\([^)]*\.svg\)", text), filename
            assert "[上一节]" in text and "[下一节]" in text


def test_harness_courses_link_only_to_locked_source_paths() -> None:
    lock = yaml.safe_load(
        (REPO_ROOT / "sources" / "sources.lock.yml").read_text(encoding="utf-8")
    )
    locked = {source["id"]: source for source in lock["sources"]}
    source_ids = {
        "lm-evaluation-harness": "lm-evaluation-harness",
        "inspect-ai": "inspect-ai",
        "openai-evals": "openai-evals",
        "promptfoo": "promptfoo",
        "deepeval": "deepeval",
    }
    for course, files in COURSES.items():
        source = locked[source_ids[course]]
        allowed = set(source["scope_paths"])
        pattern = re.compile(
            rf"https://github\.com/{re.escape(source['repo'])}/blob/"
            rf"{source['commit']}/([^\s)#]+)"
        )
        for filename in files:
            text = (
                REPO_ROOT / "docs" / "harnesses" / course / filename
            ).read_text(encoding="utf-8")
            paths = pattern.findall(text)
            assert paths, (course, filename)
            assert set(paths) <= allowed, (course, filename, set(paths) - allowed)
