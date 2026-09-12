import os
import sqlite3
import logging
from typing import Dict, Any, List, Optional, Union
import pandas as pd

logger = logging.getLogger(__name__)

DEFAULT_DB_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "data", "market_data.db")
)


class MarketDataRepository:
    """
    ETF 日 K 线时序数据本地 SQLite 存储库
    支持单日级持久化缓存、WAL 并发模式、幂等批量覆盖及多周期毫秒级切片直出
    """

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or DEFAULT_DB_PATH
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_database()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=15)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_database(self):
        """初始化数据表结构与 WAL 性能模式"""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("PRAGMA journal_mode=WAL;")
                cursor.execute("PRAGMA synchronous=NORMAL;")
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS etf_daily_bars (
                        etf_code TEXT NOT NULL,
                        trade_date TEXT NOT NULL,
                        open REAL NOT NULL,
                        close REAL NOT NULL,
                        high REAL NOT NULL,
                        low REAL NOT NULL,
                        vol REAL NOT NULL,
                        amount REAL NOT NULL,
                        pct_chg REAL NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (etf_code, trade_date)
                    );
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_bars_code_date 
                    ON etf_daily_bars(etf_code, trade_date ASC);
                """)
                conn.commit()
        except Exception as e:
            logger.error(f"初始化本地日 K 时序数据库失败: {e}")
            raise

    def _normalize_date_str(self, val: Any) -> str:
        """统一日期格式为 YYYY-MM-DD"""
        if val is None:
            return ""
        s = str(val).strip()
        # 处理 20240122 这种无横线格式
        if len(s) == 8 and s.isdigit():
            return f"{s[:4]}-{s[4:6]}-{s[6:]}"
        # 处理带时间戳或者标准横线
        if len(s) >= 10:
            return s[:10].replace("/", "-")
        return s

    def save_bars(self, etf_code: str, bars: Union[pd.DataFrame, List[Dict[str, Any]]]) -> int:
        """
        批量幂等保存日 K 线数据 (INSERT OR REPLACE)
        """
        if bars is None:
            return 0

        clean_code = etf_code.split(".")[0]
        records: List[tuple] = []

        if isinstance(bars, pd.DataFrame):
            if bars.empty:
                return 0
            date_col = "date" if "date" in bars.columns else "trade_date"
            for _, row in bars.iterrows():
                d_str = self._normalize_date_str(row.get(date_col))
                if not d_str:
                    continue
                o = float(row.get("open", 0.0) or 0.0)
                c = float(row.get("close", 0.0) or 0.0)
                h = float(row.get("high", o) or o)
                l = float(row.get("low", o) or o)
                v = float(row.get("vol", 0.0) or 0.0)
                a = float(row.get("amount", 0.0) or 0.0)
                p = float(row.get("pct_chg", 0.0) or 0.0)
                records.append((clean_code, d_str, o, c, h, l, v, a, p))
        elif isinstance(bars, list):
            for row in bars:
                d_str = self._normalize_date_str(row.get("trade_date") or row.get("date"))
                if not d_str:
                    continue
                o = float(row.get("open", 0.0) or 0.0)
                c = float(row.get("close", 0.0) or 0.0)
                h = float(row.get("high", o) or o)
                l = float(row.get("low", o) or o)
                v = float(row.get("vol", 0.0) or 0.0)
                a = float(row.get("amount", 0.0) or 0.0)
                p = float(row.get("pct_chg", 0.0) or 0.0)
                records.append((clean_code, d_str, o, c, h, l, v, a, p))

        if not records:
            return 0

        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.executemany("""
                    INSERT OR REPLACE INTO etf_daily_bars (
                        etf_code, trade_date, open, close, high, low, vol, amount, pct_chg
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, records)
                conn.commit()
                return len(records)
        except Exception as e:
            logger.error(f"批量保存日 K 线时序数据失败 ({etf_code}): {e}")
            return 0

    def get_date_range(self, etf_code: str) -> Dict[str, Any]:
        """
        获取本地已存历史 K 线的起止日期及总交易日数
        """
        clean_code = etf_code.split(".")[0]
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT MIN(trade_date) as min_date, MAX(trade_date) as max_date, COUNT(*) as count 
                    FROM etf_daily_bars 
                    WHERE etf_code = ?
                """, (clean_code,))
                row = cursor.fetchone()
                if row and row["count"] > 0:
                    return {
                        "min_date": row["min_date"],
                        "max_date": row["max_date"],
                        "total_count": row["count"]
                    }
        except Exception as e:
            logger.warning(f"查询本地日 K 起止日期失败 ({etf_code}): {e}")

        return {"min_date": None, "max_date": None, "total_count": 0}

    def get_bars(
        self,
        etf_code: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: Optional[int] = None
    ) -> pd.DataFrame:
        """
        从本地 SQLite 按日期升序提取日 K 线 DataFrame
        """
        clean_code = etf_code.split(".")[0]
        params: List[Any] = [clean_code]
        query = "SELECT trade_date, open, close, high, low, vol, amount, pct_chg FROM etf_daily_bars WHERE etf_code = ?"

        if start_date:
            norm_start = self._normalize_date_str(start_date)
            query += " AND trade_date >= ?"
            params.append(norm_start)

        if end_date:
            norm_end = self._normalize_date_str(end_date)
            query += " AND trade_date <= ?"
            params.append(norm_end)

        query += " ORDER BY trade_date ASC"

        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                rows = cursor.fetchall()
                if not rows:
                    return pd.DataFrame()

                data = [dict(r) for r in rows]
                if limit and len(data) > limit:
                    data = data[-limit:]

                df = pd.DataFrame(data)
                df["trade_date"] = pd.to_datetime(df["trade_date"])
                return df
        except Exception as e:
            logger.error(f"提取本地日 K 线时序数据失败 ({etf_code}): {e}")
            return pd.DataFrame()
