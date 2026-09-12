"""市场特征 ADX 评分与空值建议测试。"""

import pandas as pd

from algorithms.atr.calculator import calculate_adx
from backend.services.analysis.etf_analysis_service import ETFAnalysisService
from backend.services.analysis.suitability_analyzer import SuitabilityAnalyzer


def test_valid_adx_keeps_score_bands():
    analyzer = SuitabilityAnalyzer()

    ranging = analyzer.evaluate_market_characteristics(19.9)
    weak_trend = analyzer.evaluate_market_characteristics(20.0)
    strong_trend = analyzer.evaluate_market_characteristics(40.0)

    assert ranging['score'] == 25
    assert ranging['level'] == '震荡市'
    assert weak_trend['score'] == 18
    assert weak_trend['level'] == '弱趋势'
    assert strong_trend['score'] == 6
    assert strong_trend['level'] == '强趋势'


def test_short_history_is_not_scored_as_ranging_market():
    analyzer = SuitabilityAnalyzer()
    dates = pd.date_range('2026-01-01', periods=20)
    frame = pd.DataFrame({
        'date': dates.strftime('%Y-%m-%d'),
        'open': [3.0] * 20,
        'high': [3.1] * 20,
        'low': [2.9] * 20,
        'close': [3.05] * 20,
        'vol': [1000000] * 20,
        'amount': [30000000] * 20,
    })

    assert calculate_adx(frame) is None
    result = analyzer.comprehensive_evaluation(frame, {'code': '510300', 'name': '沪深300ETF'})
    market_eval = result['evaluations']['market_characteristics']

    assert market_eval['score'] == 0
    assert market_eval['level'] == '数据不足'
    assert market_eval['level'] != '震荡市'
    assert result['market_indicators']['adx_value'] is None
    assert '0.0' not in market_eval['details']
    assert '震荡' not in market_eval['details']


def _suggestion_inputs(adx_value):
    suitability_result = {
        'market_indicators': {'adx_value': adx_value, 'volatility': 0.2},
    }
    grid_params = {
        'grid_config': {'count': 20},
        'fund_allocation': {'grid_fund_utilization_rate': 0.8},
    }
    return suitability_result, grid_params


def test_missing_adx_does_not_suggest_denser_grid():
    service = ETFAnalysisService.__new__(ETFAnalysisService)
    result = service._generate_adjustment_suggestions(*_suggestion_inputs(None))
    messages = result['market_environment_changes']

    assert messages == []


def test_low_adx_still_suggests_denser_grid():
    service = ETFAnalysisService.__new__(ETFAnalysisService)
    result = service._generate_adjustment_suggestions(*_suggestion_inputs(10.0))

    assert any('增加网格密度' in message for message in result['market_environment_changes'])
