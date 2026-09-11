"""
估值 API 路由单元测试
"""
import pytest
import json
from unittest.mock import patch, MagicMock
from backend.app import create_app

@pytest.fixture
def client():
    app = create_app()
    with app.test_client() as client:
        yield client

def test_get_etf_valuation_api(client):
    # 正常请求沪深300估值
    res = client.get('/api/etf/valuation/510300')
    assert res.status_code == 200
    json_data = res.get_json()
    assert json_data['success'] is True
    data = json_data['data']
    assert data['etf_code'] == '510300'
    assert 'temperature' in data
    assert 'tier' in data
    assert 'advice' in data
    assert 'suggested_base_position' in data
    assert 'current_pe' in data

def test_get_etf_valuation_invalid_code(client):
    # 代码非6位数字
    res = client.get('/api/etf/valuation/123')
    assert res.status_code == 400
    json_data = res.get_json()
    assert json_data['success'] is False

def test_analyze_api_contains_valuation(client):
    # 构造合法的 analyze 请求体
    req_body = {
        'etfCode': '510300',
        'totalCapital': 100000,
        'gridType': '等差',
        'riskPreference': '均衡',
        'analysisDays': 30
    }
    
    # 模拟外部 akshare 接口返回必要字段
    with patch('backend.services.analysis.etf_analysis_service.AkShareClient.get_etf_basic_info', 
               return_value={'code': '510300', 'name': '300ETF', 'current_price': 3.5}), \
         patch('backend.services.analysis.etf_analysis_service.AkShareClient.get_latest_price', 
               return_value={'current_price': 3.5, 'change_pct': 0.5, 'volume': 100000, 'turnover': 350000}), \
         patch('backend.services.analysis.etf_analysis_service.ETFAnalysisService.get_historical_data') as mock_hist:
        
        import pandas as pd
        dates = pd.date_range('2026-01-01', periods=30)
        mock_hist.return_value = pd.DataFrame({
            'date': dates.strftime('%Y-%m-%d'),
            'open': [3.4 + i*0.01 for i in range(30)],
            'high': [3.6 + i*0.01 for i in range(30)],
            'low': [3.3 + i*0.01 for i in range(30)],
            'close': [3.5 + i*0.01 for i in range(30)],
            'vol': [1000000 for _ in range(30)],
            'amount': [35000000 for _ in range(30)]
        })
        
        res = client.post('/api/analyze', json=req_body)
        assert res.status_code == 200
        json_data = res.get_json()
        assert json_data['success'] is True
        report = json_data['data']
        assert 'valuation' in report, "主分析报告中必须包含 valuation 对象"
        val = report['valuation']
        assert val['etf_code'] == '510300'
        assert 'tier' in val
        assert 'temperature' in val
        assert 'advice' in val
