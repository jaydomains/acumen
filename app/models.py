"""SQLAlchemy 2.0 declarative base — single ``acumen`` schema.

P0 ships the ``Base`` / schema-scoped ``MetaData`` only. Every SPEC §5
entity + supporting table (CODE_SPEC §4 mapping) is defined here in P1.
AC-CD3, AC-CD4.
"""

from __future__ import annotations

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


class Base(DeclarativeBase):
    metadata = MetaData(schema=get_settings().db_schema)
