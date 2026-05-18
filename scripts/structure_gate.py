"""Structure-verify gate (AC-CD2 / AC-CD17, CODE_SPEC §3).

Two checks:

1. Every path in the CODE_SPEC §3 layout exists.
2. ``app/main.py`` stays *setup-only*. "Setup-only" means: no imports
   from ``app.domain`` / ``app.models`` / ``app.ai``, and no direct
   DB/ORM/Celery imports — i.e. no business logic. Router includes ARE
   permitted (wired from P2 onward), so ``app.routers`` is NOT
   forbidden.

Exit non-zero on any violation. Run in CI and as a pytest test.
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

_ROUTERS = [
    "auth",
    "users",
    "groups",
    "catalogue",
    "paths",
    "tests",
    "assignments",
    "attempts",
    "grading",
    "review",
    "loop",
    "competency",
    "calibration",
    "rag",
    "admin",
    "cost",
    "internal",
]
_DOMAIN = [
    "calibration",
    "competence",
    "ngram",
    "streaming",
    "drive_rag",
    "bootstrap",
    "safety_links",
    "engagement",
]

REQUIRED_PATHS: list[str] = [
    "app/__init__.py",
    "app/main.py",
    "app/config.py",
    "app/models.py",
    "app/schemas.py",
    "app/permissions.py",
    "app/worker.py",
    "app/beat_schedule.py",
    "app/routers/__init__.py",
    *(f"app/routers/{m}.py" for m in _ROUTERS),
    "app/ai/__init__.py",
    "app/ai/provider.py",
    "app/ai/anthropic.py",
    "app/ai/openai.py",
    "app/ai/cost.py",
    "app/ai/prompts",
    "app/domain/__init__.py",
    *(f"app/domain/{m}.py" for m in _DOMAIN),
    "alembic/env.py",
    "alembic/versions",
    "alembic.ini",
    "infra/postgres/init.sql",
    "infra/traefik",
    "tests/conftest.py",
    "tests/unit",
    "tests/integration",
    "tests/e2e",
    "Dockerfile",
    "docker-compose.yml",
    "requirements.txt",
    "requirements-worker.txt",
    ".env.example",
]

FORBIDDEN_MAIN_IMPORT_PREFIXES = (
    "app.domain",
    "app.models",
    "app.ai",
    "app.worker",
    "sqlalchemy",
    "asyncpg",
    "psycopg",
    "celery",
    "alembic",
)


def check_paths() -> list[str]:
    return [p for p in REQUIRED_PATHS if not (ROOT / p).exists()]


def _is_forbidden(name: str) -> bool:
    return name.startswith(FORBIDDEN_MAIN_IMPORT_PREFIXES)


def check_main_setup_only() -> list[str]:
    main = ROOT / "app" / "main.py"
    tree = ast.parse(main.read_text())
    bad: list[str] = []
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.ImportFrom)
            and node.module
            and _is_forbidden(node.module)
        ):
            bad.append(f"app/main.py imports forbidden module: {node.module}")
        elif isinstance(node, ast.Import):
            for alias in node.names:
                if _is_forbidden(alias.name):
                    bad.append(f"app/main.py imports forbidden module: {alias.name}")
    return bad


def main() -> int:
    problems = [f"missing path: {p}" for p in check_paths()]
    problems += check_main_setup_only()
    if problems:
        print("STRUCTURE GATE FAILED:")
        for p in problems:
            print(f"  - {p}")
        return 1
    print("structure gate: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
