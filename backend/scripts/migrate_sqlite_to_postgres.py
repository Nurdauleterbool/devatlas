"""One-time SQLite -> PostgreSQL import into an empty migrated schema.

From backend/:
  DEVATLAS_DATABASE_URL='postgresql+psycopg://...' python -m alembic upgrade head
  DEVATLAS_DATABASE_URL='postgresql+psycopg://...' python scripts/migrate_sqlite_to_postgres.py --sqlite ./devatlas.db

Stop both applications first and back up SQLite before migrating.
"""
from __future__ import annotations
import argparse
import os
from pathlib import Path
from sqlalchemy import func, insert, inspect, select
from app import models  # noqa: F401 - register SQLAlchemy metadata
from app.db import Base, make_engine, normalize_url


def transfer_data(source_engine, target_engine) -> dict[str, int]:
    """Insert rows in FK order; reject non-empty target; roll back on error."""
    tables = Base.metadata.sorted_tables
    required = {table.name for table in tables}
    for engine in (source_engine, target_engine):
        missing = required - set(inspect(engine).get_table_names())
        if missing:
            raise RuntimeError(f"Database schema incomplete ({len(missing)} missing tables); run Alembic first")
    counts: dict[str, int] = {}
    with source_engine.connect() as source, target_engine.begin() as target:
        if any(target.execute(select(func.count()).select_from(table)).scalar_one() for table in tables):
            raise RuntimeError("Destination contains data; refusing to overwrite or merge records")
        for table in tables:
            rows = [dict(row) for row in source.execute(select(table)).mappings()]
            if rows:
                target.execute(insert(table), rows)
            count = target.execute(select(func.count()).select_from(table)).scalar_one()
            if count != len(rows):
                raise RuntimeError(f"Copy verification failed for {table.name}")
            counts[table.name] = count
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description="One-time DevAtlas SQLite -> PostgreSQL import")
    parser.add_argument("--sqlite", required=True, type=Path, help="Existing SQLite database file")
    args = parser.parse_args()
    if not args.sqlite.is_file():
        parser.error("SQLite file not found")
    url = os.environ.get("DEVATLAS_DATABASE_URL", "")
    if not normalize_url(url).startswith("postgresql+psycopg://"):
        parser.error("Set DEVATLAS_DATABASE_URL to a PostgreSQL URL")
    source = make_engine("sqlite:///" + args.sqlite.resolve().as_posix())
    target = make_engine(url)
    try:
        counts = transfer_data(source, target)
        print(f"Copied {len(counts)} tables and {sum(counts.values())} rows; committed successfully.")
        for table_name, count in counts.items():
            print(f"{table_name}: {count}")
    finally:
        source.dispose()
        target.dispose()


if __name__ == "__main__":
    main()
