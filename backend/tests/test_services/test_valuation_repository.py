"""
SQLite 估值持久化存储库测试
"""
import os
import tempfile
import pytest
from backend.repositories.valuation_repository import ValuationRepository


def test_valuation_repository_init_and_seed():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "test_market_cache.db")
        # 指向现有种子文件
        seed_path = os.path.join(os.path.dirname(__file__), "../../data/index_valuation_snapshot_latest.json")
        repo = ValuationRepository(db_path=db_path, seed_json_path=seed_path)

        # 1. 验证种子数据已成功初始化
        all_rankings = repo.query_radar_rankings(category="all", limit=50)
        assert len(all_rankings) > 0

        # 2. 验证排序是按 safe_score 降序
        for i in range(len(all_rankings) - 1):
            assert all_rankings[i]["safe_score"] >= all_rankings[i + 1]["safe_score"]

        first_item = all_rankings[0]
        assert "etf_code" in first_item
        assert "pe_pct_5y" in first_item
        assert "pe_pct_10y" in first_item
        assert "pb_pct_5y" in first_item
        assert "pb_pct_10y" in first_item
        assert "erp_value" in first_item
        assert "safe_score" in first_item

        # 3. 验证分类过滤
        div_rankings = repo.query_radar_rankings(category="dividend", limit=10)
        for item in div_rankings:
            assert item["dividend_yield"] >= 3.0

        cyclical_rankings = repo.query_radar_rankings(category="cyclical", limit=10)
        for item in cyclical_rankings:
            assert item["industry_type"] == "cyclical_asset"
