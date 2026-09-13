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
        sector_code VARCHAR(32) NOT NULL COMMENT '赛道编码，与名称相同',
        name VARCHAR(64) NOT NULL COMMENT '赛道名称',
        PRIMARY KEY (sector_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='可购赛道目录'
    """,
    """
    CREATE TABLE IF NOT EXISTS etf_subsector (
        subsector_code VARCHAR(64) NOT NULL COMMENT '小类编码，与名称相同，全库互斥',
        sector_code VARCHAR(32) NOT NULL COMMENT '所属赛道编码',
        name VARCHAR(64) NOT NULL COMMENT '小类名称',
        sort_order INT NOT NULL COMMENT '同一赛道内的展示顺序，从小到大',
        PRIMARY KEY (subsector_code),
        KEY idx_subsector_sector (sector_code, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='互斥小类目录'
    """,
    """
    CREATE TABLE IF NOT EXISTS etf_instrument (
        etf_code VARCHAR(16) NOT NULL COMMENT 'ETF代码，不含交易所前缀',
        name VARCHAR(128) NOT NULL COMMENT 'ETF名称',
        sector VARCHAR(32) NOT NULL COMMENT '所属赛道。未命中可购赛道时为未归类',
        subsector_code VARCHAR(64) NULL COMMENT '互斥小类编码。未命中小类时为空，首页按此下钻',
        is_t0 TINYINT NOT NULL DEFAULT 0 COMMENT '是否支持日内回转。1是，0否',
        list_date VARCHAR(64) NULL COMMENT '上市说明文本，不一定是日期',
        latest_price DOUBLE NOT NULL DEFAULT 0 COMMENT '最新价',
        pct_change DOUBLE NOT NULL DEFAULT 0 COMMENT '最新涨跌幅，百分比',
        amount_10k DOUBLE NOT NULL DEFAULT 0 COMMENT '最新成交额，单位万元',
        amount_ma20_10k DOUBLE NOT NULL DEFAULT 0 COMMENT '近20日均成交额，单位万元。雷达门槛3000',
        atr_pct DOUBLE NOT NULL DEFAULT 0 COMMENT 'ATR波幅，百分比。雷达门槛1.5',
        elasticity VARCHAR(32) NOT NULL DEFAULT '稳健型' COMMENT '弹性档位：高弹性、稳健型、低波防守',
        score DOUBLE NOT NULL DEFAULT 80 COMMENT '做T评分',
        is_seed TINYINT NOT NULL DEFAULT 0 COMMENT '是否为该小类流动性最高的种子。1是，0否',
        updated_at VARCHAR(32) NULL COMMENT '最近写入时间，东八区本地时间字符串',
        PRIMARY KEY (etf_code),
        KEY idx_instrument_sector (sector),
        KEY idx_instrument_subsector (subsector_code),
        KEY idx_instrument_ma20 (amount_ma20_10k)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='做T标的池。首页雷达读这张表'
    """,
    """
    CREATE TABLE IF NOT EXISTS etf_daily_bar (
        etf_code VARCHAR(16) NOT NULL COMMENT 'ETF代码',
        trade_date CHAR(10) NOT NULL COMMENT '交易日，格式YYYY-MM-DD',
        open DOUBLE NOT NULL COMMENT '前复权开盘价',
        close DOUBLE NOT NULL COMMENT '前复权收盘价',
        high DOUBLE NOT NULL COMMENT '前复权最高价',
        low DOUBLE NOT NULL COMMENT '前复权最低价',
        vol DOUBLE NOT NULL COMMENT '成交量，单位手',
        amount DOUBLE NOT NULL COMMENT '成交额，单位元',
        pct_chg DOUBLE NOT NULL COMMENT '当日涨跌幅，百分比',
        created_at VARCHAR(32) NULL COMMENT '入库时间，东八区本地时间字符串',
        PRIMARY KEY (etf_code, trade_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='日K线'
    """,
    """
    CREATE TABLE IF NOT EXISTS grid_fit_cell (
        etf_code VARCHAR(16) NOT NULL COMMENT 'ETF代码',
        etf_name VARCHAR(128) NULL COMMENT '写入时的标的名称快照',
        sector VARCHAR(32) NULL COMMENT '写入时的赛道快照',
        step_mode VARCHAR(32) NOT NULL COMMENT '步长模式。atr为ATR自适应，fixed_eda为自定义网格',
        protocol_version VARCHAR(16) NOT NULL COMMENT '适合度协议版本，当前为v1',
        calendar_days INT NULL COMMENT '实际回看日历天数',
        sell_count INT NULL COMMENT '卖出次数',
        grid_cash_profit DOUBLE NULL COMMENT '网格现金收益',
        cash_yield DOUBLE NULL COMMENT '现金收益率',
        annual_return DOUBLE NULL COMMENT '年化收益率',
        alpha DOUBLE NULL COMMENT '相对买入持有的超额收益',
        max_drawdown DOUBLE NULL COMMENT '最大回撤',
        status VARCHAR(32) NOT NULL COMMENT '入榜状态',
        status_reason VARCHAR(255) NULL COMMENT '状态说明，如已入榜、成交过稀、回撤超线、样本短于五年、未就绪',
        source_fingerprint VARCHAR(64) NULL COMMENT '行情窗口指纹。相同则不重算',
        updated_at VARCHAR(32) NULL COMMENT '最近写入时间，东八区本地时间字符串',
        PRIMARY KEY (etf_code, step_mode, protocol_version)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='网格适合度结果。不含权益曲线和成交明细'
    """,
    """
    CREATE TABLE IF NOT EXISTS backtest_run (
        id BIGINT NOT NULL AUTO_INCREMENT COMMENT '自增主键',
        run_id VARCHAR(64) NOT NULL COMMENT '档案业务主键',
        created_at VARCHAR(32) NULL COMMENT '创建时间，东八区本地时间字符串',
        etf_code VARCHAR(16) NOT NULL COMMENT 'ETF代码',
        etf_name VARCHAR(128) NOT NULL COMMENT '写入时的标的名称快照',
        backtest_days INT NOT NULL COMMENT '请求回看天数',
        actual_days INT NOT NULL COMMENT '实际可用交易日数',
        total_capital DOUBLE NOT NULL COMMENT '回测本金',
        step_mode VARCHAR(32) NOT NULL COMMENT '步长模式。atr为ATR自适应，fixed_eda为自定义网格',
        step_bucket VARCHAR(32) NOT NULL COMMENT '最新标记分组。atr与fixed_eda各自一组，其余为unknown',
        reinvest_mode VARCHAR(32) NOT NULL COMMENT '收益处理。cash为留现金，pool_shares为利润池滚存留股',
        annual_return DOUBLE NOT NULL DEFAULT 0 COMMENT '年化收益率',
        max_drawdown DOUBLE NOT NULL DEFAULT 0 COMMENT '最大回撤',
        total_profit DOUBLE NOT NULL DEFAULT 0 COMMENT '总收益',
        total_trades INT NOT NULL DEFAULT 0 COMMENT '成交次数',
        free_shares INT NOT NULL DEFAULT 0 COMMENT '做T后剩余股数',
        is_partial_history TINYINT NOT NULL DEFAULT 0 COMMENT '历史是否短于请求窗口。1是，已用全部可用历史',
        partial_reason VARCHAR(255) NULL COMMENT '历史不足说明',
        params_json MEDIUMTEXT NULL COMMENT '请求参数快照，不含曲线',
        summary_json MEDIUMTEXT NULL COMMENT '指标摘要，不含权益曲线和成交明细',
        is_latest TINYINT NOT NULL DEFAULT 0 COMMENT '是否为同一标的、同一回看天数、同一步长分组下的最新档案。1是',
        PRIMARY KEY (id),
        UNIQUE KEY uk_backtest_run_id (run_id),
        KEY idx_backtest_latest (etf_code, backtest_days, step_bucket, is_latest)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='个人回测档案摘要'
    """,
    """
    CREATE TABLE IF NOT EXISTS backtest_run_payload (
        run_id VARCHAR(64) NOT NULL COMMENT '对应backtest_run.run_id',
        equity_curve_json MEDIUMTEXT NULL COMMENT '权益曲线JSON',
        trades_json MEDIUMTEXT NULL COMMENT '成交明细JSON',
        PRIMARY KEY (run_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='个人回测档案的权益曲线和成交明细'
    """,
)

_COMMENT_ALTERS = (
    """
    ALTER TABLE etf_sector
        COMMENT = '可购赛道目录',
        MODIFY COLUMN sector_code VARCHAR(32) NOT NULL COMMENT '赛道编码，与名称相同',
        MODIFY COLUMN name VARCHAR(64) NOT NULL COMMENT '赛道名称'
    """,
    """
    ALTER TABLE etf_subsector
        COMMENT = '互斥小类目录',
        MODIFY COLUMN subsector_code VARCHAR(64) NOT NULL COMMENT '小类编码，与名称相同，全库互斥',
        MODIFY COLUMN sector_code VARCHAR(32) NOT NULL COMMENT '所属赛道编码',
        MODIFY COLUMN name VARCHAR(64) NOT NULL COMMENT '小类名称',
        MODIFY COLUMN sort_order INT NOT NULL COMMENT '同一赛道内的展示顺序，从小到大'
    """,
    """
    ALTER TABLE etf_instrument
        COMMENT = '做T标的池。首页雷达读这张表',
        MODIFY COLUMN etf_code VARCHAR(16) NOT NULL COMMENT 'ETF代码，不含交易所前缀',
        MODIFY COLUMN name VARCHAR(128) NOT NULL COMMENT 'ETF名称',
        MODIFY COLUMN sector VARCHAR(32) NOT NULL COMMENT '所属赛道。未命中可购赛道时为未归类',
        MODIFY COLUMN subsector_code VARCHAR(64) NULL COMMENT '互斥小类编码。未命中小类时为空，首页按此下钻',
        MODIFY COLUMN is_t0 TINYINT NOT NULL DEFAULT 0 COMMENT '是否支持日内回转。1是，0否',
        MODIFY COLUMN list_date VARCHAR(64) NULL COMMENT '上市说明文本，不一定是日期',
        MODIFY COLUMN latest_price DOUBLE NOT NULL DEFAULT 0 COMMENT '最新价',
        MODIFY COLUMN pct_change DOUBLE NOT NULL DEFAULT 0 COMMENT '最新涨跌幅，百分比',
        MODIFY COLUMN amount_10k DOUBLE NOT NULL DEFAULT 0 COMMENT '最新成交额，单位万元',
        MODIFY COLUMN amount_ma20_10k DOUBLE NOT NULL DEFAULT 0 COMMENT '近20日均成交额，单位万元。雷达门槛3000',
        MODIFY COLUMN atr_pct DOUBLE NOT NULL DEFAULT 0 COMMENT 'ATR波幅，百分比。雷达门槛1.5',
        MODIFY COLUMN elasticity VARCHAR(32) NOT NULL DEFAULT '稳健型' COMMENT '弹性档位：高弹性、稳健型、低波防守',
        MODIFY COLUMN score DOUBLE NOT NULL DEFAULT 80 COMMENT '做T评分',
        MODIFY COLUMN is_seed TINYINT NOT NULL DEFAULT 0 COMMENT '是否为该小类流动性最高的种子。1是，0否',
        MODIFY COLUMN updated_at VARCHAR(32) NULL COMMENT '最近写入时间，东八区本地时间字符串'
    """,
    """
    ALTER TABLE etf_daily_bar
        COMMENT = '日K线',
        MODIFY COLUMN etf_code VARCHAR(16) NOT NULL COMMENT 'ETF代码',
        MODIFY COLUMN trade_date CHAR(10) NOT NULL COMMENT '交易日，格式YYYY-MM-DD',
        MODIFY COLUMN open DOUBLE NOT NULL COMMENT '前复权开盘价',
        MODIFY COLUMN close DOUBLE NOT NULL COMMENT '前复权收盘价',
        MODIFY COLUMN high DOUBLE NOT NULL COMMENT '前复权最高价',
        MODIFY COLUMN low DOUBLE NOT NULL COMMENT '前复权最低价',
        MODIFY COLUMN vol DOUBLE NOT NULL COMMENT '成交量，单位手',
        MODIFY COLUMN amount DOUBLE NOT NULL COMMENT '成交额，单位元',
        MODIFY COLUMN pct_chg DOUBLE NOT NULL COMMENT '当日涨跌幅，百分比',
        MODIFY COLUMN created_at VARCHAR(32) NULL COMMENT '入库时间，东八区本地时间字符串'
    """,
    """
    ALTER TABLE grid_fit_cell
        COMMENT = '网格适合度结果。不含权益曲线和成交明细',
        MODIFY COLUMN etf_code VARCHAR(16) NOT NULL COMMENT 'ETF代码',
        MODIFY COLUMN etf_name VARCHAR(128) NULL COMMENT '写入时的标的名称快照',
        MODIFY COLUMN sector VARCHAR(32) NULL COMMENT '写入时的赛道快照',
        MODIFY COLUMN step_mode VARCHAR(32) NOT NULL COMMENT '步长模式。atr为ATR自适应，fixed_eda为自定义网格',
        MODIFY COLUMN protocol_version VARCHAR(16) NOT NULL COMMENT '适合度协议版本，当前为v1',
        MODIFY COLUMN calendar_days INT NULL COMMENT '实际回看日历天数',
        MODIFY COLUMN sell_count INT NULL COMMENT '卖出次数',
        MODIFY COLUMN grid_cash_profit DOUBLE NULL COMMENT '网格现金收益',
        MODIFY COLUMN cash_yield DOUBLE NULL COMMENT '现金收益率',
        MODIFY COLUMN annual_return DOUBLE NULL COMMENT '年化收益率',
        MODIFY COLUMN alpha DOUBLE NULL COMMENT '相对买入持有的超额收益',
        MODIFY COLUMN max_drawdown DOUBLE NULL COMMENT '最大回撤',
        MODIFY COLUMN status VARCHAR(32) NOT NULL COMMENT '入榜状态',
        MODIFY COLUMN status_reason VARCHAR(255) NULL COMMENT '状态说明，如已入榜、成交过稀、回撤超线、样本短于五年、未就绪',
        MODIFY COLUMN source_fingerprint VARCHAR(64) NULL COMMENT '行情窗口指纹。相同则不重算',
        MODIFY COLUMN updated_at VARCHAR(32) NULL COMMENT '最近写入时间，东八区本地时间字符串'
    """,
    """
    ALTER TABLE backtest_run
        COMMENT = '个人回测档案摘要',
        MODIFY COLUMN id BIGINT NOT NULL AUTO_INCREMENT COMMENT '自增主键',
        MODIFY COLUMN run_id VARCHAR(64) NOT NULL COMMENT '档案业务主键',
        MODIFY COLUMN created_at VARCHAR(32) NULL COMMENT '创建时间，东八区本地时间字符串',
        MODIFY COLUMN etf_code VARCHAR(16) NOT NULL COMMENT 'ETF代码',
        MODIFY COLUMN etf_name VARCHAR(128) NOT NULL COMMENT '写入时的标的名称快照',
        MODIFY COLUMN backtest_days INT NOT NULL COMMENT '请求回看天数',
        MODIFY COLUMN actual_days INT NOT NULL COMMENT '实际可用交易日数',
        MODIFY COLUMN total_capital DOUBLE NOT NULL COMMENT '回测本金',
        MODIFY COLUMN step_mode VARCHAR(32) NOT NULL COMMENT '步长模式。atr为ATR自适应，fixed_eda为自定义网格',
        MODIFY COLUMN step_bucket VARCHAR(32) NOT NULL COMMENT '最新标记分组。atr与fixed_eda各自一组，其余为unknown',
        MODIFY COLUMN reinvest_mode VARCHAR(32) NOT NULL COMMENT '收益处理。cash为留现金，pool_shares为利润池滚存留股',
        MODIFY COLUMN annual_return DOUBLE NOT NULL DEFAULT 0 COMMENT '年化收益率',
        MODIFY COLUMN max_drawdown DOUBLE NOT NULL DEFAULT 0 COMMENT '最大回撤',
        MODIFY COLUMN total_profit DOUBLE NOT NULL DEFAULT 0 COMMENT '总收益',
        MODIFY COLUMN total_trades INT NOT NULL DEFAULT 0 COMMENT '成交次数',
        MODIFY COLUMN free_shares INT NOT NULL DEFAULT 0 COMMENT '做T后剩余股数',
        MODIFY COLUMN is_partial_history TINYINT NOT NULL DEFAULT 0 COMMENT '历史是否短于请求窗口。1是，已用全部可用历史',
        MODIFY COLUMN partial_reason VARCHAR(255) NULL COMMENT '历史不足说明',
        MODIFY COLUMN params_json MEDIUMTEXT NULL COMMENT '请求参数快照，不含曲线',
        MODIFY COLUMN summary_json MEDIUMTEXT NULL COMMENT '指标摘要，不含权益曲线和成交明细',
        MODIFY COLUMN is_latest TINYINT NOT NULL DEFAULT 0 COMMENT '是否为同一标的、同一回看天数、同一步长分组下的最新档案。1是'
    """,
    """
    ALTER TABLE backtest_run_payload
        COMMENT = '个人回测档案的权益曲线和成交明细',
        MODIFY COLUMN run_id VARCHAR(64) NOT NULL COMMENT '对应backtest_run.run_id',
        MODIFY COLUMN equity_curve_json MEDIUMTEXT NULL COMMENT '权益曲线JSON',
        MODIFY COLUMN trades_json MEDIUMTEXT NULL COMMENT '成交明细JSON'
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


def apply_table_comments(database: Optional[str] = None) -> None:
    """给已存在的表补上表备注和列备注。不改数据，可重复执行。"""
    target = database or DEFAULT_DATABASE
    if target not in (DEFAULT_DATABASE, TEST_DATABASE):
        raise ValueError(f"拒绝修改未登记的库: {target}")
    conn = connect(target)
    try:
        with conn.cursor() as cursor:
            for statement in _COMMENT_ALTERS:
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
