"""etf_grid 表结构。价格列用 DOUBLE，档案曲线与摘要分表。"""
import logging
from typing import Optional

import pymysql

from .mysql_connection import (
    DEFAULT_DATABASE,
    TEST_DATABASE,
    connect,
    connect_server,
)

logger = logging.getLogger(__name__)

BUSINESS_TABLES = (
    "backtest_run_payload",
    "backtest_run",
    "grid_fit_cell",
    "etf_daily_bar",
    "etf_instrument",
)

_STATEMENTS = (
    """
    CREATE TABLE IF NOT EXISTS etf_sector (
        sector_code VARCHAR(32) NOT NULL,
        name VARCHAR(64) NOT NULL,
        PRIMARY KEY (sector_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS etf_subsector (
        subsector_code VARCHAR(64) NOT NULL,
        sector_code VARCHAR(32) NOT NULL,
        name VARCHAR(64) NOT NULL,
        sort_order INT NOT NULL,
        PRIMARY KEY (subsector_code),
        KEY idx_subsector_sector (sector_code, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS etf_instrument (
        etf_code VARCHAR(16) NOT NULL,
        name VARCHAR(128) NOT NULL,
        sector VARCHAR(32) NOT NULL,
        subsector_code VARCHAR(64) NULL,
        is_t0 TINYINT NOT NULL DEFAULT 0,
        list_date VARCHAR(64) NULL,
        latest_price DOUBLE NOT NULL DEFAULT 0,
        pct_change DOUBLE NOT NULL DEFAULT 0,
        amount_10k DOUBLE NOT NULL DEFAULT 0,
        amount_ma20_10k DOUBLE NOT NULL DEFAULT 0,
        atr_pct DOUBLE NOT NULL DEFAULT 0,
        elasticity VARCHAR(32) NOT NULL DEFAULT '稳健型',
        score DOUBLE NOT NULL DEFAULT 80,
        is_seed TINYINT NOT NULL DEFAULT 0,
        updated_at VARCHAR(32) NULL,
        PRIMARY KEY (etf_code),
        KEY idx_instrument_sector (sector),
        KEY idx_instrument_subsector (subsector_code),
        KEY idx_instrument_ma20 (amount_ma20_10k)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS etf_daily_bar (
        etf_code VARCHAR(16) NOT NULL,
        trade_date CHAR(10) NOT NULL,
        open DOUBLE NOT NULL,
        close DOUBLE NOT NULL,
        high DOUBLE NOT NULL,
        low DOUBLE NOT NULL,
        vol DOUBLE NOT NULL,
        amount DOUBLE NOT NULL,
        pct_chg DOUBLE NOT NULL,
        created_at VARCHAR(32) NULL,
        PRIMARY KEY (etf_code, trade_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS grid_fit_cell (
        etf_code VARCHAR(16) NOT NULL,
        etf_name VARCHAR(128) NULL,
        sector VARCHAR(32) NULL,
        step_mode VARCHAR(32) NOT NULL,
        protocol_version VARCHAR(16) NOT NULL,
        calendar_days INT NULL,
        sell_count INT NULL,
        grid_cash_profit DOUBLE NULL,
        cash_yield DOUBLE NULL,
        annual_return DOUBLE NULL,
        alpha DOUBLE NULL,
        max_drawdown DOUBLE NULL,
        status VARCHAR(32) NOT NULL,
        status_reason VARCHAR(255) NULL,
        source_fingerprint VARCHAR(64) NULL,
        updated_at VARCHAR(32) NULL,
        PRIMARY KEY (etf_code, step_mode, protocol_version)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS backtest_run (
        id BIGINT NOT NULL AUTO_INCREMENT,
        run_id VARCHAR(64) NOT NULL,
        created_at VARCHAR(32) NULL,
        etf_code VARCHAR(16) NOT NULL,
        etf_name VARCHAR(128) NOT NULL,
        backtest_days INT NOT NULL,
        actual_days INT NOT NULL,
        total_capital DOUBLE NOT NULL,
        step_mode VARCHAR(32) NOT NULL,
        step_bucket VARCHAR(32) NOT NULL,
        reinvest_mode VARCHAR(32) NOT NULL,
        annual_return DOUBLE NOT NULL DEFAULT 0,
        max_drawdown DOUBLE NOT NULL DEFAULT 0,
        total_profit DOUBLE NOT NULL DEFAULT 0,
        total_trades INT NOT NULL DEFAULT 0,
        free_shares INT NOT NULL DEFAULT 0,
        is_partial_history TINYINT NOT NULL DEFAULT 0,
        partial_reason VARCHAR(255) NULL,
        params_json MEDIUMTEXT NULL,
        summary_json MEDIUMTEXT NULL,
        is_latest TINYINT NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        UNIQUE KEY uk_backtest_run_id (run_id),
        KEY idx_backtest_latest (etf_code, backtest_days, step_bucket, is_latest)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS backtest_run_payload (
        run_id VARCHAR(64) NOT NULL,
        equity_curve_json MEDIUMTEXT NULL,
        trades_json MEDIUMTEXT NULL,
        PRIMARY KEY (run_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
)


def ensure_database(name: str) -> None:
    """建库并建表。库名只允许本项目的两个固定库。"""
    if name not in (DEFAULT_DATABASE, TEST_DATABASE):
        raise ValueError(f"拒绝创建未登记的库: {name}")
    server = connect_server()
    try:
        with server.cursor() as cursor:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{name}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
        server.commit()
    finally:
        server.close()
    ensure_tables(name)


def ensure_tables(database: Optional[str] = None) -> None:
    conn = connect(database)
    try:
        with conn.cursor() as cursor:
            for statement in _STATEMENTS:
                cursor.execute(statement)
        conn.commit()
    finally:
        conn.close()


def reset_business_tables(database: str) -> None:
    """清空业务表，保留小类目录。仅允许测试库。"""
    if database != TEST_DATABASE:
        raise ValueError("只能清空测试库")
    ensure_database(database)
    conn = connect(database)
    try:
        with conn.cursor() as cursor:
            cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
            for table in BUSINESS_TABLES:
                cursor.execute(f"TRUNCATE TABLE {table}")
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
        conn.commit()
    finally:
        conn.close()


def show_create_table(database: str, table: str) -> str:
    conn = connect(database)
    try:
        with conn.cursor() as cursor:
            cursor.execute(f"SHOW CREATE TABLE `{table}`")
            row = cursor.fetchone()
            return row["Create Table"]
    finally:
        conn.close()
