from __future__ import annotations

import json
import sys


request = json.load(sys.stdin)
decision = "escalate" if request["amount"] > 500 and not request["approved"] else "refund"
print(json.dumps({"decision": decision}, ensure_ascii=False))
