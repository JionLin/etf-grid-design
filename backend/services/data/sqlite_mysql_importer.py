"""把既有 SQLite 一次性导入 MySQL。可重入，不读取估值孤儿表。"""
import logging
import os
import sqlite3
from typing import Dict, Optional

from repositories.backtest_repository import BacktestRepository
from repositories.mysql_connection import DEFAULT_DATABASE, connect
from repositories.mysql_schema import ensure_database

logger = logging.getLogger(__name__)

_DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))


def import_existing_sqlite(database: Optional[str] = None, data_dir: Optional[str] = None) -> Dict[str, int]:
    target = database or DEFAULT_DATABASE
    folder = data_dir or _DATA_DIR
    ensure_database(target)
    bar_count = _import_bars(os.path.join(folder, "market_data.db"), target)
    pool_count = _import_pool(os.path.join(folder, "market_cache.db"), target)
    run_count = _import_archives(os.path.join(folder, "backtest_records.db"), target)
    BacktestRepository(database=target).backfill_latest_flags()
    return {"bars": bar_count, "instruments": pool_count, "runs": run_count}


def _import_bars(path: str, database: str) -> int:
    if not os.path.exists(path):
        raise FileNotFoundError(path)
    source = sqlite3.connect(path)
    source.row_factory = sqlite3.Row
    try:
        rows = source.execute(
            """
            SELECT etf_code, trade_date, open, close, high, low, vol, amount, pct_chg
            FROM etf_daily_bars
            """
        ).fetchall()
    finally:
        source.close()
    _write_bars(database, rows)
    return len(rows)


def _write_bars(database: str, rows) -> None:
    if not rows:
        return
    conn = connect(database)
    try:
        with conn.cursor() as cursor:
            for offset in range(0, len(rows), 500):
                chunk = rows[offset:offset + 500]
                cursor.executemany(
                    """
                    INSERT INTO etf_daily_bar (
                        etf_code, trade_date, open, close, high, low, vol, amount, pct_chg
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        open = VALUES(open), close = VALUES(close), high = VALUES(high),
                        low = VALUES(low), vol = VALUES(vol), amount = VALUES(amount),
                        pct_chg = VALUES(pct_chg)
                    """,
                    [
                        (
                            row["etf_code"], row["trade_date"], row["open"], row["close"],
                            row["high"], row["low"], row["vol"], row["amount"], row["pct_chg"],
                        )
                        for row in chunk
                    ],
                )
        conn.commit()
    finally:
        conn.close()


def _import_pool(path: str, database: str) -> int:
    if not os.path.exists(path):
        raise FileNotFoundError(path)
    source = sqlite3.connect(path)
    source.row_factory = sqlite3.Row
    try:
        names = {row[0] for row in source.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if "etf_daily_valuations" in names:
            logger.info("跳过 etf_daily_valuations")
        rows = source.execute("SELECT * FROM etf_pool_metadata").fetchall()
    finally:
        source.close()
    _write_pool(database, rows)
    return len(rows)


def _write_pool(database: str, rows) -> None:
    if not rows:
        return
    conn = connect(database)
    try:
        with conn.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO etf_instrument (
                    etf_code, name, sector, is_t0, list_date, latest_price, pct_change,
                    amount_10k, amount_ma20_10k, atr_pct, elasticity, score, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name), sector = VALUES(sector), is_t0 = VALUES(is_t0),
                    list_date = VALUES(list_date), latest_price = VALUES(latest_price),
                    pct_change = VALUES(pct_change), amount_10k = VALUES(amount_10k),
                    amount_ma20_10k = VALUES(amount_ma20_10k), atr_pct = VALUES(atr_pct),
                    elasticity = VALUES(elasticity), score = VALUES(score),
                    updated_at = VALUES(updated_at)
                """,
                [
                    (
                        row["etf_code"], row["name"], row["sector"], row["is_t0"], row["list_date"],
                        row["latest_price"], row["pct_change"], row["amount_10k"],
                        row["amount_ma20_10k"] if "amount_ma20_10k" in row.keys() else row["amount_10k"],
                        row["atr_pct"], row["elasticity"], row["score"], row["updated_at"],
                    )
                    for row in rows
                ],
            )
        conn.commit()
    finally:
        conn.close()


def _import_archives(path: str, database: str) -> int:
    if not os.path.exists(path):
        raise FileNotFoundError(path)
    source = sqlite3.connect(path)
    source.row_factory = sqlite3.Row
    try:
        rows = source.execute("SELECT * FROM backtest_runs").fetchall()
    finally:
        source.close()
    written = 0
    for row in rows:
        if _archive_exists(database, row["run_id"]):
            continue
        _insert_archive(database, row)
        written += 1
    return len(rows)


def _archive_exists(database: str, run_id: str) -> bool:
    conn = connect(database)
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1 AS found FROM backtest_run WHERE run_id = %s", (run_id,))
            return cursor.fetchone() is not None
    finally:
        conn.close()


def _insert_archive(database: str, row) -> None:
    bucket = row["step_mode"] if row["step_mode"] in ("atr", "fixed_eda") else "unknown"
    conn = connect(database)
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO backtest_run (
                    run_id, created_at, etf_code, etf_name, backtest_days, actual_days,
                    total_capital, step_mode, step_bucket, reinvest_mode,
                    annual_return, max_drawdown, total_profit, total_trades, free_shares,
                    is_partial_history, partial_reason, params_json, summary_json, is_latest
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 0)
                """,
                (
                    row["run_id"], row["created_at"], row["etf_code"], row["etf_name"],
                    row["backtest_days"], row["actual_days"], row["total_capital"],
                    row["step_mode"], bucket, row["reinvest_mode"],
                    row["annual_return"], row["max_drawdown"], row["total_profit"],
                    row["total_trades"], row["free_shares"], row["is_partial_history"],
                    row["partial_reason"], row["params_json"], row["summary_json"],
                ),
            )
        conn.commit()
    finally:
        conn.close()
    _insert_payload(database, row["run_id"], row["equity_curve_json"], row["trades_json"])


def _insert_payload(database: str, run_id: str, equity_json, trades_json) -> None:
    conn = connect(database)
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
        logger.error("导入曲线失败 (%s): %s", run_id, exc)
        raise
    finally:
        conn.close()


def sqlite_table_count(path: str, table: str) -> int:
    conn = sqlite3.connect(path)
    try:
        return int(conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])
    finally:
        conn.close()
