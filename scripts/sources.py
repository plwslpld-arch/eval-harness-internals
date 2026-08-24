"""锁定并核对上游 Eval Harness 源码来源。"""

from __future__ import annotations

import argparse
import re
import subprocess
from pathlib import Path
from typing import Any

import yaml


COMMIT_PATTERN = re.compile(r"^[0-9a-f]{40}$")
REQUIRED_SOURCE_FIELDS = (
    "id",
    "course",
    "repo",
    "url",
    "branch",
    "license",
    "license_file",
    "redistribution",
    "scope",
)


class SourceRegistryError(ValueError):
    """来源注册表或锁文件不满足证据合同。"""


def _mapping(value: object, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise SourceRegistryError(f"{label} 必须是映射")
    return value


def _source_list(payload: dict[str, Any], label: str) -> list[dict[str, Any]]:
    if payload.get("version") != 1:
        raise SourceRegistryError(f"{label}.version 必须为 1")
    sources = payload.get("sources")
    if not isinstance(sources, list) or not sources:
        raise SourceRegistryError(f"{label}.sources 必须是非空列表")
    return [_mapping(source, f"{label}.sources[{index}]") for index, source in enumerate(sources)]


def validate_registry(payload: dict[str, Any]) -> list[dict[str, Any]]:
    sources = _source_list(_mapping(payload, "registry"), "registry")
    seen: set[str] = set()
    for index, source in enumerate(sources):
        label = f"registry.sources[{index}]"
        for field in REQUIRED_SOURCE_FIELDS:
            if field not in source:
                raise SourceRegistryError(f"{label} 缺少 {field}")
        source_id = source["id"]
        if not isinstance(source_id, str) or not source_id:
            raise SourceRegistryError(f"{label}.id 必须是非空字符串")
        if source_id in seen:
            raise SourceRegistryError(f"source id 重复：{source_id}")
        seen.add(source_id)
        for field in REQUIRED_SOURCE_FIELDS[1:-1]:
            if not isinstance(source[field], str) or not source[field]:
                raise SourceRegistryError(f"{label}.{field} 必须是非空字符串")
        scope = source["scope"]
        if not isinstance(scope, list) or not scope:
            raise SourceRegistryError(f"{label}.scope 必须是非空列表")
        scope_paths: set[str] = set()
        for scope_index, raw_item in enumerate(scope):
            item = _mapping(raw_item, f"{label}.scope[{scope_index}]")
            for field in ("path", "purpose"):
                if not isinstance(item.get(field), str) or not item[field]:
                    raise SourceRegistryError(
                        f"{label}.scope[{scope_index}].{field} 必须是非空字符串"
                    )
            if item["path"] in scope_paths:
                raise SourceRegistryError(f"{label}.scope path 重复：{item['path']}")
            scope_paths.add(item["path"])
    return sources


def validate_lock(
    registry_payload: dict[str, Any], lock_payload: dict[str, Any]
) -> list[dict[str, Any]]:
    registry_sources = validate_registry(registry_payload)
    lock_sources = _source_list(_mapping(lock_payload, "lock"), "lock")
    registry_by_id = {source["id"]: source for source in registry_sources}
    lock_ids = [source.get("id") for source in lock_sources]
    if len(lock_ids) != len(set(lock_ids)):
        raise SourceRegistryError("lock source id 重复")
    if set(lock_ids) != set(registry_by_id):
        raise SourceRegistryError("lock 与 registry 的 source id 不一致")
    for source in lock_sources:
        source_id = source["id"]
        registry = registry_by_id[source_id]
        commit = source.get("commit")
        if not isinstance(commit, str) or not COMMIT_PATTERN.fullmatch(commit):
            raise SourceRegistryError(f"{source_id}.commit 必须是 40 位小写十六进制")
        for field in ("repo", "license", "license_file"):
            if source.get(field) != registry[field]:
                raise SourceRegistryError(f"{source_id}.{field} 与 registry 不一致")
        expected_scope = [item["path"] for item in registry["scope"]]
        if source.get("scope_paths") != expected_scope:
            raise SourceRegistryError(f"{source_id}.scope_paths 与 registry.scope 不一致")
    return lock_sources


def build_permalink(lock_source: dict[str, Any], path: str) -> str:
    if path not in lock_source.get("scope_paths", []):
        raise SourceRegistryError(f"路径不在锁定 scope 中：{path}")
    return (
        f"https://github.com/{lock_source['repo']}/blob/"
        f"{lock_source['commit']}/{path}"
    )


def load_yaml(path: Path) -> dict[str, Any]:
    return _mapping(yaml.safe_load(path.read_text(encoding="utf-8")), str(path))


def resolve_branch(url: str, branch: str) -> str:
    process = subprocess.run(
        ["git", "ls-remote", url, f"refs/heads/{branch}"],
        check=False,
        capture_output=True,
        text=True,
        shell=False,
    )
    if process.returncode != 0:
        raise SourceRegistryError(process.stderr.strip() or f"无法读取远端：{url}")
    fields = process.stdout.strip().split()
    if len(fields) != 2 or not COMMIT_PATTERN.fullmatch(fields[0]):
        raise SourceRegistryError(f"远端分支不存在或返回值无效：{url}#{branch}")
    return fields[0]


def create_lock(registry_payload: dict[str, Any]) -> dict[str, Any]:
    sources = validate_registry(registry_payload)
    return {
        "version": 1,
        "sources": [
            {
                "id": source["id"],
                "repo": source["repo"],
                "commit": resolve_branch(source["url"], source["branch"]),
                "license": source["license"],
                "license_file": source["license_file"],
                "scope_paths": [item["path"] for item in source["scope"]],
            }
            for source in sources
        ],
    }


def _write_yaml(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        yaml.safe_dump(payload, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="锁定并核对上游源码来源")
    parser.add_argument("command", choices=("lock", "verify", "links"))
    parser.add_argument("--registry", type=Path, default=Path("sources/sources.yml"))
    parser.add_argument("--lock", type=Path, default=Path("sources/sources.lock.yml"))
    args = parser.parse_args()
    registry = load_yaml(args.registry)
    if args.command == "lock":
        lock = create_lock(registry)
        _write_yaml(args.lock, lock)
        print(f"已锁定 {len(lock['sources'])} 个上游来源：{args.lock}")
        return 0
    lock = load_yaml(args.lock)
    sources = validate_lock(registry, lock)
    if args.command == "verify":
        print(f"来源锁文件有效：{len(sources)} 个来源")
        return 0
    for source in sources:
        for path in source["scope_paths"]:
            print(build_permalink(source, path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

