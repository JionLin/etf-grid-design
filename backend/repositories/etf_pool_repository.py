import os
import json
import sqlite3
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

DEFAULT_DB_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "data", "market_cache.db")
)
DEFAULT_JSON_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "data", "etf_active_pool.json")
)


class ETFPoolRepository:
    """
    全市场做 T ETF 核心标的池本地持久化存储库
    支持 SQLite 高效过滤查询与本地 JSON 镜像快照双持久化
    """

    def __init__(self, db_path: Optional[str] = None, json_path: Optional[str] = None):
        self.db_path = db_path or DEFAULT_DB_PATH
        self.json_path = json_path or DEFAULT_JSON_PATH
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        os.makedirs(os.path.dirname(self.json_path), exist_ok=True)
        self._init_database()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=15)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_database(self):
        """初始化标的池表结构与 WAL 性能模式"""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("PRAGMA journal_mode=WAL;")
                cursor.execute("PRAGMA synchronous=NORMAL;")
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS etf_pool_metadata (
                        etf_code TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        sector TEXT NOT NULL,
                        is_t0 INTEGER DEFAULT 0,
                        list_date TEXT,
                        latest_price REAL DEFAULT 0.0,
                        pct_change REAL DEFAULT 0.0,
                        amount_10k REAL DEFAULT 0.0,
                        amount_ma20_10k REAL DEFAULT 0.0,
                        atr_pct REAL DEFAULT 0.0,
                        elasticity TEXT DEFAULT '稳健型',
                        score REAL DEFAULT 80.0,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                # 平滑迁移：若已存在表则动态增加 amount_ma20_10k 列
                try:
                    cursor.execute("ALTER TABLE etf_pool_metadata ADD COLUMN amount_ma20_10k REAL DEFAULT 0.0;")
                except Exception:
                    pass
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_pool_sector 
                    ON etf_pool_metadata(sector);
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_pool_amount 
                    ON etf_pool_metadata(amount_10k DESC);
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_pool_amount_ma20
                    ON etf_pool_metadata(amount_ma20_10k DESC);
                """)
                conn.commit()
        except Exception as e:
            logger.error(f"初始化本地标的池数据库失败: {e}")
            raise

    def save_pool(self, records: List[Dict[str, Any]]) -> int:
        """
        批量幂等保存标的池数据到 SQLite，并同步持久化本地 JSON 镜像
        """
        if not records:
            return 0

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        saved_count = 0

        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                sql = """
                    INSERT INTO etf_pool_metadata (
                        etf_code, name, sector, is_t0, list_date,
                        latest_price, pct_change, amount_10k, amount_ma20_10k, atr_pct,
                        elasticity, score, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(etf_code) DO UPDATE SET
                        name=excluded.name,
                        sector=excluded.sector,
                        is_t0=excluded.is_t0,
                        list_date=excluded.list_date,
                        latest_price=excluded.latest_price,
                        pct_change=excluded.pct_change,
                        amount_10k=excluded.amount_10k,
                        amount_ma20_10k=excluded.amount_ma20_10k,
                        atr_pct=excluded.atr_pct,
                        elasticity=excluded.elasticity,
                        score=excluded.score,
                        updated_at=excluded.updated_at;
                """
                tuples = [
                    (
                        r["etf_code"],
                        r["name"],
                        r["sector"],
                        1 if r.get("is_t0") else 0,
                        r.get("list_date", ""),
                        float(r.get("latest_price", 0.0)),
                        float(r.get("pct_change", 0.0)),
                        float(r.get("amount_10k", 0.0)),
                        float(r.get("amount_ma20_10k", r.get("amount_10k", 0.0))),
                        float(r.get("atr_pct", 0.0)),
                        r.get("elasticity", "稳健型"),
                        float(r.get("score", 80.0)),
                        now_str,
                    )
                    for r in records
                ]
                cursor.executemany(sql, tuples)
                conn.commit()
                saved_count = len(tuples)

            # 同步写 JSON 镜像快照
            try:
                with open(self.json_path, "w", encoding="utf-8") as f:
                    json.dump(
                        {
                            "updated_at": now_str,
                            "total": len(records),
                            "items": records,
                        },
                        f,
                        ensure_ascii=False,
                        indent=2,
                    )
            except Exception as json_err:
                logger.warning(f"写入标的池本地 JSON 镜像失败: {json_err}")

            return saved_count
        except Exception as e:
            logger.error(f"批量保存标的池数据失败: {e}")
            raise

    def get_pool(
        self,
        sector: Optional[str] = None,
        is_t0: Optional[bool] = None,
        elasticity: Optional[str] = None,
        min_amount_10k: float = 0.0,
        min_ma20_amount_10k: float = 3000.0,
        min_atr_pct: float = 1.5,
        limit: int = 200,
    ) -> List[Dict[str, Any]]:
        """
        三维正交多条件组合过滤查询（默认月均成交额 >= 3000 万元，ATR >= 1.5%）
        """
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                query = "SELECT * FROM etf_pool_metadata WHERE amount_ma20_10k >= ? AND amount_10k >= ? AND atr_pct >= ?"
                params: List[Any] = [min_ma20_amount_10k, min_amount_10k, min_atr_pct]

                if sector and sector != "全部":
                    query += " AND sector = ?"
                    params.append(sector)

                if is_t0 is not None and is_t0 is True:
                    query += " AND is_t0 = 1"

                if elasticity and elasticity != "全部":
                    query += " AND elasticity = ?"
                    params.append(elasticity)

                query += " ORDER BY amount_ma20_10k DESC LIMIT ?"
                params.append(limit)

                cursor.execute(query, params)
                rows = cursor.fetchall()

                return [
                    {
                        "etf_code": row["etf_code"],
                        "name": row["name"],
                        "sector": row["sector"],
                        "is_t0": bool(row["is_t0"]),
                        "list_date": row["list_date"],
                        "latest_price": row["latest_price"],
                        "pct_change": row["pct_change"],
                        "amount_10k": row["amount_10k"],
                        "amount_ma20_10k": row["amount_ma20_10k"] if "amount_ma20_10k" in row.keys() else row["amount_10k"],
                        "atr_pct": row["atr_pct"],
                        "elasticity": row["elasticity"],
                        "score": row["score"],
                        "updated_at": row["updated_at"],
                    }
                    for row in rows
                ]
        except Exception as e:
            logger.error(f"查询标的池数据失败: {e}")
            return []

    def get_sectors_summary(
        self,
        min_ma20_amount_10k: float = 3000.0,
        min_atr_pct: float = 1.5
    ) -> Dict[str, Any]:
        """获取各 8 大赛道及 T+0 标的统计分布（默认月均成交额 >= 3000 万元，ATR >= 1.5%）"""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT sector, COUNT(*) as count, AVG(atr_pct) as avg_atr
                    FROM etf_pool_metadata
                    WHERE amount_ma20_10k >= ? AND atr_pct >= ?
                    GROUP BY sector
                    ORDER BY count DESC
                """,
                    (min_ma20_amount_10k, min_atr_pct),
                )
                sector_rows = cursor.fetchall()

                cursor.execute(
                    """
                    SELECT COUNT(*) as count FROM etf_pool_metadata
                    WHERE amount_ma20_10k >= ? AND atr_pct >= ? AND is_t0 = 1
                """,
                    (min_ma20_amount_10k, min_atr_pct),
                )
                t0_count = cursor.fetchone()["count"]

                cursor.execute(
                    """
                    SELECT COUNT(*) as count FROM etf_pool_metadata
                    WHERE amount_ma20_10k >= ? AND atr_pct >= ?
                """,
                    (min_ma20_amount_10k, min_atr_pct),
                )
                total_count = cursor.fetchone()["count"]

                return {
                    "total_count": total_count,
                    "t0_count": t0_count,
                    "sectors": [
                        {
                            "name": r["sector"],
                            "count": r["count"],
                            "avg_atr": round(r["avg_atr"] or 0.0, 2),
                        }
                        for r in sector_rows
                    ],
                }
        except Exception as e:
            logger.error(f"查询赛道统计失败: {e}")
            return {"total_count": 0, "t0_count": 0, "sectors": []}

    def get_count(self) -> int:
        """获取标的池总条数"""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) as count FROM etf_pool_metadata")
                return cursor.fetchone()["count"]
        except Exception:
            return 0
