"""通过安全 argv 调用本地子进程 Target。"""

from __future__ import annotations

import json
import os
import subprocess
from collections.abc import Sequence

from ..models import Trial
from .base import InfrastructureError, TargetResult


class SubprocessTarget:
    def __init__(self, argv: Sequence[str], *, timeout_seconds: float) -> None:
        if isinstance(argv, (str, bytes)) or not argv:
            raise TypeError("argv 必须是非空字符串序列，禁止使用 shell 命令字符串")
        if not all(isinstance(item, str) and item for item in argv):
            raise TypeError("argv 中的每一项都必须是非空字符串")
        if timeout_seconds <= 0:
            raise ValueError("timeout_seconds 必须大于 0")
        self._argv = tuple(argv)
        self._timeout_seconds = timeout_seconds

    def run(self, trial: Trial) -> TargetResult:
        try:
            child_env = os.environ.copy()
            child_env["PYTHONIOENCODING"] = "utf-8"
            completed = subprocess.run(
                self._argv,
                input=json.dumps(trial.sample.input, ensure_ascii=False),
                capture_output=True,
                check=False,
                encoding="utf-8",
                env=child_env,
                shell=False,
                timeout=self._timeout_seconds,
            )
        except subprocess.TimeoutExpired as error:
            raise InfrastructureError("target_timeout") from error
        except OSError as error:
            raise InfrastructureError("target_process_start_failed", str(error)) from error

        stdout = completed.stdout.strip()
        stderr = completed.stderr.strip()
        if completed.returncode != 0:
            return TargetResult(
                kind="product_failure",
                output={
                    "exit_code": completed.returncode,
                    "stdout": stdout,
                    "stderr": stderr,
                },
            )
        try:
            output = json.loads(stdout)
        except json.JSONDecodeError:
            return TargetResult(
                kind="product_failure",
                output={"error": "target_output_not_json", "stdout": stdout},
            )
        if not isinstance(output, dict):
            return TargetResult(
                kind="product_failure",
                output={"error": "target_output_not_object", "value": output},
            )
        return TargetResult(kind="completed", output=output)
