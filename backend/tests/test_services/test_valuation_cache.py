"""
估值缓存与离线底表降级逻辑单元测试
"""
import os
import shutil
import pytest
from backend.services.data.cache_service import EnhancedCache

@pytest.fixture
def temp_cache(tmp_path):
    cache_dir = str(tmp_path / "cache_test")
    cache = EnhancedCache(cache_dir=cache_dir)
    yield cache
    if os.path.exists(cache_dir):
        shutil.rmtree(cache_dir)

def test_valuation_cache_set_and_get(temp_cache):
    val_data = {
        "index_code": "000300",
        "pe_ttm": 12.5,
        "pe_percentile": 23.0,
        "tier": "偏冷适中"
    }
    temp_cache.set_valuation_cache("510300", val_data, trade_date="20260909")
    
    cached = temp_cache.get_valuation_cache("510300", trade_date="20260909")
    assert cached is not None
    assert cached["pe_ttm"] == 12.5
    assert cached["tier"] == "偏冷适中"

def test_valuation_fallback_to_baseline(temp_cache):
    # 未写入缓存，直接走 fallback
    res = temp_cache.get_valuation_with_fallback("510300", trade_date="20260909")
    assert res is not None
    assert res["is_fallback"] is True
    assert res["source"] == "baseline_offline"
    assert res["index_code"] == "000300"
    assert "pe_percentile" in res
    assert "tier" in res
    assert "advice" in res

def test_valuation_unknown_code_fallback(temp_cache):
    # 未知代码的兜底保护
    res = temp_cache.get_valuation_with_fallback("999999", trade_date="20260909")
    assert res["is_fallback"] is True
    assert res["tier"] == "适温合理"
