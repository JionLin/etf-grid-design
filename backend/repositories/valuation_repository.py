"""
基于轻量 SQLite WAL 模式的 ETF 估值与选品雷达持久化存储引擎
管理 etf_daily_valuations 表，提供毫秒级 SQL 索引排序与冷启动自动种子初始化
"""
import os
import json
import sqlite3
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


class ValuationRepository:
    """基于轻量 SQLite 的 ETF 估值与雷达数据持久化存储库"""

    def __init__(self, db_path: Optional[str] = None, seed_json_path: Optional[str] = None):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if db_path is None:
            db_path = os.path.join(base_dir, "data", "market_cache.db")
        if seed_json_path is None:
            seed_json_path = os.path.join(base_dir, "data", "index_valuation_snapshot_latest.json")

        self.db_path = db_path
        self.seed_json_path = seed_json_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_database()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_database(self):
        """初始化数据表与 WAL 模式，若表为空则自动载入出厂种子数据"""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("PRAGMA journal_mode=WAL;")
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS etf_daily_valuations (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        etf_code TEXT NOT NULL,
                        etf_name TEXT NOT NULL,
                        index_code TEXT NOT NULL,
                        index_name TEXT NOT NULL,
                        industry_type TEXT NOT NULL,
                        trade_date TEXT NOT NULL,
                        current_pe REAL,
                        pe_pct_5y REAL,
                        pe_pct_10y REAL,
                        current_pb REAL,
                        pb_pct_5y REAL,
                        pb_pct_10y REAL,
                        dividend_yield REAL,
                        erp_value REAL,
                        safe_score REAL NOT NULL,
                        tier TEXT NOT NULL,
                        suggested_base REAL NOT NULL,
                        is_fatal_flaw INTEGER DEFAULT 0,
                        fatal_flaw_reason TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(etf_code, trade_date)
                    );
                """)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_radar_safe_score ON etf_daily_valuations(trade_date, safe_score DESC);")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_radar_industry ON etf_daily_valuations(industry_type, safe_score DESC);")
                conn.commit()

            # 检查是否有数据，若为空则自动载入种子数据
            self._load_seed_if_empty()
        except Exception as e:
            logger.error(f"初始化估值数据库失败: {e}")

    def _load_seed_if_empty(self):
        """若数据库为空，从本地快照底表载入初始冷启动数据"""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM etf_daily_valuations;")
                count = cursor.fetchone()[0]
                if count > 0:
                    return

            if not os.path.exists(self.seed_json_path):
                logger.warning(f"种子数据文件不存在: {self.seed_json_path}")
                return

            with open(self.seed_json_path, "r", encoding="utf-8") as f:
                snapshot_data = json.load(f)

            records = []
            # 常见 ETF 与指数对应映射关系
            mapping = {
                "000300": {"etf_code": "510300", "etf_name": "沪深300ETF (华泰柏瑞)", "ind": "broad_balanced"},
                "000905": {"etf_code": "510500", "etf_name": "中证500ETF (南方)", "ind": "broad_balanced"},
                "000852": {"etf_code": "512100", "etf_name": "中证1000ETF (南方)", "ind": "broad_balanced"},
                "399006": {"etf_code": "159915", "etf_name": "创业板ETF (易方达)", "ind": "broad_balanced"},
                "000688": {"etf_code": "588000", "etf_name": "科创50ETF (华夏)", "ind": "tech_growth"},
                "H30269": {"etf_code": "512890", "etf_name": "红利低波ETF (华泰柏瑞)", "ind": "cyclical_asset"},
                "000820": {"etf_code": "515220", "etf_name": "煤炭ETF (国泰)", "ind": "cyclical_asset"},
                "399986": {"etf_code": "512800", "etf_name": "银行ETF (华宝)", "ind": "cyclical_asset"},
                "399989": {"etf_code": "512170", "etf_name": "医疗ETF (华宝)", "ind": "broad_balanced"},
                "931151": {"etf_code": "515790", "etf_name": "光伏ETF (华泰柏瑞)", "ind": "tech_growth"},
                "930606": {"etf_code": "512480", "etf_name": "半导体ETF (国联安)", "ind": "tech_growth"},
                "399975": {"etf_code": "512000", "etf_name": "券商ETF (华宝)", "ind": "cyclical_asset"},
                "399976": {"etf_code": "515030", "etf_name": "新能源车ETF (华夏)", "ind": "tech_growth"},
                "H30533": {"etf_code": "513050", "etf_name": "中概互联ETF (易方达)", "ind": "tech_growth"}
            }

            trade_date = "2026-09-11"
            for clean_code, info in snapshot_data.items():
                if clean_code in mapping:
                    meta = mapping[clean_code]
                    pe = float(info.get("pe", 0.0) or 0.0)
                    pb = float(info.get("pb", 0.0) or 0.0)
                    pe_10y = float(info.get("pe_percentile", 50.0))
                    pb_10y = float(info.get("pb_percentile", 50.0))
                    pe_5y = round(max(1.0, min(99.0, pe_10y * 0.92 + 3.5)), 1)
                    pb_5y = round(max(1.0, min(99.0, pb_10y * 0.95 + 2.0)), 1)
                    div_yield = float(info.get("dividend_yield", 0.0) or 0.0)
                    
                    earnings_yield = round((1.0 / pe) * 100.0, 2) if pe > 0 else 0.0
                    erp_val = round(earnings_yield - 2.10, 2) if pe > 0 else 0.0
                    
                    # 计算安全分
                    pe_safe = max(0.0, 100.0 - pe_10y)
                    pb_safe = max(0.0, 100.0 - pb_10y)
                    div_score = min(98.0, max(20.0, div_yield * 15.0 + 20.0))
                    erp_score = 90.0 if erp_val >= 4.0 else (75.0 if erp_val >= 2.0 else 50.0)
                    
                    if meta["ind"] == "cyclical_asset":
                        score = pb_safe * 0.40 + div_score * 0.30 + erp_score * 0.20 + pe_safe * 0.10
                    elif meta["ind"] == "tech_growth":
                        score = pe_safe * 0.40 + erp_score * 0.30 + pb_safe * 0.20 + div_score * 0.10
                    else:
                        score = pe_safe * 0.30 + pb_safe * 0.30 + erp_score * 0.20 + div_score * 0.20
                    safe_score = round(score, 1)

                    tier = "极寒低估" if safe_score >= 85 else ("偏冷适中" if safe_score >= 70 else "适温合理")
                    suggested_base = 0.60 if safe_score >= 85 else (0.55 if safe_score >= 70 else 0.50)

                    records.append({
                        "etf_code": meta["etf_code"],
                        "etf_name": meta["etf_name"],
                        "index_code": info.get("index_code", clean_code),
                        "index_name": info.get("name", meta["etf_name"]),
                        "industry_type": meta["ind"],
                        "trade_date": trade_date,
                        "current_pe": pe,
                        "pe_pct_5y": pe_5y,
                        "pe_pct_10y": pe_10y,
                        "current_pb": pb,
                        "pb_pct_5y": pb_5y,
                        "pb_pct_10y": pb_10y,
                        "dividend_yield": div_yield,
                        "erp_value": erp_val,
                        "safe_score": safe_score,
                        "tier": tier,
                        "suggested_base": suggested_base,
                        "is_fatal_flaw": 0,
                        "fatal_flaw_reason": None
                    })

            self.batch_upsert_valuations(records)
            logger.info(f"成功载入初始估值冷启动种子数据: {len(records)} 条")
        except Exception as e:
            logger.error(f"载入估值种子数据异常: {e}")

    def batch_upsert_valuations(self, records: List[Dict[str, Any]]):
        """批量写入或更新估值记录"""
        if not records:
            return
        sql = """
            INSERT OR REPLACE INTO etf_daily_valuations (
                etf_code, etf_name, index_code, index_name, industry_type,
                trade_date, current_pe, pe_pct_5y, pe_pct_10y,
                current_pb, pb_pct_5y, pb_pct_10y, dividend_yield,
                erp_value, safe_score, tier, suggested_base,
                is_fatal_flaw, fatal_flaw_reason
            ) VALUES (
                :etf_code, :etf_name, :index_code, :index_name, :industry_type,
                :trade_date, :current_pe, :pe_pct_5y, :pe_pct_10y,
                :current_pb, :pb_pct_5y, :pb_pct_10y, :dividend_yield,
                :erp_value, :safe_score, :tier, :suggested_base,
                :is_fatal_flaw, :fatal_flaw_reason
            )
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.executemany(sql, records)
            conn.commit()

    def query_radar_rankings(
        self,
        category: str = "all",
        trade_date: Optional[str] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        查询雷达榜单，支持分类筛选
        
        Args:
            category: 分类筛选 ('all', 'extreme_bottom', 'dividend', 'cyclical', 'tech')
            trade_date: 交易日期 (默认取库中最新日期)
            limit: 返回条数
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()

            # 若未指定交易日，取最新可用日期
            if not trade_date:
                cursor.execute("SELECT MAX(trade_date) FROM etf_daily_valuations;")
                row = cursor.fetchone()
                trade_date = row[0] if row and row[0] else ""

            where_clauses = ["trade_date = ?"]
            params: List[Any] = [trade_date]

            if category == "extreme_bottom":
                where_clauses.append("(tier = '极寒低估' OR safe_score >= 85.0)")
            elif category == "dividend":
                where_clauses.append("dividend_yield >= 3.0")
            elif category == "cyclical":
                where_clauses.append("industry_type = 'cyclical_asset'")
            elif category == "tech":
                where_clauses.append("industry_type = 'tech_growth'")

            where_sql = " AND ".join(where_clauses)
            sql = f"""
                SELECT * FROM etf_daily_valuations
                WHERE {where_sql}
                ORDER BY safe_score DESC
                LIMIT ?;
            """
            params.append(limit)

            cursor.execute(sql, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
