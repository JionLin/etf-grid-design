"""
适宜度评估器估值安全边际与致命缺陷拦截单元测试
"""
import pytest
import pandas as pd
from backend.services.analysis.suitability_analyzer import SuitabilityAnalyzer

@pytest.fixture
def mock_market_df():
    # 构造 30 天模拟行情
    dates = pd.date_range('2026-01-01', periods=30)
    data = {
        'date': dates.strftime('%Y-%m-%d'),
        'open': [3.0 + i*0.01 for i in range(30)],
        'high': [3.1 + i*0.01 for i in range(30)],
        'low': [2.9 + i*0.01 for i in range(30)],
        'close': [3.05 + i*0.01 for i in range(30)],
        'vol': [1000000 for _ in range(30)],
        'amount': [30000000 for _ in range(30)]  # 金额充足
    }
    return pd.DataFrame(data)

def test_suitability_without_valuation(mock_market_df):
    analyzer = SuitabilityAnalyzer()
    res = analyzer.comprehensive_evaluation(mock_market_df, {'code': '510300', 'name': '沪深300ETF'})
    assert 'total_score' in res
    assert res['total_score'] > 0

def test_suitability_with_low_valuation(mock_market_df):
    analyzer = SuitabilityAnalyzer()
    val_info = {
        'tier': '极寒低估',
        'temperature': 15.0,
        'pe_percentile': 15.0,
        'is_fatal_flaw': False
    }
    res = analyzer.comprehensive_evaluation(mock_market_df, {'code': '510300', 'name': '沪深300ETF'}, valuation_info=val_info)
    assert res['has_fatal_flaw'] is False
    assert 'valuation' in res['evaluations']
    assert res['evaluations']['valuation']['tier'] == '极寒低估'

def test_suitability_with_bubble_fatal_flaw(mock_market_df):
    analyzer = SuitabilityAnalyzer()
    val_info = {
        'tier': '沸点高估',
        'temperature': 88.0,
        'pe_percentile': 88.0,
        'is_fatal_flaw': True,
        'fatal_flaw_reason': '估值分位数处于 88.0% 极度高估区间，防范戴维斯双杀'
    }
    res = analyzer.comprehensive_evaluation(mock_market_df, {'code': '518880', 'name': '黄金现货'}, valuation_info=val_info)
    assert res['has_fatal_flaw'] is True
    assert res['conclusion'] == "存在严重缺陷"
    assert any('极度高估' in flaw for flaw in res['fatal_flaws'])
