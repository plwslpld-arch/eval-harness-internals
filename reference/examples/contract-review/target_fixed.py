from __future__ import annotations

import json
import sys


request = json.load(sys.stdin)
clause = request["clause"]
risk = "high" if "无限责任" in clause else "medium" if "责任上限" in clause else "low"
print(json.dumps({"risk_band": risk}, ensure_ascii=False))
