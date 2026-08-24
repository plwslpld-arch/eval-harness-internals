"""为评测规范和证据生成稳定内容身份。"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from pydantic import BaseModel


def canonical_digest(value: BaseModel | dict[str, Any]) -> str:
    """返回不受字典键顺序影响的 SHA-256 内容摘要。"""

    payload = value.model_dump(mode="json") if isinstance(value, BaseModel) else value
    encoded = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return f"sha256:{hashlib.sha256(encoded).hexdigest()}"
