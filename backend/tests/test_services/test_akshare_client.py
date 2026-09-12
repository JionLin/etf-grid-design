import unittest
from unittest.mock import MagicMock, patch
import pandas as pd
import tempfile
import os

from backend.services.data.akshare_client import AkShareClient
from backend.repositories.market_data_repository import MarketDataRepository


class TestAKShareClientFallbackPagination(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "test_market_data.db")
        self.client = AkShareClient()
        self.client.market_repo = MarketDataRepository(db_path=self.db_path)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_get_fallback_kline_multi_page(self):
        """测试备用K线源分段循环拉取与去重合并"""
        batch1 = [
            ["2024-01-22", "1.0", "1.1", "1.15", "0.95", "10000"]
        ] + [
            [f"2024-0{i%9+1}-{(i%28)+1:02d}", "1.0", "1.1", "1.15", "0.95", "10000"]
            for i in range(638)
        ] + [
            ["2026-09-11", "1.2", "1.25", "1.3", "1.18", "20000"]
        ]
        
        batch2 = [
            ["2021-06-08", "0.7", "0.75", "0.8", "0.68", "8000"]
        ] + [
            [f"2022-0{i%9+1}-{(i%28)+1:02d}", "0.8", "0.85", "0.9", "0.78", "8000"]
            for i in range(638)
        ] + [
            ["2024-01-22", "1.0", "1.1", "1.15", "0.95", "10000"]
        ]

        def fake_get(url, timeout=6):
            mock_resp = MagicMock()
            if "2024-01-22" in url:
                mock_resp.json.return_value = {
                    "data": {"sh515220": {"qfqday": batch2}}
                }
            else:
                mock_resp.json.return_value = {
                    "data": {"sh515220": {"qfqday": batch1}}
                }
            return mock_resp

        with patch("requests.Session") as mock_session_cls:
            mock_session = MagicMock()
            mock_session.get.side_effect = fake_get
            mock_session_cls.return_value = mock_session

            df = self.client._get_fallback_kline("515220", days=1825)
            self.assertIsNotNone(df)
            assert df is not None
            self.assertEqual(len(df), 1250)
            self.assertIn("open", df.columns)
            self.assertIn("close", df.columns)
            self.assertIn("trade_date", df.columns)

    def test_incremental_forward_fill_when_latest_gap_detected(self):
        """测试检测到最新端缺口时的定向增量补齐"""
        # 1. 模拟本地已有数据截止到 2026-09-09 (共 500 条)
        base_records = [
            {"trade_date": f"2024-01-{(i%28)+1:02d}", "open": 1.0, "close": 1.02, "high": 1.05, "low": 0.98, "vol": 100, "amount": 1000, "pct_chg": 0.5}
            for i in range(499)
        ] + [
            {"trade_date": "2026-09-09", "open": 1.10, "close": 1.12, "high": 1.13, "low": 1.09, "vol": 200, "amount": 2000, "pct_chg": 1.8}
        ]
        self.client.market_repo.save_bars("515220", base_records)
        self.assertEqual(self.client.market_repo.get_date_range("515220")["max_date"], "2026-09-09")

        # 2. 模拟增量请求返回 2026-09-10 与 2026-09-11 缺失的两天
        inc_df = pd.DataFrame([
            {"trade_date": pd.to_datetime("2026-09-10"), "open": 1.12, "close": 1.14, "high": 1.15, "low": 1.11, "vol": 220, "amount": 2200, "pct_chg": 1.7},
            {"trade_date": pd.to_datetime("2026-09-11"), "open": 1.14, "close": 1.16, "high": 1.17, "low": 1.13, "vol": 250, "amount": 2500, "pct_chg": 1.75}
        ])

        with patch.object(self.client, "_fetch_raw_kline_network", return_value=inc_df) as mock_fetch:
            res_df = self.client.get_etf_daily_data("515220", "20240101", "20260911", days=180)
            
            # 验证触发了定向增量拉取
            mock_fetch.assert_called_once()
            self.assertIsNotNone(res_df)
            assert res_df is not None
            # 本地数据库中的最新水位线被自动推进到 2026-09-11
            updated_range = self.client.market_repo.get_date_range("515220")
            self.assertEqual(updated_range["max_date"], "2026-09-11")

    def test_zero_network_when_lake_is_up_to_date(self):
        """测试本地数据已是最新且满足周期时，完全不调用网络接口直出"""
        full_records = [
            {"trade_date": f"2026-0{i%9+1}-{(i%28)+1:02d}", "open": 1.0, "close": 1.02, "high": 1.05, "low": 0.98, "vol": 100, "amount": 1000, "pct_chg": 0.5}
            for i in range(120)
        ] + [
            {"trade_date": "2026-09-11", "open": 1.14, "close": 1.16, "high": 1.17, "low": 1.13, "vol": 250, "amount": 2500, "pct_chg": 1.75}
        ]
        self.client.market_repo.save_bars("515220", full_records)

        with patch.object(self.client, "_fetch_raw_kline_network") as mock_fetch, \
             patch.object(self.client, "_get_fallback_kline") as mock_fallback:
            res_df = self.client.get_etf_daily_data("515220", "20260301", "20260911", days=90)
            
            # 验证网络方法完全未被调用 (零网络等待直出)
            mock_fetch.assert_not_called()
            mock_fallback.assert_not_called()
            self.assertIsNotNone(res_df)
            assert res_df is not None
            self.assertTrue(len(res_df) > 0)


if __name__ == "__main__":
    unittest.main()
