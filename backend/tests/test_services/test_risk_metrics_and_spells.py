import pandas as pd
import pytest
from backend.services.analysis.backtest_engine import (
    calculate_sortino_ratio,
    calculate_exposure_metrics,
    extract_drawdown_spells,
)


def test_calculate_sortino_ratio():
    # 构造含回撤的净值序列
    curve = [
        {"strategy_equity": 10000.0},
        {"strategy_equity": 10200.0},
        {"strategy_equity": 9800.0},
        {"strategy_equity": 9900.0},
        {"strategy_equity": 10500.0},
        {"strategy_equity": 10800.0},
    ]
    sortino = calculate_sortino_ratio(curve, rf=0.02, periods=250)
    assert sortino is not None
    assert isinstance(sortino, float)
    assert sortino > 0

    # 边界测试：长度 < 2
    assert calculate_sortino_ratio([{"strategy_equity": 10000.0}]) is None

    # 边界测试：单调递增全正收益（下行方差为0）
    curve_up = [
        {"strategy_equity": 10000.0},
        {"strategy_equity": 10100.0},
        {"strategy_equity": 10200.0},
    ]
    assert calculate_sortino_ratio(curve_up, rf=0.0, periods=250) is None


def test_calculate_exposure_metrics():
    curve = [
        {"exposure": 0.50},
        {"exposure": 0.60},
        {"exposure": 0.80},
        {"exposure": 0.50},
    ]
    metrics = calculate_exposure_metrics(curve)
    assert metrics["avg_exposure"] == 60.0
    assert metrics["max_exposure"] == 80.0


def test_extract_drawdown_spells():
    curve = [
        {"date": "2023-01-01", "strategy_equity": 10000.0},
        {"date": "2023-01-02", "strategy_equity": 10500.0},  # Peak 1
        {"date": "2023-01-03", "strategy_equity": 9500.0},   # Trough (-9.52%)
        {"date": "2023-01-04", "strategy_equity": 9800.0},
        {"date": "2023-01-05", "strategy_equity": 10600.0},  # Recovered & New Peak
        {"date": "2023-01-06", "strategy_equity": 10200.0},  # In water (unrecovered)
    ]
    trades = [
        {"trade_time": "2023-01-03 10:00:00", "action": "BUY", "amount": 1000.0},
        {"trade_time": "2023-01-04 14:00:00", "action": "SELL", "amount": 1050.0, "profit": 50.0},
    ]

    res = extract_drawdown_spells(curve, trades)
    assert "longest_underwater_days" in res
    assert "max_dd_recovery_days" in res
    assert "top_drawdown_spells" in res
    assert res["longest_underwater_days"] >= 3
    assert res["max_dd_recovery_days"] >= 3

    spells = res["top_drawdown_spells"]
    assert len(spells) >= 1
    top1 = spells[0]
    assert top1["spell_type"] == "deepest_crisis"
    assert top1["peak_date"] == "2023-01-02"
    assert top1["trough_date"] == "2023-01-03"
    assert top1["recovered_date"] == "2023-01-05"
    assert top1["is_recovered"] is True
    assert top1["buy_count"] == 1
    assert top1["t_profit"] == 50.0
