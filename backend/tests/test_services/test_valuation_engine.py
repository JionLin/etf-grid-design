"""
估值温度计与百分位数计算引擎单元测试
"""
import pytest
from unittest.mock import MagicMock
from backend.services.data.cache_service import EnhancedCache
from backend.services.analysis.valuation_engine import ValuationEngine

def test_calculate_ecdf_percentile():
    # 历史样本 10 个数据点：[10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    history = [float(x) for x in range(10, 110, 10)]
    
    # 25 低于 10, 20 -> 2/10 = 20%
    pct = ValuationEngine.calculate_ecdf_percentile(20.0, history)
    assert pct == 20.0
    
    pct_mid = ValuationEngine.calculate_ecdf_percentile(50.0, history)
    assert pct_mid == 50.0

    pct_high = ValuationEngine.calculate_ecdf_percentile(100.0, history)
    assert pct_high == 100.0

    pct_low = ValuationEngine.calculate_ecdf_percentile(5.0, history)
    assert pct_low == 0.0

def test_determine_temperature_tier():
    # 1. 极寒低估 (<20%)
    t1 = ValuationEngine.determine_temperature_tier(15.0)
    assert t1["tier"] == "极寒低估"
    assert t1["suggested_base_position"] == 0.60
    assert t1["is_fatal_flaw"] is False

    # 2. 偏冷适中 (20% ~ 40%)
    t2 = ValuationEngine.determine_temperature_tier(35.0)
    assert t2["tier"] == "偏冷适中"
    assert t2["suggested_base_position"] == 0.55
    assert t2["is_fatal_flaw"] is False

    # 3. 适温合理 (40% ~ 60%)
    t3 = ValuationEngine.determine_temperature_tier(50.0)
    assert t3["tier"] == "适温合理"
    assert t3["suggested_base_position"] == 0.50
    assert t3["is_fatal_flaw"] is False

    # 4. 偏热高位 (60% ~ 80%)
    t4 = ValuationEngine.determine_temperature_tier(75.0)
    assert t4["tier"] == "偏热高位"
    assert t4["suggested_base_position"] == 0.35
    assert t4["is_fatal_flaw"] is False

    # 5. 沸点高估 (>80%) - 触发致命缺陷
    t5 = ValuationEngine.determine_temperature_tier(88.0)
    assert t5["tier"] == "沸点高估"
    assert t5["suggested_base_position"] == 0.25
    assert t5["is_fatal_flaw"] is True
    assert "极端泡沫" in t5["fatal_flaw_reason"] or "极度高估" in t5["fatal_flaw_reason"]

def test_evaluate_valuation_with_fallback():
    engine = ValuationEngine()
    # 模拟中证官网无法连通，直接走 fallback
    engine.client.get_index_valuation = MagicMock(return_value=None)
    
    # 沪深300
    res_300 = engine.evaluate_valuation("510300")
    assert res_300["index_code"] == "000300"
    assert res_300["current_pe"] > 0
    assert res_300["temperature"] > 0
    assert res_300["tier"] in ["极寒低估", "偏冷适中", "适温合理"]
    assert res_300["is_fatal_flaw"] is False

    # 黄金现货 (高位)
    res_gold = engine.evaluate_valuation("518880")
    assert res_gold["is_fatal_flaw"] is True
    assert res_gold["tier"] == "沸点高估"

def test_evaluate_valuation_mainstream_expanded_etfs():
    """验证扩充的主流行业 ETF（如华宝医疗 512170、新能源车 515030、光伏 515790、军工 512660）正常解析"""
    engine = ValuationEngine()
    engine.client.get_index_valuation = MagicMock(return_value=None)
    
    # 512170 华宝医疗 ETF
    res_med = engine.evaluate_valuation("512170")
    assert res_med["index_code"] == "399989"
    assert res_med["index_name"] == "中证医疗"
    assert res_med["current_pe"] > 0
    assert res_med["current_pb"] > 0
    assert res_med["pe_percentile"] > 0
    
    # 515030 新能源车 ETF
    res_ev = engine.evaluate_valuation("515030")
    assert res_ev["index_code"] == "399976"
    assert res_ev["index_name"] == "CS新能车"
    assert res_ev["current_pe"] > 0
    assert res_ev["current_pb"] > 0

    # 515790 光伏 ETF
    res_pv = engine.evaluate_valuation("515790")
    assert res_pv["index_code"] == "931151"
    assert res_pv["index_name"] == "光伏产业"
    assert res_pv["current_pe"] > 0

    # 512660 军工 ETF
    res_mil = engine.evaluate_valuation("512660")
    assert res_mil["index_code"] == "399959"
    assert res_mil["index_name"] == "中证军工"
    assert res_mil["current_pe"] > 0

def test_evaluate_valuation_cascade_sources(tmp_path):
    """验证三级级联获取逻辑：腾讯首选 -> 中证备用 -> 离线兜底"""
    temp_cache = EnhancedCache(cache_dir=str(tmp_path / "cache_1"))
    engine = ValuationEngine(cache=temp_cache)
    
    # 场景 1: 腾讯源正常命中
    engine.tencent_client.get_index_valuation = MagicMock(return_value={
        "trade_date": "2026-09-11",
        "index_code": "399989",
        "pe_ttm": 29.07,
        "source": "tencent_realtime"
    })
    engine.client.get_index_valuation = MagicMock(return_value=None)
    
    res1 = engine.evaluate_valuation("512170")
    assert res1["source"] == "tencent_realtime"
    assert res1["current_pe"] == 29.07
    assert res1["trade_date"] == "2026-09-11"
    assert res1["current_pb"] == 3.05  # 融合底表 PB
    assert res1["is_fallback"] is False
    
    # 场景 2: 腾讯未命中，平滑降级中证 REST
    temp_cache2 = EnhancedCache(cache_dir=str(tmp_path / "cache_2"))
    engine2 = ValuationEngine(cache=temp_cache2)
    engine2.tencent_client.get_index_valuation = MagicMock(return_value=None)
    engine2.client.get_index_valuation = MagicMock(return_value={
        "trade_date": "2026-09-11",
        "index_code": "931151",
        "pe_ttm": 29.69,
        "source": "csindex_official_rest"
    })
    
    res2 = engine2.evaluate_valuation("515790")
    assert res2["source"] == "csindex_official_rest"
    assert res2["current_pe"] == 29.69
    assert res2["trade_date"] == "2026-09-11"
    assert res2["current_pb"] == 2.1  # 融合底表 PB
    assert res2["is_fallback"] is False
    
    # 场景 3: 两路均失败，平滑降级离线底表
    temp_cache3 = EnhancedCache(cache_dir=str(tmp_path / "cache_3"))
    engine3 = ValuationEngine(cache=temp_cache3)
    engine3.tencent_client.get_index_valuation = MagicMock(return_value=None)
    engine3.client.get_index_valuation = MagicMock(return_value=None)
    
    res3 = engine3.evaluate_valuation("512660")
    assert res3["source"] == "baseline_offline"
    assert res3["is_fallback"] is True
    assert res3["current_pe"] > 0
    assert res3["current_pb"] > 0
