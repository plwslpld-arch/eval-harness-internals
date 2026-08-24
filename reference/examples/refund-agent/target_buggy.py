from __future__ import annotations

import json
import sys


request = json.load(sys.stdin)
print(json.dumps({"decision": "refund"}, ensure_ascii=False))
