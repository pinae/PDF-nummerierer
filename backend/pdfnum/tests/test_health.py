"""The health endpoint is the smoke target for CI, e2e and the Docker healthcheck."""


def test_health_returns_ok(client):
    response = client.get("/api/health/")

    assert response.status_code == 200
    assert response["Content-Type"] == "application/json"
    assert response.json() == {"status": "ok"}


def test_health_rejects_mutating_methods(client):
    response = client.post("/api/health/")

    assert response.status_code == 405
