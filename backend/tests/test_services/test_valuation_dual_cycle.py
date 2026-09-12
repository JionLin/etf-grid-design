"""
双周期估值、ERP股债利差与行业自适应安全度单元测试
"""
import pytest
from backend.services.analysis.valuation_engine import ValuationEngine


def test_ecdf_calculation_accuracy():
    engine = ValuationEngine()
    series = [10.0, 12.0, 14.0, 16.0, 18.0, 20.0, 22.0, 24.0, 26.0, 28.0]
    # 当前值 14.0 -> <=14.0 的有 3 个 (10, 12, 14)，共 10 个 -> 30.0%
    assert engine.calculate_ecdf_percentile(14.0, series) == 30.0
    # 当前值 9.0 -> 0%
    assert engine.calculate_ecdf_percentile(9.0, series) == 0.0
    # 当前值 30.0 -> 100%
    assert engine.calculate_ecdf_percentile(30.0, series) == 100.0


def test_erp_calculation_extreme_bottom():
    engine = ValuationEngine()
    # 当 PE = 10 倍，盈利收益率 10.0%，无风险利率 2.10% -> ERP = 7.90% (> 4.5%)
    erp_res = engine.calculate_erp(10.0)
    assert erp_res["earnings_yield"] == 10.0
    assert erp_res["erp_value"] == 7.9
    assert erp_res["level"] == "极值黄金大底 (+2.0σ)"
    assert erp_res["score"] == 95.0


def test_erp_calculation_bubble_high():
    engine = ValuationEngine()
    # 当 PE = 50 倍，盈利收益率 2.0%，Rf = 2.10% -> ERP = -0.10% (< 1.5%)
    erp_res = engine.calculate_erp(50.0)
    assert erp_res["earnings_yield"] == 2.0
    assert erp_res["erp_value"] == -0.1
    assert erp_res["level"] == "股市性价比较低"
    assert erp_res["score"] == 35.0


def test_industry_adaptive_safe_score():
    engine = ValuationEngine()

    # 1. 周期重资产行业 (银行/红利): 核心看 PB 与股息率
    # 假设 PE 很高(60%分位)，但 PB 深度破净(10%分位)，股息率 5.5%
    score_cyclical = engine.calculate_safe_score(
        industry_type="cyclical_asset",
        pe=20.0,
        pe_pct=60.0,
        pb=0.7,
        pb_pct=10.0,
        dividend_yield=5.5,
        erp_score=80.0
    )
    # PB 安全分 90，股息率得分很高，最终得分应当维持在高位安全区
    assert score_cyclical >= 75.0

    # 2. 科技微利行业: PE 异常(100倍)，自动由 PS 接管 (PS分位 15%)
    score_tech = engine.calculate_safe_score(
        industry_type="tech_growth",
        pe=100.0,
        pe_pct=95.0,
        pb=4.0,
        pb_pct=50.0,
        dividend_yield=0.5,
        erp_score=60.0,
        ps_pct=15.0
    )
    # PS 接管，安全分应当显著高于若直接看 95% PE 分位的得分
    assert score_tech >= 60.0


def test_evaluate_valuation_with_dual_cycle_and_matrix():
    engine = ValuationEngine()
    result = engine.evaluate_valuation("510300")
    assert "valuation_matrix" in result
    matrix = result["valuation_matrix"]
    assert "pe" in matrix
    assert "pb" in matrix
    assert "ps" in matrix
    assert "dividend" in matrix
    assert "pct_5y" in matrix["pe"]
    assert "pct_10y" in matrix["pe"]
    assert "erp_info" in result
    assert "safe_score" in result
    assert result["safe_score"] > 0
