"""把外部 Agent JSONL Trace 作为只读 Target 观测导入。"""

from __future__ import annotations

from pathlib import Path

from ..models import TraceEvent, Trial
from .base import TargetResult


class AgentTraceImportTarget:
    """验证事件身份与父子关系，并暴露可评分的最终输出。"""

    def __init__(self, trace_path: Path) -> None:
        self._trace_path = trace_path

    def run(self, trial: Trial) -> TargetResult:
        del trial
        events: list[TraceEvent] = []
        seen: set[str] = set()
        for line_number, line in enumerate(
            self._trace_path.read_text(encoding="utf-8").splitlines(), 1
        ):
            if not line.strip():
                continue
            try:
                event = TraceEvent.model_validate_json(line)
            except ValueError as error:
                raise ValueError(f"Agent Trace 第 {line_number} 行无效：{error}") from error
            if event.event_id in seen:
                raise ValueError(f"Agent Trace event_id 重复：{event.event_id}")
            if event.sequence != len(events) + 1:
                raise ValueError("Agent Trace sequence 必须从 1 连续递增")
            if event.parent_event_id is not None and event.parent_event_id not in seen:
                raise ValueError(
                    f"Agent Trace parent_event_id 不存在：{event.parent_event_id}"
                )
            seen.add(event.event_id)
            events.append(event)
        if not events:
            raise ValueError("Agent Trace 不能为空")

        final_output: dict[str, object] = {}
        for event in reversed(events):
            candidate = event.payload.get("output")
            if isinstance(candidate, dict):
                final_output = candidate
                break
        return TargetResult(
            kind="completed",
            output={
                "trace_event_count": len(events),
                "trace_types": [event.type for event in events],
                "final_output": final_output,
            },
        )
