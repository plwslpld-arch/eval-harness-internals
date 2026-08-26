#!/usr/bin/env python3
"""核对文档里的行号锚点，确认它真的指向声称的那段代码。

`sources.py verify` 只保证 commit 是锁定的、链接能拼出来；它不回答「#L429 那几行
到底是不是 evaluate()」。上游改一次实现，行号就会漂，而链接照样能打开——读者点进去
看到的是无关代码，比没有行号更糟。

判断依据是链接文字。文字里点名了符号，就要求那个符号出现在锚点区间内：

    [`Instance.args`](…/api/instance.py#L31-L38)   -> 取 args（点分名指代最后一段）
    [`run_instances()`](…/run_evaluation.py#L432)  -> 取 run_instances
    [`api/model.py`](…/api/model.py#L40-L100)      -> 文件名，无指代，跳过

用法：
    python scripts/verify_anchors.py           # 核对全部
    python scripts/verify_anchors.py docs/cases  # 只核对某个目录
"""
from __future__ import annotations

import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(os.environ.get("ANCHOR_CACHE", ROOT / ".cache" / "upstream"))
LINK = re.compile(
    r"\[([^\]]+)\]\(https://github\.com/([^/\s)]+/[^/\s)]+)/blob/([0-9a-f]{40})/([^\s)#]+)"
    r"#L(\d+)(?:-L(\d+))?\)"
)


def fetch(repo: str, commit: str, path: str) -> list[str] | None:
    key = CACHE / f"{repo.replace('/', '_')}__{commit[:8]}__{path.replace('/', '_')}"
    if not key.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        url = f"https://raw.githubusercontent.com/{repo}/{commit}/{path}"
        request = urllib.request.Request(url)
        token = os.environ.get("GITHUB_TOKEN")
        if token:
            request.add_header("Authorization", f"Bearer {token}")
        try:
            key.write_bytes(urllib.request.urlopen(request, timeout=60).read())
        except Exception as exc:                     # noqa: BLE001
            print(f"  ! 无法读取 {repo}/{path}: {exc}")
            return None
    return key.read_text(encoding="utf-8", errors="ignore").split("\n")


def symbol_of(label: str) -> str | None:
    """链接文字点名的符号；文件名型链接没有指代，返回 None。"""
    match = re.search(r"`([^`]+)`", label)
    if not match:
        return None
    raw = match.group(1).split("(")[0].strip()
    if "/" in raw or raw.endswith((".py", ".ts", ".js", ".rs")):
        return None
    symbol = raw.split(".")[-1]
    return symbol if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{2,}", symbol) else None


def main(targets: list[str]) -> int:
    roots = [ROOT / t for t in targets] if targets else [ROOT / "docs"]
    ok = bad = skipped = 0
    for root in roots:
        for doc in sorted(root.rglob("*.md")):
            for m in LINK.finditer(doc.read_text(encoding="utf-8")):
                label, repo, commit, path = m.group(1), m.group(2), m.group(3), m.group(4)
                start, end = int(m.group(5)), int(m.group(6) or m.group(5))
                symbol = symbol_of(label)
                if symbol is None:
                    skipped += 1
                    continue
                lines = fetch(repo, commit, path)
                if lines is None:
                    skipped += 1
                    continue
                where = f"{doc.relative_to(ROOT)} -> {path}#L{start}-L{end}"
                if end > len(lines):
                    print(f"  ✗ {where} 越界（该文件 {len(lines)} 行）")
                    bad += 1
                elif symbol in "\n".join(lines[start - 1:end]):
                    ok += 1
                else:
                    print(f"  ✗ {where} 区间内找不到「{symbol}」")
                    bad += 1
    print(f"\n锚点核对：{ok} 命中，{bad} 不符，{skipped} 跳过（文件名型链接无指代符号）")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
