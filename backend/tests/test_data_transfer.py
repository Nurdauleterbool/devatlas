"""Migration copy checks without a cloud database."""
import pytest
from sqlalchemy import insert, select, func
from app import models
from app.db import Base, make_engine
from scripts.migrate_sqlite_to_postgres import transfer_data


def test_sqlite_to_empty_target_transaction_and_duplicate_guard(tmp_path):
    source = make_engine(f"sqlite:///{tmp_path / 'source.db'}")
    target = make_engine(f"sqlite:///{tmp_path / 'target.db'}")
    try:
        Base.metadata.create_all(source)
        Base.metadata.create_all(target)
        with source.begin() as connection:
            connection.execute(insert(models.User), [{
                "id": "user-1", "display_name": "Example", "email": "example@test.invalid",
                "password_hash": "sample-not-real", "created_at": "2026-01-01T00:00:00.000Z",
            }])
        counts = transfer_data(source, target)
        assert counts["users"] == 1
        assert len(counts) == len(Base.metadata.tables)
        with target.connect() as connection:
            assert connection.scalar(select(func.count()).select_from(models.User)) == 1
        with pytest.raises(RuntimeError, match="Destination contains data"):
            transfer_data(source, target)
    finally:
        source.dispose()
        target.dispose()
