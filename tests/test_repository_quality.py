from __future__ import annotations

from pathlib import Path

import pytest

from scripts.repository_quality import (
    collect_repository_violations,
    markdown_link_violations,
    svg_safety_violations,
)


REPO_ROOT = Path(__file__).resolve().parents[1]


def test_markdown_links_report_missing_local_target(tmp_path: Path) -> None:
    page = tmp_path / "page.md"
    page.write_text("[存在](ok.md)\n[缺失](missing.md#section)\n", encoding="utf-8")
    (tmp_path / "ok.md").write_text("# 好", encoding="utf-8")

    assert markdown_link_violations(tmp_path) == [
        "page.md: 本地链接不存在: missing.md#section"
    ]


@pytest.mark.parametrize(
    "unsafe",
    [
        '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://x.test/a.png"/></svg>',
    ],
)
def test_svg_safety_rejects_active_or_external_content(
    tmp_path: Path, unsafe: str
) -> None:
    path = tmp_path / "unsafe.svg"
    path.write_text(unsafe, encoding="utf-8")

    assert svg_safety_violations(tmp_path)


def test_current_repository_satisfies_publication_contract() -> None:
    assert collect_repository_violations(REPO_ROOT) == []
