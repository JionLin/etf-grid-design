import os
import sqlite3
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class GridFitRepository:
    """适合度榜独立表。查询个人档案时不得读取本表。"""

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
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS grid_fit_runs (
                    etf_code TEXT NOT NULL,
                    etf_name TEXT,
                    sector TEXT,
                    step_mode TEXT NOT NULL,
                    protocol_version TEXT NOT NULL,
                    calendar_days INTEGER,
                    sell_count INTEGER,
                    grid_cash_profit REAL,
                    cash_yield REAL,
                    annual_return REAL,
                    alpha REAL,
                    max_drawdown REAL,
                    status TEXT NOT NULL,
                    status_reason TEXT,
                    source_fingerprint TEXT,
                    updated_at TEXT,
                    PRIMARY KEY (etf_code, step_mode, protocol_version)
                )
            """)
            columns = {
                row[1] for row in conn.execute("PRAGMA table_info(grid_fit_runs)").fetchall()
            }
            if "source_fingerprint" not in columns:
                conn.execute("ALTER TABLE grid_fit_runs ADD COLUMN source_fingerprint TEXT")

    def upsert_run(self, record: Dict[str, Any]) -> None:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO grid_fit_runs (
                    etf_code, etf_name, sector, step_mode, protocol_version,
                    calendar_days, sell_count, grid_cash_profit, cash_yield,
                    annual_return, alpha, max_drawdown, status, status_reason,
                    source_fingerprint, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(etf_code, step_mode, protocol_version) DO UPDATE SET
                    etf_name=excluded.etf_name,
                    sector=excluded.sector,
                    calendar_days=excluded.calendar_days,
                    sell_count=excluded.sell_count,
                    grid_cash_profit=excluded.grid_cash_profit,
                    cash_yield=excluded.cash_yield,
                    annual_return=excluded.annual_return,
                    alpha=excluded.alpha,
                    max_drawdown=excluded.max_drawdown,
                    status=excluded.status,
                    status_reason=excluded.status_reason,
                    source_fingerprint=excluded.source_fingerprint,
                    updated_at=excluded.updated_at
            """, (
                record["etf_code"],
                record.get("etf_name"),
                record.get("sector"),
                record["step_mode"],
                record["protocol_version"],
                record.get("calendar_days"),
                record.get("sell_count"),
                record.get("grid_cash_profit"),
                record.get("cash_yield"),
                record.get("annual_return"),
                record.get("alpha"),
                record.get("max_drawdown"),
                record["status"],
                record.get("status_reason"),
                record.get("source_fingerprint"),
                now,
            ))

    def find_run(self, etf_code: str, step_mode: str, protocol_version: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute(
                """
                SELECT * FROM grid_fit_runs
                WHERE etf_code = ? AND step_mode = ? AND protocol_version = ?
                """,
                (etf_code, step_mode, protocol_version),
            ).fetchone()
        return dict(row) if row else None

    def list_runs(self, protocol_version: str) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM grid_fit_runs WHERE protocol_version = ?",
                (protocol_version,),
            ).fetchall()
        return [dict(row) for row in rows]
