from __future__ import annotations

import json
import sys


request = json.load(sys.stdin)
allowed = request["document_acl"] == "public" or request["role"] == request["document_acl"]
print(json.dumps({"answer": request["fact"] if allowed else "拒绝访问"}, ensure_ascii=False))
