from __future__ import annotations

import json
import sys


request = json.load(sys.stdin)
amount = request["amount"]
print(json.dumps({"fee": 0 if amount >= 100 else 10}, ensure_ascii=False))
