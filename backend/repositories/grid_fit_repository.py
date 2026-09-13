import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from .mysql_connection import DEFAULT_DATABASE, connect
from .mysql_schema import ensure_database

logger = logging.getLogger(__name__)

_UPSERT = """
INSERT INTO grid_fit_cell (
    etf_code, etf_name, sector, step_mode, protocol_version,
    calendar_days, sell_count, grid_cash_profit, cash_yield,
    annual_return, alpha, max_drawdown, status, status_reason,
    source_fingerprint, updated_at
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON DUPLICATE KEY UPDATE
    etf_name = VALUES(etf_name),
    sector = VALUES(sector),
    calendar_days = VALUES(calendar_days),
    sell_count = VALUES(sell_count),
    grid_cash_profit = VALUES(grid_cash_profit),
    cash_yield = VALUES(cash_yield),
    annual_return = VALUES(annual_return),
    alpha = VALUES(alpha),
    max_drawdown = VALUES(max_drawdown),
    status = VALUES(status),
    status_reason = VALUES(status_reason),
    source_fingerprint = VALUES(source_fingerprint),
    updated_at = VALUES(updated_at)
"""


class GridFitRepository:
    """适合度格。不存储权益曲线。"""

    def __init__(self, database: Optional[str] = None):
        self.database = database or DEFAULT_DATABASE
        ensure_database(self.database)

    def _connect(self):
        return connect(self.database)

    def upsert_run(self, record: Dict[str, Any]) -> None:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        conn = self._connect()
        try:
            with conn.cursor() as cursor:
                cursor.execute(_UPSERT, (
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
            conn.commit()
        finally:
            conn.close()

    def find_run(self, etf_code: str, step_mode: str, protocol_version: str) -> Optional[Dict[str, Any]]:
        conn = self._connect()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT * FROM grid_fit_cell
                    WHERE etf_code = %s AND step_mode = %s AND protocol_version = %s
                    """,
                    (etf_code, step_mode, protocol_version),
                )
                row = cursor.fetchone()
        finally:
            conn.close()
        return dict(row) if row else None

    def list_runs(self, protocol_version: str) -> List[Dict[str, Any]]:
        conn = self._connect()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT * FROM grid_fit_cell WHERE protocol_version = %s",
                    (protocol_version,),
                )
                return [dict(row) for row in cursor.fetchall()]
        finally:
            conn.close()
