"""追加写入且保持父子因果关系的 JSONL Trace。"""

from __future__ import annotations

import json
from pathlib import Path

from .models import TraceEvent


class TraceWriter:
    def __init__(self, path: Path) -> None:
        self._path = path
        self._seen_ids: set[str] = set()
        self._last_sequence = 0

    def append(self, event: TraceEvent) -> None:
        if event.event_id in self._seen_ids:
            raise ValueError(f"重复 Trace event_id：{event.event_id}")
        if event.parent_event_id and event.parent_event_id not in self._seen_ids:
            raise ValueError(f"父事件尚未写入：{event.parent_event_id}")
        if event.sequence <= self._last_sequence:
            raise ValueError("Trace sequence 必须严格递增")

        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._path.open("a", encoding="utf-8", newline="\n") as stream:
            stream.write(json.dumps(event.model_dump(mode="json"), ensure_ascii=False))
            stream.write("\n")
        self._seen_ids.add(event.event_id)
        self._last_sequence = event.sequence
