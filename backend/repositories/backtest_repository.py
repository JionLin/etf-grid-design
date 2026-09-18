import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from .mysql_connection import DEFAULT_DATABASE, connect
from .mysql_schema import ensure_database

logger = logging.getLogger(__name__)


class BacktestRepository:
    """个人回测档案。摘要与曲线分表，最新一条由写入时维护。"""

    def __init__(self, database: Optional[str] = None):
        self.database = database or DEFAULT_DATABASE
        ensure_database(self.database)

    def _connect(self):
        return connect(self.database)

    def _get_connection(self):
        return self._connect()

    def migrate_fix_timezone_offset(self):
        """把 run_id 里的本地时间与 created_at 相差约 8 小时的旧记录校正回来。"""
        conn = self._connect()
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id, run_id, created_at FROM backtest_run")
                updates = []
                for row in cursor.fetchall():
                    fixed = self._fixed_created_at(row["run_id"] or "", row["created_at"] or "")
                    if fixed:
                        updates.append((fixed, row["id"]))
                if updates:
                    cursor.executemany(
                        "UPDATE backtest_run SET created_at = %s WHERE id = %s",
                        updates,
                    )
            conn.commit()
        finally:
            conn.close()

    def _fixed_created_at(self, run_id: str, created_at: str) -> Optional[str]:
        parts = run_id.split("_")
        if len(parts) < 3 or len(parts[1]) != 8 or len(parts[2]) != 6:
            return None
        run_full = (
            f"{parts[1][:4]}-{parts[1][4:6]}-{parts[1][6:]} "
            f"{parts[2][:2]}:{parts[2][2:4]}:{parts[2][4:]}"
        )
        try:
            dt_run = datetime.strptime(run_full, "%Y-%m-%d %H:%M:%S")
            dt_created = datetime.strptime(created_at[:19], "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return None
        diff_hours = round((dt_run - dt_created).total_seconds() / 3600.0)
        if 7 <= diff_hours <= 9:
            return dt_run.strftime("%Y-%m-%d %H:%M:%S")
        return None

    @staticmethod
    def step_bucket(step_mode: Optional[str]) -> str:
        if step_mode in ("atr", "fixed_eda"):
            return step_mode
        return "unknown"

    @staticmethod
    def step_label(step_mode: Optional[str]) -> str:
        if step_mode == "atr":
            return "ATR 自适应"
        if step_mode == "fixed_eda":
            return "自定义网格"
        return "未知"

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
        summary = backtest_result.get("summary", {})
        meta = backtest_result.get("history_meta", {}) or summary.get("history_meta", {})
        actual_days = meta.get("actual_trading_days", backtest_days)
        is_partial = 1 if meta.get("is_partial_history") else 0
        profit_pool = backtest_result.get("profit_pool", {}) or summary.get("profit_pool", {})
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        bucket = self.step_bucket(step_mode)

        # 先计算派生指标，再做结果指纹查重：同参数同结果的重复回测直接跳过，不再新增档案
        annual_return = self._annual_return(summary, meta, actual_days)
        max_drawdown = round(float(summary.get("max_drawdown", 0.0) or 0.0), 2)
        total_profit = self._total_profit(summary, profit_pool)
        total_trades = self._total_trades(summary, backtest_result)
        free_shares = int(profit_pool.get("free_shares", 0) or 0)
        existing_run_id = self._find_duplicate_run(
            etf_code, backtest_days, bucket, reinvest_mode, total_capital,
            annual_return, max_drawdown, total_profit, total_trades, free_shares,
        )
        if existing_run_id:
            logger.info(
                "重复回测结果已存在，跳过归档: run_id=%s, etf=%s, days=%s",
                existing_run_id, etf_code, backtest_days,
            )
            return existing_run_id

        run_id = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        summary_json = json.dumps(summary, ensure_ascii=False)
        params_json = json.dumps(params or {}, ensure_ascii=False)
        equity_json = json.dumps(backtest_result.get("equity_curve", []), ensure_ascii=False)
        trades_all = backtest_result.get("total_trades_all", backtest_result.get("recent_trades", []))
        trades_json = json.dumps(trades_all, ensure_ascii=False)

        conn = self._connect()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE backtest_run SET is_latest = 0
                    WHERE etf_code = %s AND backtest_days = %s AND step_bucket = %s
                    """,
                    (etf_code, backtest_days, bucket),
                )
                cursor.execute(
                    """
                    INSERT INTO backtest_run (
                        run_id, etf_code, etf_name, backtest_days, actual_days,
                        total_capital, step_mode, step_bucket, reinvest_mode,
                        annual_return, max_drawdown, total_profit, total_trades, free_shares,
                        is_partial_history, partial_reason,
                        params_json, summary_json, created_at, is_latest
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1)
                    """,
                    (
                        run_id, etf_code, etf_name, backtest_days, actual_days,
                        total_capital, step_mode, bucket, reinvest_mode,
                        annual_return, max_drawdown, total_profit, total_trades, free_shares,
                        is_partial,
                        meta.get("partial_reason"),
                        params_json,
                        summary_json,
                        created_at,
                    ),
                )
            conn.commit()
        finally:
            conn.close()

        self._insert_payload(run_id, equity_json, trades_json)
        logger.info("回测快照归档成功: run_id=%s, etf=%s", run_id, etf_code)
        return run_id

    def _find_duplicate_run(
        self,
        etf_code: str,
        backtest_days: int,
        bucket: str,
        reinvest_mode: str,
        total_capital: float,
        annual_return: float,
        max_drawdown: float,
        total_profit: float,
        total_trades: int,
        free_shares: int,
    ) -> Optional[str]:
        """按结果指纹查重：同标的、同周期、同步长、同再投、同资金且关键指标完全一致 → 视为重复回测。"""
        try:
            conn = self._connect()
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT run_id FROM backtest_run
                        WHERE etf_code = %s AND backtest_days = %s AND step_bucket = %s
                          AND reinvest_mode = %s AND total_capital = %s
                          AND annual_return = %s AND max_drawdown = %s
                          AND total_profit = %s AND total_trades = %s AND free_shares = %s
                        ORDER BY id DESC LIMIT 1
                        """,
                        (
                            etf_code, backtest_days, bucket, reinvest_mode, float(total_capital),
                            annual_return, max_drawdown, total_profit, total_trades, free_shares,
                        ),
                    )
                    row = cursor.fetchone()
                    return row["run_id"] if row else None
            finally:
                conn.close()
        except Exception as exc:
            logger.error("回测结果查重失败，按新增处理: %s", exc)
            return None

    def _insert_payload(self, run_id: str, equity_json: str, trades_json: str) -> None:
        conn = self._connect()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO backtest_run_payload (run_id, equity_curve_json, trades_json)
                    VALUES (%s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        equity_curve_json = VALUES(equity_curve_json),
                        trades_json = VALUES(trades_json)
                    """,
                    (run_id, equity_json, trades_json),
                )
            conn.commit()
        except Exception as exc:
            logger.error("写入回测曲线失败 (%s): %s", run_id, exc)
            raise
        finally:
            conn.close()

    def _total_profit(self, summary: Dict[str, Any], profit_pool: Dict[str, Any]) -> float:
        raw_profit = (
            summary.get("grid_cash_profit")
            if summary.get("grid_cash_profit") is not None
            else profit_pool.get("total_profit_accumulated", summary.get("total_profit", 0.0))
        )
        return round(float(raw_profit or 0.0), 2)

    def _annual_return(self, summary: Dict[str, Any], meta: Dict[str, Any], actual_days: int) -> float:
        strategy_ret = float(summary.get("strategy_return", summary.get("total_return", 0.0)) or 0.0)
        calendar_days = meta.get("actual_calendar_days") or actual_days
        if "annualized_return" in summary:
            return float(summary["annualized_return"])
        if calendar_days and strategy_ret != 0.0:
            # 复利年化 (CAGR)：((1 + 区间收益率)^(365/日历天数) - 1) * 100
            cagr = ((1.0 + strategy_ret / 100.0) ** (365.0 / calendar_days) - 1.0) * 100.0
            return round(cagr, 2)
        return round(strategy_ret, 2)

    def _total_trades(self, summary: Dict[str, Any], result: Dict[str, Any]) -> int:
        return int(
            summary.get("total_trades_count")
            or summary.get("total_trades")
            or len(result.get("total_trades_all", []) or [])
        )

    def list_runs(
        self,
        etf_code: Optional[str] = None,
        days: Optional[int] = None,
        limit: int = 50,
        offset: int = 0,
        latest_only: bool = True,
        step_mode: Optional[str] = None,
        sector: Optional[str] = None,
        sector_map: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        conditions = []
        params: List[Any] = []
        if etf_code:
            conditions.append("etf_code = %s")
            params.append(str(etf_code).strip())
        if days is not None:
            conditions.append("backtest_days = %s")
            params.append(int(days))
        if step_mode == "atr":
            conditions.append("step_mode = %s")
            params.append("atr")
        elif step_mode == "fixed_eda":
            conditions.append("step_mode = %s")
            params.append("fixed_eda")
        elif step_mode == "unknown":
            conditions.append("step_mode NOT IN ('atr', 'fixed_eda')")
        if latest_only:
            conditions.append("is_latest = 1")
        where_sql = (" WHERE " + " AND ".join(conditions)) if conditions else ""
        query = f"""
            SELECT run_id, created_at, etf_code, etf_name, backtest_days, actual_days,
                   total_capital, step_mode, reinvest_mode,
                   annual_return, max_drawdown, total_profit, total_trades, free_shares,
                   is_partial_history, partial_reason, id
            FROM backtest_run
            {where_sql}
            ORDER BY backtest_days DESC, id DESC
        """
        conn = self._connect()
        try:
            with conn.cursor() as cursor:
                cursor.execute(query, params)
                rows = cursor.fetchall()
        finally:
            conn.close()

        records = self._decorate_rows(rows, sector, sector_map or {})
        total = len(records)
        start = max(0, offset)
        end = start + max(1, min(200, limit))
        page = records[start:end]
        self._attach_page_params(page)
        for item in page:
            item.pop("id", None)
        return {"total": total, "records": page}

    def _decorate_rows(self, rows, sector, sector_lookup) -> List[Dict[str, Any]]:
        records = []
        for row in rows:
            item = dict(row)
            item["sector"] = sector_lookup.get(item["etf_code"]) or "未入池"
            item["step_label"] = self.step_label(item.get("step_mode"))
            item["is_partial_history"] = bool(item["is_partial_history"])
            if sector and item["sector"] != sector:
                continue
            records.append(item)
        return records

    def _attach_page_params(self, page: List[Dict[str, Any]]) -> None:
        if not page:
            return
        ids = [item["id"] for item in page if item.get("id") is not None]
        if not ids:
            for item in page:
                item["params"] = {}
            return
        placeholders = ",".join(["%s"] * len(ids))
        conn = self._connect()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    f"SELECT id, params_json FROM backtest_run WHERE id IN ({placeholders})",
                    ids,
                )
                payloads = {row["id"]: row["params_json"] for row in cursor.fetchall()}
        finally:
            conn.close()
        for item in page:
            item["params"] = self._load_json(payloads.get(item.get("id")), {})

    def get_run_detail(self, run_id: str) -> Optional[Dict[str, Any]]:
        conn = self._connect()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT r.*, p.equity_curve_json, p.trades_json
                    FROM backtest_run r
                    LEFT JOIN backtest_run_payload p ON p.run_id = r.run_id
                    WHERE r.run_id = %s
                    """,
                    (run_id,),
                )
                row = cursor.fetchone()
        finally:
            conn.close()
        if not row:
            return None
        data = dict(row)
        data["is_partial_history"] = bool(data["is_partial_history"])
        data["params"] = self._load_json(data.pop("params_json", None), {})
        data["summary"] = self._load_json(data.pop("summary_json", None), {})
        data["equity_curve"] = self._load_json(data.pop("equity_curve_json", None), [])
        data["trades"] = self._load_json(data.pop("trades_json", None), [])
        return data

    def delete_run(self, run_id: str) -> bool:
        conn = self._connect()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT etf_code, backtest_days, step_bucket, is_latest FROM backtest_run WHERE run_id = %s",
                    (run_id,),
                )
                current = cursor.fetchone()
                cursor.execute("DELETE FROM backtest_run_payload WHERE run_id = %s", (run_id,))
                cursor.execute("DELETE FROM backtest_run WHERE run_id = %s", (run_id,))
                deleted = cursor.rowcount > 0
                if deleted and current and current["is_latest"]:
                    self._promote_latest(cursor, current)
            conn.commit()
            return deleted
        finally:
            conn.close()

    def _promote_latest(self, cursor, current: Dict[str, Any]) -> None:
        cursor.execute(
            """
            UPDATE backtest_run
            SET is_latest = 1
            WHERE etf_code = %s AND backtest_days = %s AND step_bucket = %s
            ORDER BY id DESC
            LIMIT 1
            """,
            (current["etf_code"], current["backtest_days"], current["step_bucket"]),
        )

    def backfill_latest_flags(self) -> None:
        conn = self._connect()
        try:
            with conn.cursor() as cursor:
                cursor.execute("UPDATE backtest_run SET is_latest = 0")
                cursor.execute(
                    """
                    UPDATE backtest_run r
                    INNER JOIN (
                        SELECT MAX(id) AS id
                        FROM backtest_run
                        GROUP BY etf_code, backtest_days, step_bucket
                    ) latest ON latest.id = r.id
                    SET r.is_latest = 1
                    """
                )
            conn.commit()
        finally:
            conn.close()

    def get_distinct_etfs(self) -> List[Dict[str, str]]:
        conn = self._connect()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT etf_code, etf_name
                    FROM backtest_run
                    GROUP BY etf_code, etf_name
                    ORDER BY MAX(created_at) DESC
                    """
                )
                return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def count_runs(self) -> int:
        conn = self._connect()
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) AS count FROM backtest_run")
                return int(cursor.fetchone()["count"])
        finally:
            conn.close()

    @staticmethod
    def _load_json(raw: Optional[str], fallback):
        try:
            return json.loads(raw or ("[]" if isinstance(fallback, list) else "{}"))
        except Exception:
            return fallback
