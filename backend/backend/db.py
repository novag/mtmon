"""Database engine and helpers for the backend service."""

import os
from typing import TYPE_CHECKING

from sqlalchemy import event
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

if TYPE_CHECKING:
    from sqlalchemy.pool import ConnectionPoolEntry


def _build_database_url() -> str:
    """Build the SQLAlchemy async database URL from DB_PATH.

    Only `DB_PATH` is supported (relative or absolute). Default: "data/nodes.db".
    """
    db_path = os.environ.get("DB_PATH", "data/nodes.db")
    return f"sqlite+aiosqlite:///{db_path}"


DATABASE_URL = _build_database_url()

engine = create_async_engine(DATABASE_URL)
async_session = async_sessionmaker(engine, expire_on_commit=False)


@event.listens_for(engine.sync_engine, "connect")
def do_connect(
    dbapi_connection: Connection,
    _connection_record: "ConnectionPoolEntry",
) -> None:
    """Configure SQLite connection on connect.

    - Disable implicit BEGIN/COMMIT emitted by aiosqlite
    - Enable WAL mode for better concurrent writes
    """
    dbapi_connection.isolation_level = None

    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.close()


@event.listens_for(engine.sync_engine, "begin")
def do_begin(conn: "Connection") -> None:
    """Emit an explicit BEGIN for each transaction."""
    conn.exec_driver_sql("BEGIN")
