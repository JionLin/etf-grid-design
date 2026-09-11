"""
中证指数官方数据采集客户端单元测试
"""
import io
import pandas as pd
import pytest
import requests
from unittest.mock import MagicMock, patch
from backend.services.data.csindex_client import CsindexClient

def test_csindex_client_parse_mock_excel():
    client = CsindexClient()
    
    # 构造模拟 Excel 数据
    data = {
        '日期Date': [20260909, 20260908],
        '指数代码Index Code': [300, 300],
        '市盈率1（总股本）P/E1': [12.35, 12.30],
        '市盈率2（计算用股本）P/E2': [14.10, 14.05],
        '股息率1（总股本）D/P1': [2.85, 2.86],
        '股息率2（计算用股本）D/P2': [2.50, 2.51]
    }
    df = pd.DataFrame(data)
    excel_buffer = io.BytesIO()
    df.to_excel(excel_buffer, index=False)
    excel_bytes = excel_buffer.getvalue()

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = excel_bytes

    with patch.object(client.session, 'get', return_value=mock_resp):
        res = client.get_index_valuation('000300')
        assert res is not None
        assert res['index_code'] == '000300'
        assert res['trade_date'] == '2026-09-09'
        assert res['pe_ttm'] == 12.35
        assert res['dividend_yield'] == 2.85
        assert res['source'] == 'csindex_official'

def test_csindex_client_http_error():
    client = CsindexClient()
    mock_resp = MagicMock()
    mock_resp.status_code = 404
    mock_resp.content = b""

    with patch.object(client.session, 'get', return_value=mock_resp):
        res = client.get_index_valuation('000999')
        assert res is None

def test_csindex_client_network_exception():
    client = CsindexClient()
    with patch.object(client.session, 'get', side_effect=requests.exceptions.Timeout("超时")):
        res = client.get_index_valuation('000300')
        assert res is None
