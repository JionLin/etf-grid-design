"""
腾讯财经行情客户端单元测试
"""
import pytest
from unittest.mock import MagicMock
import requests
from backend.services.data.tencent_client import TencentFinanceClient


def test_get_tencent_symbol():
    # 上证指数
    assert TencentFinanceClient.get_tencent_symbol("000300") == "sh000300"
    assert TencentFinanceClient.get_tencent_symbol("000016.SH") == "sh000016"
    assert TencentFinanceClient.get_tencent_symbol("000688") == "sh000688"
    
    # 深证与巨潮指数
    assert TencentFinanceClient.get_tencent_symbol("399989") == "sz399989"
    assert TencentFinanceClient.get_tencent_symbol("399976.SZ") == "sz399976"
    
    # 暂不支持的代码前缀或非法代码
    assert TencentFinanceClient.get_tencent_symbol("931151") is None
    assert TencentFinanceClient.get_tencent_symbol("INVALID") is None
    assert TencentFinanceClient.get_tencent_symbol("123") is None


def test_get_index_valuation_success():
    client = TencentFinanceClient()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    # 构造模拟腾讯行情响应报文，包含 45+ 个字段
    mock_fields = ["51", "中证医疗", "399989", "6466.52"] + ["0"] * 26 + ["20260911161406"] + ["0"] * 8 + ["29.07"] + ["0"] * 10
    mock_resp.text = 'v_sz399989="' + "~".join(mock_fields) + '";\n'
    
    client.session.get = MagicMock(return_value=mock_resp)
    
    res = client.get_index_valuation("399989")
    assert res is not None
    assert res["index_code"] == "399989"
    assert res["trade_date"] == "2026-09-11"
    assert res["pe_ttm"] == 29.07
    assert res["source"] == "tencent_realtime"


def test_get_index_valuation_none_match():
    client = TencentFinanceClient()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = 'v_pv_none_match="none";\n'
    
    client.session.get = MagicMock(return_value=mock_resp)
    
    res = client.get_index_valuation("399989")
    assert res is None


def test_get_index_valuation_network_timeout():
    client = TencentFinanceClient()
    client.session.get = MagicMock(side_effect=requests.exceptions.Timeout("Read timeout"))
    
    res = client.get_index_valuation("399989")
    assert res is None


def test_get_index_valuation_invalid_pe():
    client = TencentFinanceClient()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_fields = ["51", "中证医疗", "399989", "6466.52"] + ["0"] * 26 + ["20260911161406"] + ["0"] * 8 + ["0.00"] + ["0"] * 10
    mock_resp.text = 'v_sz399989="' + "~".join(mock_fields) + '";\n'
    
    client.session.get = MagicMock(return_value=mock_resp)
    
    res = client.get_index_valuation("399989")
    assert res is None
