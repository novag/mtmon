"""Custom SQLAlchemy types used by the backend."""

from datetime import UTC, datetime

from sqlalchemy import DateTime, TypeDecorator
from sqlalchemy.engine.interfaces import Dialect


class UtcDateTime(TypeDecorator):
    """DateTime type that ensures storage and retrieval as UTC."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(
        self, value: datetime | None, _dialect: Dialect
    ) -> datetime | None:
        """Normalize bound datetimes to UTC before storage."""
        if value is None:
            return value

        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        else:
            value = value.astimezone(UTC)

        return value

    def process_result_value(
        self, value: datetime | None, _dialect: Dialect
    ) -> datetime | None:
        """Attach UTC tzinfo to retrieved naive datetimes."""
        if value is not None:
            return value.replace(tzinfo=UTC)

        return value
