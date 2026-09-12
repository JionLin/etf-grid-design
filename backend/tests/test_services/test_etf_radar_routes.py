"""
选品雷达接口集成测试
"""
import pytest
from app import create_app


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_get_etf_radar_all(client):
    resp = client.get("/api/etf/radar?category=all&limit=10")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True
    assert "data" in data
    items = data["data"]
    assert len(items) > 0
    first = items[0]
    assert "etf_code" in first
    assert "safe_score" in first
    assert "pe_pct_5y" in first
    assert "pe_pct_10y" in first
    assert "pb_pct_5y" in first
    assert "pb_pct_10y" in first
    assert "dividend_yield" in first


def test_get_etf_radar_filter(client):
    resp = client.get("/api/etf/radar?category=dividend&limit=5")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True
    for item in data["data"]:
        assert item["dividend_yield"] >= 3.0
