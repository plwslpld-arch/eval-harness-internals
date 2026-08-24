from __future__ import annotations

import re
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[1]
COURSE = REPO_ROOT / "docs" / "harnesses" / "lm-evaluation-harness"
FILES = [
    "README.md",
    "01-entry-task-loading.md",
    "02-request-execution.md",
    "03-scoring-aggregation-tests.md",
]
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


def test_lm_eval_course_is_a_source_verified_learning_sequence() -> None:
    for filename in FILES:
        text = (COURSE / filename).read_text(encoding="utf-8")
        assert len(re.sub(r"\s+", "", text)) >= 1700, filename
        for heading in HEADINGS:
            assert heading in text, f"{filename} 缺少 {heading}"
        assert re.search(r"!\[[^]]+\]\([^)]*\.svg\)", text), filename
        assert "[上一节]" in text and "[下一节]" in text


def test_lm_eval_course_links_only_to_locked_source_paths() -> None:
    lock = yaml.safe_load(
        (REPO_ROOT / "sources" / "sources.lock.yml").read_text(encoding="utf-8")
    )
    source = next(
        item for item in lock["sources"] if item["id"] == "lm-evaluation-harness"
    )
    allowed = set(source["scope_paths"])
    pattern = re.compile(
        rf"https://github\.com/{re.escape(source['repo'])}/blob/"
        rf"{source['commit']}/([^\s)#]+)"
    )
    for filename in FILES:
        text = (COURSE / filename).read_text(encoding="utf-8")
        paths = pattern.findall(text)
        assert paths, filename
        assert set(paths) <= allowed, (filename, set(paths) - allowed)

