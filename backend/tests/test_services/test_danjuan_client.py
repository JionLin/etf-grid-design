"""
蛋卷基金估值客户端单元测试
"""
import pytest
from unittest.mock import MagicMock
from backend.services.data.danjuan_client import DanjuanClient


def test_danjuan_normalize_symbol():
    client = DanjuanClient()
    assert client.normalize_symbol("000300") == "SH000300"
    assert client.normalize_symbol("399006") == "SZ399006"
    assert client.normalize_symbol("H30269") == "CSIH30269"
    assert client.normalize_symbol("SZ399975") == "SZ399975"
    assert client.normalize_symbol("510300") == "SH510300"


def test_danjuan_get_all_index_valuations_success():
    mock_session = MagicMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "result_code": 0,
        "data": {
            "items": [
                {
                    "index_code": "SH000300",
                    "name": "沪深300",
                    "pe": 13.5,
                    "pb": 1.42,
                    "pe_percentile": 0.673,
                    "pb_percentile": 0.405,
                    "roe": 0.105,
                    "yeild": 0.0263,
                    "pb_flag": False,
                    "eva_type": "high",
                    "date": "09-11"
                }
            ]
        }
    }
    mock_session.get.return_value = mock_resp
    client = DanjuanClient(session=mock_session)

    res = client.get_all_index_valuations()
    assert "SH000300" in res
    assert "000300" in res
    data = res["SH000300"]
    assert data["name"] == "沪深300"
    assert data["pe"] == 13.5
    assert data["pb"] == 1.42
    assert data["pe_percentile"] == 67.3
    assert data["pb_percentile"] == 40.5
    assert data["dividend_yield"] == 2.63
    assert data["source"] == "danjuan_online"


def test_danjuan_history_success():
    mock_session = MagicMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "result_code": 0,
        "data": {
            "index_eva_pe_growths": [
                {"pe": 12.0, "ts": 1600000000000},
                {"pe": 14.0, "ts": 1600500000000}
            ]
        }
    }
    mock_session.get.return_value = mock_resp
    client = DanjuanClient(session=mock_session)

    pe_hist = client.get_index_pe_history("000300", day="5y")
    assert len(pe_hist) == 2
    assert pe_hist[0]["pe"] == 12.0
