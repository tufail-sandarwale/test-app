from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from app.config import Settings
from app.factory import create_app
from app.models import Base

SECRET = "test-only-secret-not-for-deployment-12345"
PASSWORD = "test-only-password-12345"


@pytest.fixture
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    settings = Settings(database_url="sqlite://", jwt_secret=SECRET)
    with TestClient(create_app(settings, engine)) as api:
        yield api


def auth(client, email="owner@example.com"):
    response = client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD})
    assert response.status_code == 201, response.text
    assert response.headers["cache-control"] == "no-store"
    return {"Authorization": "Bearer " + response.json()["access_token"]}


@pytest.mark.parametrize("resource,data", [
    ("locations", {"name": "Office", "latitude": 19.076, "longitude": 72.8777}),
    ("routes", {"name": "Walk", "points": [{"latitude": 0, "longitude": 0}, {"latitude": 0, "longitude": 0.01}], "speedKmh": 5}),
])
def test_crud_and_ownership(client, resource, data):
    path = f"/api/v1/{resource}"
    owner = auth(client)
    other = auth(client, "other@example.com")
    assert client.get(path).status_code == 401
    created = client.post(path, headers=owner, json=data)
    assert created.status_code == 201, created.text
    item = path + "/" + created.json()["id"]
    assert client.get(item, headers=owner).status_code == 200
    assert client.get(path, headers=other).json() == []
    for method in ["get", "put", "delete"]:
        args = {"json": data} if method == "put" else {}
        assert getattr(client, method)(item, headers=other, **args).status_code == 404
    updated = client.put(item, headers=owner, json={**data, "name": "Updated"})
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated"
    assert len(client.get(path, headers=owner).json()) == 1
    assert client.delete(item, headers=owner).status_code == 204
    assert client.get(item, headers=owner).status_code == 404


def test_login_and_token_validation(client):
    auth(client)
    credentials = {"email": "owner@example.com", "password": PASSWORD}
    assert client.post("/api/v1/auth/register", json=credentials).status_code == 409
    assert client.post("/api/v1/auth/login", json=credentials).status_code == 200
    assert client.post("/api/v1/auth/login", json={**credentials, "password": "wrong-password-12345"}).status_code == 401
    expired = jwt.encode({"sub": "nobody", "iat": datetime.now(timezone.utc) - timedelta(hours=2), "exp": datetime.now(timezone.utc) - timedelta(hours=1), "iss": "mock-gps-tester", "aud": "mock-gps-client"}, SECRET, algorithm="HS256")
    for token in [expired, "malformed"]:
        assert client.get("/api/v1/locations", headers={"Authorization": "Bearer " + token}).status_code == 401


def test_invalid_payloads(client):
    secret = "shortSecret"
    response = client.post("/api/v1/auth/register", json={"email": "bad", "password": secret})
    assert response.status_code == 422
    assert secret not in response.text
    headers = auth(client)
    assert client.post("/api/v1/locations", headers=headers, json={"name": " ", "latitude": 91, "longitude": 0}).status_code == 422
    assert client.post("/api/v1/locations", headers=headers, json={"name": "Test", "latitude": 0, "longitude": 0, "owner_id": "another"}).status_code == 422
    assert client.post("/api/v1/routes", headers=headers, json={"name": "Test", "points": [{"latitude": 0, "longitude": 0}] * 2, "speedKmh": 5}).status_code == 422
    assert client.get("/api/v1/routes?limit=1000", headers=headers).status_code == 422


def test_login_rate_limit(client):
    for attempt in range(10):
        assert client.post("/api/v1/auth/login", json={"email": "missing@example.com", "password": PASSWORD}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "missing@example.com", "password": PASSWORD}).status_code == 429