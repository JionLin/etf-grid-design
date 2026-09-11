"""
中证指数官方数据采集客户端单元测试 (基于生产 REST 接口)
"""
import pytest
import requests
from unittest.mock import MagicMock, patch
from backend.services.data.csindex_client import CsindexClient


def test_csindex_client_parse_mock_rest_json():
    client = CsindexClient()
    
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "code": "200",
        "msg": "Success",
        "data": [
            {"tradeDate": "20260908", "indexName": "沪深300", "peg": 13.48},
            {"tradeDate": "20260909", "indexName": "沪深300", "peg": 13.52}
        ]
    }

    with patch.object(client.session, 'get', return_value=mock_resp):
        res = client.get_index_valuation('000300')
        assert res is not None
        assert res['index_code'] == '000300'
        assert res['trade_date'] == '2026-09-09'
        assert res['pe_ttm'] == 13.52
        assert res['source'] == 'csindex_official_rest'


def test_csindex_client_http_error():
    client = CsindexClient()
    mock_resp = MagicMock()
    mock_resp.status_code = 404

    with patch.object(client.session, 'get', return_value=mock_resp):
        res = client.get_index_valuation('000999')
        assert res is None


def test_csindex_client_network_exception():
    client = CsindexClient()
    with patch.object(client.session, 'get', side_effect=requests.exceptions.Timeout("超时")):
        res = client.get_index_valuation('000300')
        assert res is None


def test_csindex_client_empty_or_invalid_data():
    client = CsindexClient()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"code": "400", "msg": "No Data", "data": []}

    with patch.object(client.session, 'get', return_value=mock_resp):
        res = client.get_index_valuation('000300')
        assert res is None


def test_csindex_client_invalid_code():
    client = CsindexClient()
    assert client.get_index_valuation("INVALID") is None
    assert client.get_index_valuation("123") is None
