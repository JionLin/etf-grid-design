import unittest
import os
import tempfile
from backend.repositories.backtest_repository import BacktestRepository


class TestBacktestRepository(unittest.TestCase):
    """验证 SQLite 回测档案库的存储、列表筛选、详情还原与删除功能"""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "test_backtest.db")
        self.repo = BacktestRepository(db_path=self.db_path)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_save_and_get_detail_and_list(self):
        mock_result = {
            'summary': {
                'annualized_return': 24.5,
                'max_drawdown': 9.2,
                'total_profit': 15800.5,
                'total_trades': 88,
            },
            'profit_pool': {
                'free_shares': 500,
            },
            'equity_curve': [{'date': '2025-01-01', 'nav': 1.0}],
            'total_trades_all': [
                {'trade_time': '2025-01-02 10:15', 'action': 'BUY', 'rail': 'small', 'profit': 0.0},
                {'trade_time': '2025-01-03 14:12', 'action': 'SELL', 'rail': 'small', 'profit': 150.0},
            ],
            'history_meta': {
                'requested_days': 365,
                'actual_trading_days': 242,
                'is_partial_history': False,
            }
        }

        # 1. 保存记录
        run_id = self.repo.save_run(
            etf_code='512170',
            etf_name='医疗ETF',
            backtest_days=365,
            total_capital=100000.0,
            step_mode='atr',
            reinvest_mode='pool_shares',
            backtest_result=mock_result,
            params={'reinvestMode': 'pool_shares'},
        )
        self.assertTrue(run_id.startswith('run_'))

        # 2. 列表查询
        list_res = self.repo.list_runs(etf_code='512170')
        self.assertEqual(list_res['total'], 1)
        self.assertEqual(len(list_res['records']), 1)
        rec = list_res['records'][0]
        self.assertEqual(rec['run_id'], run_id)
        self.assertEqual(rec['annual_return'], 24.5)
        self.assertEqual(rec['free_shares'], 500)
        self.assertEqual(rec['total_trades'], 88)

        # 3. 详情获取与无损还原
        detail = self.repo.get_run_detail(run_id)
        self.assertIsNotNone(detail)
        self.assertEqual(detail['etf_code'], '512170')
        self.assertEqual(len(detail['trades']), 2)
        self.assertEqual(detail['trades'][1]['profit'], 150.0)
        self.assertEqual(detail['equity_curve'][0]['nav'], 1.0)
        self.assertEqual(detail['params']['reinvestMode'], 'pool_shares')

        # 4. 去重标的查询
        etfs = self.repo.get_distinct_etfs()
        self.assertEqual(len(etfs), 1)
        self.assertEqual(etfs[0]['etf_code'], '512170')

        # 5. 删除记录
        deleted = self.repo.delete_run(run_id)
        self.assertTrue(deleted)
        self.assertIsNone(self.repo.get_run_detail(run_id))
        self.assertEqual(self.repo.list_runs()['total'], 0)


if __name__ == '__main__':
    unittest.main()
