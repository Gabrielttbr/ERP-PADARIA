from datetime import datetime
from sqlalchemy import DateTime
from sqlalchemy.orm import mapped_column, MappedColumn
from app.database import Base  # noqa: F401 – re-exported for convenience
from app.utils.tempo import agora


class TimestampMixin:
    created_at: MappedColumn[datetime] = mapped_column(
        DateTime, nullable=False, default=agora
    )
    updated_at: MappedColumn[datetime] = mapped_column(
        DateTime, nullable=False, default=agora, onupdate=agora
    )


class SoftDeleteMixin:
    deleted_at: MappedColumn[datetime | None] = mapped_column(
        DateTime, nullable=True, default=None
    )
