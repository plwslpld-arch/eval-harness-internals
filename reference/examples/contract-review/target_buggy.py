from __future__ import annotations

import json
import sys


request = json.load(sys.stdin)
print(json.dumps({"risk_band": "low" if "书面" in request["clause"] else "medium"}, ensure_ascii=False))
