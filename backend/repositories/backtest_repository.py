import os
import json
import sqlite3
import logging
from datetime import datetime
import uuid
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


class BacktestRepository:
    """基于轻量 SQLite 的本地网格回测档案库存储引擎"""

    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            db_path = os.path.join(base_dir, "data", "backtest_records.db")

        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_database()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_database(self):
        """初始化数据表与 WAL 模式"""
        try:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                # 开启 WAL 模式提高并发性能与写入吞吐
                cursor.execute("PRAGMA journal_mode=WAL;")
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS backtest_runs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        run_id TEXT UNIQUE NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        etf_code TEXT NOT NULL,
                        etf_name TEXT NOT NULL,
                        backtest_days INTEGER NOT NULL,
                        actual_days INTEGER NOT NULL,
                        total_capital REAL NOT NULL,
                        step_mode TEXT NOT NULL,
                        reinvest_mode TEXT NOT NULL,
                        annual_return REAL DEFAULT 0.0,
                        max_drawdown REAL DEFAULT 0.0,
                        total_profit REAL DEFAULT 0.0,
                        total_trades INTEGER DEFAULT 0,
                        free_shares INTEGER DEFAULT 0,
                        is_partial_history INTEGER DEFAULT 0,
                        partial_reason TEXT,
                        params_json TEXT,
                        summary_json TEXT,
                        equity_curve_json TEXT,
                        trades_json TEXT
                    );
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_backtest_runs_etf_created 
                    ON backtest_runs(etf_code, created_at DESC);
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_backtest_runs_created 
                    ON backtest_runs(created_at DESC);
                """)
                conn.commit()
                logger.info(f"BacktestRepository 初始化完成: {self.db_path}")
            finally:
                conn.close()
            # 自动自愈修复历史数据
            self.migrate_fix_zero_metrics()
        except Exception as e:
            logger.error(f"初始化回测数据库失败: {str(e)}")
            raise

    def migrate_fix_zero_metrics(self):
        """扫描并自愈已有历史快照中因字段错位导致 total_profit 或 annual_return 为 0 的记录"""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, summary_json, actual_days 
                FROM backtest_runs 
                WHERE total_profit = 0.0 OR annual_return = 0.0
            """)
            rows = cursor.fetchall()
            updates = []
            for row in rows:
                rec_id = row["id"]
                sum_json = row["summary_json"]
                act_days = row["actual_days"] or 180
                if not sum_json:
                    continue
                try:
                    s = json.loads(sum_json)
                    pp = s.get("profit_pool", {})
                    meta = s.get("history_meta", {})
                    cal_days = meta.get("actual_calendar_days") or act_days

                    raw_profit = (
                        s.get("grid_cash_profit") 
                        if s.get("grid_cash_profit") is not None 
                        else pp.get("total_profit_accumulated", s.get("total_profit", 0.0))
                    )
                    recovered_profit = round(float(raw_profit or 0.0), 2)

                    strat_ret = float(s.get("strategy_return", s.get("total_return", 0.0)))
                    if "annualized_return" in s:
                        recovered_annual = float(s["annualized_return"])
                    elif cal_days > 0 and strat_ret != 0.0:
                        recovered_annual = round(strat_ret * (365.0 / cal_days), 2)
                    else:
                        recovered_annual = round(strat_ret, 2)

                    updates.append((recovered_annual, recovered_profit, rec_id))
                except Exception:
                    continue

            if updates:
                cursor.executemany("""
                    UPDATE backtest_runs 
                    SET annual_return = ?, total_profit = ? 
                    WHERE id = ?
                """, updates)
                conn.commit()
                logger.info(f"成功自愈回测历史档案指标: 共修复 {len(updates)} 条记录")
        except Exception as e:
            logger.warning(f"自愈回测历史档案指标失败: {e}")
        finally:
            conn.close()

    def save_run(
        self,
        etf_code: str,
        etf_name: str,
        backtest_days: int,
        total_capital: float,
        step_mode: str,
        reinvest_mode: str,
        backtest_result: Dict[str, Any],
        params: Optional[Dict[str, Any]] = None,
    ) -> str:
        """保存一次策略回测完整快照"""
        run_id = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        summary = backtest_result.get("summary", {})
        meta = backtest_result.get("history_meta", {}) or summary.get("history_meta", {})

        actual_days = meta.get("actual_trading_days", backtest_days)
        actual_cal_days = meta.get("actual_calendar_days") or actual_days
        is_partial = 1 if meta.get("is_partial_history") else 0
        partial_reason = meta.get("partial_reason")

        profit_pool = backtest_result.get("profit_pool", {}) or summary.get("profit_pool", {})
        free_shares = int(profit_pool.get("free_shares", 0))

        # 1. 真实对齐做 T 纯利润 (优先取 grid_cash_profit 与 total_profit_accumulated)
        raw_profit = (
            summary.get("grid_cash_profit")
            if summary.get("grid_cash_profit") is not None
            else profit_pool.get("total_profit_accumulated", summary.get("total_profit", 0.0))
        )
        total_profit = round(float(raw_profit or 0.0), 2)

        # 2. 真实年化收益率折算
        strategy_ret = float(summary.get("strategy_return", summary.get("total_return", 0.0)))
        if "annualized_return" in summary:
            annual_return = float(summary["annualized_return"])
        elif actual_cal_days > 0 and strategy_ret != 0.0:
            annual_return = round(strategy_ret * (365.0 / actual_cal_days), 2)
        else:
            annual_return = round(strategy_ret, 2)

        max_drawdown = round(float(summary.get("max_drawdown", 0.0)), 2)
        total_trades = int(
            summary.get("total_trades_count")
            or summary.get("total_trades")
            or len(backtest_result.get("total_trades_all", []))
        )

        summary_json = json.dumps(summary, ensure_ascii=False)
        equity_curve_json = json.dumps(backtest_result.get("equity_curve", []), ensure_ascii=False)
        trades_all = backtest_result.get("total_trades_all", backtest_result.get("recent_trades", []))
        trades_json = json.dumps(trades_all, ensure_ascii=False)
        params_json = json.dumps(params or {}, ensure_ascii=False)

        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO backtest_runs (
                    run_id, etf_code, etf_name, backtest_days, actual_days,
                    total_capital, step_mode, reinvest_mode,
                    annual_return, max_drawdown, total_profit, total_trades, free_shares,
                    is_partial_history, partial_reason,
                    params_json, summary_json, equity_curve_json, trades_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                run_id, etf_code, etf_name, backtest_days, actual_days,
                total_capital, step_mode, reinvest_mode,
                annual_return, max_drawdown, total_profit, total_trades, free_shares,
                is_partial, partial_reason,
                params_json, summary_json, equity_curve_json, trades_json
            ))
            conn.commit()
        finally:
            conn.close()

        logger.info(f"回测快照归档成功: run_id={run_id}, etf={etf_code}, trades={total_trades}")
        return run_id

    def list_runs(
        self,
        etf_code: Optional[str] = None,
        days: Optional[int] = None,
        limit: int = 50,
        offset: int = 0,
        latest_only: bool = True,
    ) -> Dict[str, Any]:
        """获取回测档案轻量列表 (支持按标的+周期去重，仅展示最新一条)"""
        conditions = []
        params: List[Any] = []

        if etf_code:
            conditions.append("etf_code = ?")
            params.append(str(etf_code).strip())

        if days is not None:
            conditions.append("backtest_days = ?")
            params.append(int(days))

        if latest_only:
            query = """
                SELECT 
                    run_id, created_at, etf_code, etf_name, backtest_days, actual_days,
                    total_capital, step_mode, reinvest_mode,
                    annual_return, max_drawdown, total_profit, total_trades, free_shares,
                    is_partial_history, partial_reason, params_json
                FROM (
                    SELECT *,
                        ROW_NUMBER() OVER (PARTITION BY etf_code, backtest_days ORDER BY id DESC) as rn
                    FROM backtest_runs
            """
            count_query = """
                SELECT COUNT(*) as total FROM (
                    SELECT id,
                        ROW_NUMBER() OVER (PARTITION BY etf_code, backtest_days ORDER BY id DESC) as rn
                    FROM backtest_runs
            """
            if conditions:
                where_clause = " WHERE " + " AND ".join(conditions)
                query += where_clause
                count_query += where_clause
            query += ") WHERE rn = 1 ORDER BY id DESC LIMIT ? OFFSET ?"
            count_query += ") WHERE rn = 1"
        else:
            query = """
                SELECT 
                    run_id, created_at, etf_code, etf_name, backtest_days, actual_days,
                    total_capital, step_mode, reinvest_mode,
                    annual_return, max_drawdown, total_profit, total_trades, free_shares,
                    is_partial_history, partial_reason, params_json
                FROM backtest_runs
            """
            count_query = "SELECT COUNT(*) as total FROM backtest_runs"
            if conditions:
                where_clause = " WHERE " + " AND ".join(conditions)
                query += where_clause
                count_query += where_clause
            query += " ORDER BY id DESC LIMIT ? OFFSET ?"

        fetch_params = params + [max(1, min(200, limit)), max(0, offset)]

        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(count_query, params)
            total = cursor.fetchone()["total"]

            cursor.execute(query, fetch_params)
            rows = cursor.fetchall()

            records = []
            for r in rows:
                item = dict(r)
                item["is_partial_history"] = bool(item["is_partial_history"])
                try:
                    item["params"] = json.loads(item.get("params_json") or "{}")
                except Exception:
                    item["params"] = {}
                records.append(item)
            return {"total": total, "records": records}
        finally:
            conn.close()

    def get_run_detail(self, run_id: str) -> Optional[Dict[str, Any]]:
        """获取单次回测全量详情，反序列化 json 字段实现即时无损还原"""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM backtest_runs WHERE run_id = ?", (run_id,))
            row = cursor.fetchone()
            if not row:
                return None

            data = dict(row)
            data["is_partial_history"] = bool(data["is_partial_history"])
            try:
                data["params"] = json.loads(data.pop("params_json", None) or "{}")
            except Exception:
                data["params"] = {}
            try:
                data["summary"] = json.loads(data.pop("summary_json", None) or "{}")
            except Exception:
                data["summary"] = {}
            try:
                data["equity_curve"] = json.loads(data.pop("equity_curve_json", None) or "[]")
            except Exception:
                data["equity_curve"] = []
            try:
                data["trades"] = json.loads(data.pop("trades_json", None) or "[]")
            except Exception:
                data["trades"] = []

            return data
        finally:
            conn.close()

    def delete_run(self, run_id: str) -> bool:
        """删除指定回测记录"""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM backtest_runs WHERE run_id = ?", (run_id,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()

    def get_distinct_etfs(self) -> List[Dict[str, str]]:
        """获取历史已测过的标的代码和名称列表，供前端筛选下拉框使用"""
        conn = self._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT DISTINCT etf_code, etf_name 
                FROM backtest_runs 
                ORDER BY created_at DESC
            """)
            return [dict(r) for r in cursor.fetchall()]
        finally:
            conn.close()
