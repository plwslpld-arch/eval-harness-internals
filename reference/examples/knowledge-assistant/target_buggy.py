from __future__ import annotations

import json
import sys


request = json.load(sys.stdin)
print(json.dumps({"answer": request["fact"]}, ensure_ascii=False))
