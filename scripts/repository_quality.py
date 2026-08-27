from __future__ import annotations

import json
import argparse
import re
from pathlib import Path
from typing import Iterable

import yaml


IGNORED_PARTS = {
    ".git",
    ".pytest_cache",
    ".tmp",
    ".venv",
    ".worktrees",
    "__pycache__",
    "dist",
    "node_modules",
    "output",
    "site",
}
LEGACY_PATHS = (
    ".nvmrc",
    "README.zh-CN.md",
    "START_HERE.md",
    "academy",
    "handoffs",
    "package-lock.json",
    "package.json",
    "progress",
    "test",
)
REQUIRED_PATHS = (
    "AGENTS.md",
    "CODE_OF_CONDUCT.md",
    "CONTRIBUTING.md",
    "LICENSE",
    "LICENSE-DOCS",
    "NOTICE.md",
    "README.md",
    "SECURITY.md",
    "THIRD_PARTY.md",
    "mkdocs.yml",
    "pyproject.toml",
    "docs/00-start-here.md",
    "docs/contents.md",
    "docs/appendices/verification.md",
)
PUBLIC_TEXT_SUFFIXES = {
    ".css",
    ".html",
    ".md",
    ".py",
    ".svg",
    ".toml",
    ".txt",
    ".yaml",
    ".yml",
}
MARKDOWN_LINK = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
WINDOWS_ABSOLUTE_PATH = re.compile(r"(?<![A-Za-z0-9])(?:[A-Za-z]:[/\\])")
UNIX_LOCAL_PATH = re.compile(r"(?<![A-Za-z0-9])/(?:Users|home)/[^\s)`'\"]+")
SECRET_PATTERNS = (
    re.compile(r"\bsk-[A-Za-z0-9_-]{16,}"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
)


def _iter_files(root: Path, suffixes: set[str] | None = None) -> Iterable[Path]:
    for path in sorted(root.rglob("*")):
        if not path.is_file() or any(part in IGNORED_PARTS for part in path.parts):
            continue
        if "sources" in path.parts and "checkouts" in path.parts:
            continue
        if suffixes is None or path.suffix.lower() in suffixes:
            yield path


def _relative(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def markdown_link_violations(root: Path) -> list[str]:
    violations: list[str] = []
    for path in _iter_files(root, {".md"}):
        text = path.read_text(encoding="utf-8")
        for raw_target in MARKDOWN_LINK.findall(text):
            target = raw_target.strip().strip("<>")
            if target.startswith(("#", "http://", "https://", "mailto:")):
                continue
            clean = target.split("#", 1)[0].split("?", 1)[0]
            if not clean:
                continue
            resolved = (path.parent / clean).resolve()
            # 离线 PDF 由 CI 在构建站点前生成，不进主干；站点里这条相对链接是有效的。
            if resolved.is_relative_to(root / "docs" / "downloads"):
                continue
            if not resolved.exists():
                violations.append(
                    f"{_relative(path, root)}: 本地链接不存在: {raw_target}"
                )
    return violations


def svg_safety_violations(root: Path) -> list[str]:
    checks = {
        "包含 script": re.compile(r"<\s*script\b", re.IGNORECASE),
        "包含 foreignObject": re.compile(r"<\s*foreignObject\b", re.IGNORECASE),
        "包含事件处理器": re.compile(r"\son[a-z]+\s*=", re.IGNORECASE),
        "引用外部资源": re.compile(
            r"(?:href|xlink:href)\s*=\s*['\"]\s*(?:https?:)?//",
            re.IGNORECASE,
        ),
    }
    violations: list[str] = []
    for path in _iter_files(root, {".svg"}):
        text = path.read_text(encoding="utf-8")
        for label, pattern in checks.items():
            if pattern.search(text):
                violations.append(f"{_relative(path, root)}: {label}")
    return violations


def _public_text_violations(root: Path) -> list[str]:
    violations: list[str] = []
    for path in _iter_files(root, PUBLIC_TEXT_SUFFIXES):
        relative = _relative(path, root)
        text = path.read_text(encoding="utf-8")
        is_public_prose = relative.startswith("docs/") or (
            "/" not in relative and path.suffix.lower() == ".md"
        )
        if is_public_prose:
            if WINDOWS_ABSOLUTE_PATH.search(text) or UNIX_LOCAL_PATH.search(text):
                violations.append(f"{relative}: 包含本机绝对路径")
        if not relative.startswith("tests/") and relative != "scripts/repository_quality.py":
            for pattern in SECRET_PATTERNS:
                if pattern.search(text):
                    violations.append(f"{relative}: 疑似包含凭据")
                    break
        if relative.startswith("docs/assets/diagrams/") and not re.search(
            r"[\u3400-\u9fff]", text
        ):
            violations.append(f"{relative}: 正式图示缺少中文标签")
    return violations


def _mkdocs_navigation_violations(root: Path) -> list[str]:
    config_path = root / "mkdocs.yml"
    if not config_path.exists():
        return []
    config = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    entries: set[str] = set()

    def walk(value: object) -> None:
        if isinstance(value, str) and value.endswith(".md"):
            entries.add(value)
        elif isinstance(value, list):
            for item in value:
                walk(item)
        elif isinstance(value, dict):
            for item in value.values():
                walk(item)

    walk(config.get("nav", []))
    core_dirs = {
        "appendices",
        "cases",
        "comparisons",
        "engineering",
        "foundations",
        "harnesses",
        "labs",
    }
    core_docs = {
        path.relative_to(root / "docs").as_posix()
        for path in _iter_files(root / "docs", {".md"})
        if path.relative_to(root / "docs").parts[0] in core_dirs
    }
    return [f"mkdocs.yml: 导航缺少 {path}" for path in sorted(core_docs - entries)]


def _repository_metadata_violations(root: Path) -> list[str]:
    """GitHub About 的唯一真相在 .github/repository-metadata.yml。

    两个仓库是一对：agent 讲「模型的意图怎样变成真实动作」，本仓库讲「动作做完之后
    谁来判定它做对了」。读者从任一侧都要能走到另一侧，所以姊妹仓库写进元数据并在这里
    校验，README 也必须真的链接过去——否则声明只是摆设，改一边忘另一边不会有人发现。
    """
    path = root / ".github" / "repository-metadata.yml"
    if not path.exists():
        return ["缺少 .github/repository-metadata.yml"]
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return [f".github/repository-metadata.yml 不是合法 JSON: {exc}"]

    out: list[str] = []
    han = re.compile(r"[\u4e00-\u9fff]")
    if data.get("name") != "eval-harness-internals":
        out.append("元数据仓库名必须是 eval-harness-internals")
    about = data.get("about")
    if not isinstance(about, str) or not han.search(about):
        out.append("必须提供中文 About")
    elif len(about) > 160:
        out.append("中文 About 不能超过 160 个字符")
    if data.get("homepage") != "https://plwslpld-arch.github.io/eval-harness-internals/":
        out.append("About 必须填本仓库的 Pages 地址")

    topics = data.get("topics")
    if not isinstance(topics, list):
        out.append("Topics 必须是数组")
    else:
        for topic in topics:
            if not isinstance(topic, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,49}", topic):
                out.append(f"Topic 非法：{topic}")
        # 与姊妹仓库共用的检索面，缺一条两个仓库就不再是一对。
        for topic in ("eval-harness", "source-code-analysis", "chinese", "llm"):
            if topic not in topics:
                out.append(f"缺少核心 Topic：{topic}")

    sibling = data.get("sibling")
    if not isinstance(sibling, dict):
        out.append("必须声明姊妹仓库")
    else:
        if sibling.get("repo") != "plwslpld-arch/agent-harness-internals":
            out.append("姊妹仓库必须是 agent-harness-internals")
        if not isinstance(sibling.get("name"), str) or not han.search(sibling.get("name", "")):
            out.append("姊妹仓库必须有中文名称")
        for key in ("url", "site"):
            value = sibling.get(key)
            if not isinstance(value, str) or not value.startswith("https://"):
                out.append(f"姊妹仓库缺少 {key}")

    readme = root / "README.md"
    if readme.exists() and "plwslpld-arch/agent-harness-internals" not in readme.read_text(encoding="utf-8"):
        out.append("README 必须链接姊妹仓库")
    return out


def _quote_style_violations(root: Path) -> list[str]:
    """中文正文统一用「」。

    ASCII 的弯引号在中文里既不是标准用法，也和代码里的字符串引号混淆。
    姊妹仓库早有这条门禁，本仓库一直没有，实测积累了 202 处。
    代码块与行内代码保持原样，英文原文里的引号不受影响。
    """
    out: list[str] = []
    for path in sorted(root.joinpath("docs").rglob("*.md")):
        if "assets" in str(path):
            continue
        text = path.read_text(encoding="utf-8")
        text = re.sub(r"```.*?```", "", text, flags=re.S)
        text = re.sub(r"`[^`\n]*`", "", text)
        hits = text.count("\u201c") + text.count("\u201d")
        if hits:
            out.append(f"{path.relative_to(root)}: {hits} 处 ASCII 引号，中文正文请用「」")
    return out


def collect_repository_violations(root: Path) -> list[str]:
    root = root.resolve()
    violations: list[str] = []
    for relative in LEGACY_PATHS:
        if (root / relative).exists():
            violations.append(f"遗留路径仍存在: {relative}")
    for relative in REQUIRED_PATHS:
        if not (root / relative).exists():
            violations.append(f"必需文件缺失: {relative}")

    readme = (root / "README.md").read_text(encoding="utf-8") if (root / "README.md").exists() else ""
    for forbidden in ("Contributors", "encode-studio-fe"):
        if forbidden in readme:
            violations.append(f"README.md: 不应出现 {forbidden}")

    violations.extend(markdown_link_violations(root))
    violations.extend(svg_safety_violations(root))
    violations.extend(_public_text_violations(root))
    violations.extend(_mkdocs_navigation_violations(root))
    violations.extend(_repository_metadata_violations(root))
    violations.extend(_quote_style_violations(root))
    return sorted(set(violations))


def main() -> int:
    parser = argparse.ArgumentParser(description="核对仓库发布质量合同")
    parser.add_argument("root", nargs="?", type=Path, default=Path(__file__).parents[1])
    args = parser.parse_args()
    violations = collect_repository_violations(args.root)
    if violations:
        print("仓库质量检查失败：")
        for violation in violations:
            print(f"- {violation}")
        return 1
    print("仓库质量检查通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
