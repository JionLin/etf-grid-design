"""
估值温度计与百分位数计算引擎单元测试
"""
import pytest
from unittest.mock import MagicMock
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
