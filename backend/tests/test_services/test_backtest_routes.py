import unittest
from unittest.mock import patch, MagicMock
from flask import Flask
from backend.api.routes.analysis_routes import analysis_bp, backtest_repo


class TestBacktestRoutes(unittest.TestCase):
    """验证回测归档与档案库 REST API 接口"""

    def setUp(self):
        self.app = Flask(__name__)
        self.app.register_blueprint(analysis_bp)
        self.client = self.app.test_client()

    @patch('backend.api.routes.analysis_routes.etf_service')
    def test_backtest_auto_save_and_routes(self, mock_service):
        mock_service.get_etf_basic_info.return_value = {'code': '512170', 'name': '医疗ETF'}
        mock_service.run_strategy_backtest.return_value = {
            'summary': {
                'annualized_return': 18.5,
                'max_drawdown': 7.8,
                'total_profit': 8800.0,
                'total_trades': 42,
            },
            'profit_pool': {'free_shares': 200},
            'equity_curve': [{'date': '2025-06-01', 'nav': 1.05}],
            'total_trades_all': [
                {'trade_time': '2025-06-02 10:15', 'action': 'BUY', 'rail': 'small', 'profit': 0.0}
            ],
            'history_meta': {'requested_days': 180, 'actual_trading_days': 120, 'is_partial_history': False}
        }

        # 1. 执行回测并验证自动归档
        resp = self.client.post('/api/backtest', json={
            'etfCode': '512170',
            'totalCapital': 50000.0,
            'backtestDays': 180,
            'stepMode': 'atr',
        })
        self.assertEqual(resp.status_code, 200)
        json_data = resp.get_json()
        self.assertTrue(json_data['success'])
        run_id = json_data['data'].get('run_id')
        self.assertIsNotNone(run_id)

        # 2. 查询列表
        list_resp = self.client.get('/api/backtest/records?etfCode=512170')
        self.assertEqual(list_resp.status_code, 200)
        list_data = list_resp.get_json()
        self.assertTrue(list_data['success'])
        self.assertGreaterEqual(list_data['data']['total'], 1)

        # 3. 查询单条明细
        detail_resp = self.client.get(f'/api/backtest/records/{run_id}')
        self.assertEqual(detail_resp.status_code, 200)
        detail_data = detail_resp.get_json()
        self.assertTrue(detail_data['success'])
        self.assertEqual(detail_data['data']['etf_code'], '512170')
        self.assertEqual(len(detail_data['data']['trades']), 1)

        # 4. 查询已测标的去重列表
        etfs_resp = self.client.get('/api/backtest/distinct-etfs')
        self.assertEqual(etfs_resp.status_code, 200)
        self.assertTrue(etfs_resp.get_json()['success'])

        # 5. 删除记录
        del_resp = self.client.delete(f'/api/backtest/records/{run_id}')
        self.assertEqual(del_resp.status_code, 200)
        self.assertTrue(del_resp.get_json()['success'])

        # 再次获取 404
        get_again = self.client.get(f'/api/backtest/records/{run_id}')
        self.assertEqual(get_again.status_code, 404)


if __name__ == '__main__':
    unittest.main()
