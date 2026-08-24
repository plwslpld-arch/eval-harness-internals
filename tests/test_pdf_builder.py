from __future__ import annotations

from pathlib import Path

from bs4 import BeautifulSoup
from pypdf import PdfReader
from reportlab.platypus import PageBreak
from reportlab.platypus.tableofcontents import TableOfContents

from scripts import build_pdf


def test_default_pdf_is_generated_outside_tracked_document_tree() -> None:
    assert build_pdf.default_output() == (
        build_pdf.ROOT / "output" / "pdf" / "eval-harness-internals-cn.pdf"
    )


def test_windows_font_candidates_follow_system_root(
    monkeypatch,
) -> None:
    monkeypatch.setenv("SystemRoot", str(Path("system-root")))

    candidates = build_pdf.font_candidates()

    assert candidates[0] == (
        Path("system-root") / "Fonts" / "msyh.ttc",
        Path("system-root") / "Fonts" / "msyhbd.ttc",
    )


def test_printed_toc_contains_chapter_titles_only() -> None:
    assert build_pdf.include_in_printed_toc(0) is True
    assert build_pdf.include_in_printed_toc(1) is False
    assert build_pdf.include_in_printed_toc(2) is False


def test_markdown_renderer_consumes_button_attribute_list() -> None:
    rendered = build_pdf.render_markdown("[开始](start.md){ .md-button }")
    soup = BeautifulSoup(rendered, "html.parser")

    assert soup.get_text() == "开始"
    assert soup.a is not None
    assert soup.a.get("class") == ["md-button"]


def test_ordered_and_unordered_lists_render_with_valid_bullets(tmp_path: Path) -> None:
    chapter = tmp_path / "chapter.md"
    chapter.write_text(
        "# 列表\n\n1. 第一项\n2. 第二项\n\n- 要点甲\n- 要点乙\n",
        encoding="utf-8",
    )
    output = tmp_path / "ordered-list.pdf"

    toc = TableOfContents()
    toc.levelStyles = [build_pdf.STYLES["TOC1"]]
    story = [toc, PageBreak(), *build_pdf.markdown_story(chapter)]

    build_pdf.BookDocTemplate(str(output)).multiBuild(story)

    assert output.is_file()
    assert output.stat().st_size > 0


def test_svg_diagram_embeds_chinese_labels_in_pdf(tmp_path: Path) -> None:
    drawing = build_pdf.diagram(
        build_pdf.DOCS / "assets" / "diagrams" / "swe-bench-mechanism.svg"
    )
    assert drawing is not None
    output = tmp_path / "diagram.pdf"

    build_pdf.BookDocTemplate(str(output)).build([drawing])

    text = PdfReader(output).pages[0].extract_text()
    assert "问题实例" in text
    assert "实例级判定" in text
