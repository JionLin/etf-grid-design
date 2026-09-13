import pytest
from app import create_app


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


class TestETFPoolRoutes:
    """测试 /api/etf/pool 路由接口"""

    def test_get_etf_pool_success(self, client):
        resp = client.get("/api/etf/pool?min_amount=1000")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert "items" in data["data"]
        assert "sectors_summary" in data["data"]
        assert "total" in data["data"]
        # 验证返回列表非空
        assert len(data["data"]["items"]) > 0

    def test_get_etf_pool_with_filters(self, client):
        # 1. 过滤 T+0
        resp_t0 = client.get("/api/etf/pool?is_t0=true")
        assert resp_t0.status_code == 200
        data_t0 = resp_t0.get_json()
        for item in data_t0["data"]["items"]:
            assert item["is_t0"] is True

        # 2. 过滤赛道
        resp_sector = client.get("/api/etf/pool?sector=科技芯片")
        assert resp_sector.status_code == 200
        data_sector = resp_sector.get_json()
        for item in data_sector["data"]["items"]:
            assert item["sector"] == "科技芯片"
