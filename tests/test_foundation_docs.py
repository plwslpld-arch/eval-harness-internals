from __future__ import annotations

import re
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[1]
DOCS = REPO_ROOT / "docs"
FOUNDATIONS = [
    "01-agent-vs-eval-harness.md",
    "02-task-dataset-target-environment.md",
    "03-sample-trial-attempt.md",
    "04-trace-artifact-observation.md",
    "05-scorer-judge-score-metric.md",
    "06-uncertainty-comparison-gate.md",
    "07-eval-to-rl-and-release-eval.md",
]
REQUIRED_HEADINGS = [
    "## 本篇要解决什么问题",
    "## 学完你能解释什么",
    "## 贯穿案例",
    "## 核心概念与边界",
    "## 机制图",
    "## 调用链与状态变化",
    "## 关键数据结构",
    "## 设计取舍",
    "## 失败语义",
    "## 动手实验",
    "## 预期输出与答案",
    "## 常见误解",
    "## 如何核对",
    "## 与其他 Harness 的关系",
    "## 本篇不能证明什么",
]


def test_foundation_chapters_satisfy_the_learning_contract() -> None:
    for filename in FOUNDATIONS:
        path = DOCS / "foundations" / filename
        text = path.read_text(encoding="utf-8")
        assert len(re.sub(r"\s+", "", text)) >= 1800, filename
        for heading in REQUIRED_HEADINGS:
            assert heading in text, f"{filename} 缺少 {heading}"
        assert re.search(r"!\[[^]]+\]\([^)]*\.svg\)", text), filename
        assert re.search(
            r"https://github\.com/[^/]+/[^/]+/blob/[0-9a-f]{40}/", text
        ), filename
        assert "[上一章]" in text and "[下一章]" in text


def test_foundation_navigation_and_diagrams_resolve() -> None:
    for filename in FOUNDATIONS:
        path = DOCS / "foundations" / filename
        text = path.read_text(encoding="utf-8")
        for target in re.findall(r"\[[^]]+\]\(([^)]+)\)", text):
            if target.startswith(("http://", "https://", "#")):
                continue
            resolved = (path.parent / target.split("#", 1)[0]).resolve()
            assert resolved.exists(), f"{filename} -> {target}"
        for diagram in re.findall(r"!\[[^]]+\]\(([^)]*\.svg)\)", text):
            svg = (path.parent / diagram).resolve().read_text(encoding="utf-8")
            assert "<svg" in svg
            assert re.search(r"[\u4e00-\u9fff]", svg), diagram


def test_foundation_source_links_are_inside_the_locked_scope() -> None:
    lock = yaml.safe_load(
        (REPO_ROOT / "sources" / "sources.lock.yml").read_text(encoding="utf-8")
    )
    allowed = {
        (source["repo"], source["commit"], path)
        for source in lock["sources"]
        for path in source["scope_paths"]
    }
    pattern = re.compile(
        r"https://github\.com/([^/]+/[^/]+)/blob/([0-9a-f]{40})/([^\s)#]+)"
    )
    for filename in FOUNDATIONS:
        text = (DOCS / "foundations" / filename).read_text(encoding="utf-8")
        links = pattern.findall(text)
        assert links, filename
        for repo, commit, path in links:
            assert (repo, commit, path) in allowed, f"{filename}: {path}"
