import io
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect


def test_migration_round_trip(tmp_path, monkeypatch):
    database_url = "sqlite:///" + (tmp_path / "migration.db").as_posix()
    monkeypatch.setenv("MOCK_GPS_DATABASE_URL", database_url)
    monkeypatch.setenv("MOCK_GPS_JWT_SECRET", "migration-test-secret-not-for-deployment")
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    command.upgrade(config, "head")
    engine = create_engine(database_url)
    assert {"users", "locations", "routes"} <= set(inspect(engine).get_table_names())
    command.check(config)
    command.downgrade(config, "base")
    assert "users" not in inspect(engine).get_table_names()
    engine.dispose()


def test_postgresql_migration_sql(monkeypatch):
    monkeypatch.setenv("MOCK_GPS_DATABASE_URL", "postgresql+psycopg://unused@localhost/unused")
    monkeypatch.setenv("MOCK_GPS_JWT_SECRET", "migration-test-secret-not-for-deployment")
    output = io.StringIO()
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"), output_buffer=output)
    command.upgrade(config, "head", sql=True)
    assert "CREATE TABLE locations" in output.getvalue()
    assert "TIMESTAMP WITH TIME ZONE" in output.getvalue()