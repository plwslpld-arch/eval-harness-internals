from __future__ import annotations

from copy import deepcopy
from pathlib import Path

import pytest

from scripts.sources import (
    SourceRegistryError,
    build_permalink,
    load_yaml,
    validate_lock,
    validate_registry,
)


REPO_ROOT = Path(__file__).resolve().parents[1]


def registry_fixture() -> dict[str, object]:
    return {
        "version": 1,
        "sources": [
            {
                "id": "demo",
                "course": "demo-course",
                "repo": "example/demo",
                "url": "https://github.com/example/demo",
                "branch": "main",
                "license": "MIT",
                "license_file": "LICENSE",
                "redistribution": "link-only",
                "scope": [
                    {"path": "src/runner.py", "purpose": "运行入口"},
                ],
            }
        ],
    }


def lock_fixture() -> dict[str, object]:
    return {
        "version": 1,
        "sources": [
            {
                "id": "demo",
                "repo": "example/demo",
                "commit": "a" * 40,
                "license": "MIT",
                "license_file": "LICENSE",
                "scope_paths": ["src/runner.py"],
            }
        ],
    }


@pytest.mark.parametrize("field", ["license", "license_file", "scope"])
def test_registry_rejects_missing_evidence_boundary(field: str) -> None:
    registry = registry_fixture()
    del registry["sources"][0][field]  # type: ignore[index]

    with pytest.raises(SourceRegistryError, match=field):
        validate_registry(registry)


def test_registry_rejects_duplicate_source_id() -> None:
    registry = registry_fixture()
    registry["sources"].append(deepcopy(registry["sources"][0]))  # type: ignore[union-attr,index]

    with pytest.raises(SourceRegistryError, match="重复"):
        validate_registry(registry)


def test_lock_requires_full_commit_and_exact_scope() -> None:
    registry = registry_fixture()
    lock = lock_fixture()
    lock["sources"][0]["commit"] = "abc123"  # type: ignore[index]

    with pytest.raises(SourceRegistryError, match="40 位"):
        validate_lock(registry, lock)

    lock = lock_fixture()
    lock["sources"][0]["scope_paths"] = ["README.md"]  # type: ignore[index]
    with pytest.raises(SourceRegistryError, match="scope"):
        validate_lock(registry, lock)


def test_permalink_uses_locked_commit_not_branch() -> None:
    link = build_permalink(lock_fixture()["sources"][0], "src/runner.py")  # type: ignore[index]

    assert link == f"https://github.com/example/demo/blob/{'a' * 40}/src/runner.py"
    assert "/main/" not in link


def test_committed_registry_and_lock_cover_the_approved_corpus() -> None:
    registry = load_yaml(REPO_ROOT / "sources" / "sources.yml")
    lock = load_yaml(REPO_ROOT / "sources" / "sources.lock.yml")

    locked = validate_lock(registry, lock)

    assert {source["id"] for source in locked} == {
        "lm-evaluation-harness",
        "inspect-ai",
        "openai-evals",
        "promptfoo",
        "deepeval",
        "harbor",
        "terminal-bench-1",
        "swe-bench",
    }
    for source in locked:
        for path in source["scope_paths"]:
            link = build_permalink(source, path)
            assert source["commit"] in link
            assert source["repo"] in link
