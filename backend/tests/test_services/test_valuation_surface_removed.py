"""估值口子与首页选品雷达不得回到产品路径。"""
import inspect
from pathlib import Path

import pandas as pd
import pytest

from backend.app import create_app
from backend.services.analysis.etf_analysis_service import ETFAnalysisService
from backend.services.analysis.suitability_analyzer import SuitabilityAnalyzer

REPO_ROOT = Path(__file__).resolve().parents[3]


@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as test_client:
        yield test_client


def _flat_market(amount):
    dates = pd.date_range('2026-01-01', periods=40)
    return pd.DataFrame({
        'date': dates.strftime('%Y-%m-%d'),
        'open': [3.0] * 40,
        'high': [3.001] * 40,
        'low': [2.999] * 40,
        'close': [3.0] * 40,
        'vol': [1000000] * 40,
        'amount': [amount] * 40,
    })


def test_removed_routes_do_not_return_rankings_or_valuation(client):
    radar = client.get('/api/etf/radar?category=all&limit=10')
    valuation = client.get('/api/etf/valuation/510300')

    assert radar.status_code == 404
    assert valuation.status_code == 404
    assert b'safe_score' not in radar.data
    assert b'pe_percentile' not in valuation.data


def test_homepage_does_not_render_selection_radar():
    homepage = (REPO_ROOT / 'frontend/src/pages/HomePage/HomePage.jsx').read_text(encoding='utf-8')

    assert '今日 ETF 立体网格选品雷达' not in homepage
    assert 'ETFSelectionRadarCard' not in homepage
    assert 'ParameterForm' in homepage


def test_analysis_report_omits_valuation_fields():
    source = inspect.getsource(ETFAnalysisService.analyze_etf_strategy)

    assert "'valuation'" not in source
    assert 'valuation_summary' not in source
    assert 'grid_strategy' in source
    assert 'suitability_evaluation' in source


def test_amplitude_and_liquidity_still_veto_without_valuation():
    analyzer = SuitabilityAnalyzer()
    low_amplitude = analyzer.comprehensive_evaluation(
        _flat_market(amount=30000000),
        {'code': '510300', 'name': '沪深300ETF'},
    )
    illiquid = analyzer.comprehensive_evaluation(
        _flat_market(amount=1000),
        {'code': '510300', 'name': '沪深300ETF'},
    )

    assert low_amplitude['has_fatal_flaw'] is True
    assert '振幅不足' in low_amplitude['fatal_flaws']
    assert 'valuation_summary' not in low_amplitude
    assert 'valuation' not in low_amplitude['evaluations']
    assert illiquid['has_fatal_flaw'] is True
    assert '流动性严重不足' in illiquid['fatal_flaws']
