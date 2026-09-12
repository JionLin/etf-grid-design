"""
ATR计算器 - 纯算法实现
从服务层抽离的ATR核心算法模块
"""

import pandas as pd
import numpy as np
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)

class ATRCalculator:
    """ATR计算器 - 纯算法实现"""
    
    def __init__(self, period: int = 14):
        """
        初始化ATR计算器
        
        Args:
            period: ATR计算周期，默认14天
        """
        self.period = period
    
    def _validate_data(self, df: pd.DataFrame) -> None:
        """验证输入数据质量"""
        required_columns = ['date', 'open', 'high', 'low', 'close']
        for col in required_columns:
            if col not in df.columns:
                raise KeyError(f"缺少必要列: {col}")
        
        if df.empty:
            raise ValueError("数据为空")
        
        # 检查价格数据合理性
        if (df['high'] < df['low']).any():
            raise ValueError("最高价低于最低价")
        
        if (df['high'] <= 0).any() or (df['low'] <= 0).any() or (df['close'] <= 0).any():
            raise ValueError("价格数据包含非正值")
        
        # 检查缺失值
        if df[required_columns].isnull().any().any():
            raise ValueError("数据包含缺失值")
    
    def calculate_true_range(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        计算真实波幅（True Range）
        考虑跳空因素，比传统日振幅更准确
        
        Args:
            df: 包含OHLC数据的DataFrame
            
        Returns:
            添加了TR列的DataFrame
        """
        try:
            # 验证数据质量
            self._validate_data(df)
            
            # 确保数据按日期排序
            df = df.sort_values('date')
            
            # 计算前一日收盘价
            df['prev_close'] = df['close'].shift(1)
            
            # 计算三种波幅
            df['hl'] = df['high'] - df['low']  # 当日最高最低价差
            df['hc'] = abs(df['high'] - df['prev_close'])  # 最高价与前日收盘价差
            df['lc'] = abs(df['low'] - df['prev_close'])   # 最低价与前日收盘价差
            
            # 真实波幅 = max(hl, hc, lc)
            df['tr'] = df[['hl', 'hc', 'lc']].max(axis=1)
            
            # 清理临时列
            df = df.drop(['hl', 'hc', 'lc'], axis=1)
            
            logger.info(f"计算真实波幅完成，数据量: {len(df)}")
            return df
            
        except Exception as e:
            logger.error(f"计算真实波幅失败: {str(e)}")
            raise
    
    def calculate_atr(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        计算ATR（平均真实波幅）
        
        Args:
            df: 包含OHLC数据的DataFrame
            
        Returns:
            添加了ATR相关指标的DataFrame
        """
        try:
            # 先计算真实波幅
            df = self.calculate_true_range(df)
            
            # 计算ATR（真实波幅的移动平均）
            df['ATR'] = df['tr'].rolling(window=self.period, min_periods=1).mean()
            
            # 计算ATR比率（标准化处理）
            df['close_avg'] = df['close'].rolling(window=self.period, min_periods=1).mean()
            df['atr_ratio'] = df['ATR'] / df['close_avg']
            
            # 计算ATR百分比（更直观的表示）
            df['atr_pct'] = df['atr_ratio'] * 100
            
            logger.info(f"计算ATR完成，周期: {self.period}天")
            return df
            
        except Exception as e:
            logger.error(f"计算ATR失败: {str(e)}")
            raise
    
    def process_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        完整的ATR数据处理流程
        
        Args:
            df: 原始OHLC数据
            
        Returns:
            处理后的DataFrame
        """
        try:
            # 1. 计算真实波幅
            df = self.calculate_true_range(df)
            
            # 2. 计算ATR
            df = self.calculate_atr(df)
            
            logger.info("ATR数据处理完成")
            return df
            
        except Exception as e:
            logger.error(f"ATR数据处理失败: {str(e)}")
            raise

def calculate_volatility(df: pd.DataFrame) -> float:
    """
    计算年化历史波动率
    
    Args:
        df: 包含收盘价的DataFrame
        
    Returns:
        年化波动率
    """
    try:
        # 计算日收益率
        df['returns'] = np.log(df['close'] / df['close'].shift(1))
        
        # 计算年化波动率
        daily_volatility = df['returns'].std()
        annual_volatility = daily_volatility * np.sqrt(252)  # 252个交易日
        
        return float(annual_volatility)
        
    except Exception as e:
        logger.error(f"波动率计算失败: {str(e)}")
        return 0.0

def build_directional_movement(high: pd.Series, low: pd.Series) -> Tuple[np.ndarray, np.ndarray]:
    """
    构造互斥的正向/负向方向运动。

    负向运动取前一日最低价减当日最低价。首根没有前值，记为缺失，避免把 0 送进平滑种子。

    Args:
        high: 最高价序列
        low: 最低价序列

    Returns:
        正向方向运动与负向方向运动
    """
    high_values = high.to_numpy(dtype=float)
    low_values = low.to_numpy(dtype=float)
    up_move = np.full(len(high_values), np.nan)
    down_move = np.full(len(low_values), np.nan)
    if len(high_values) > 1:
        up_move[1:] = high_values[1:] - high_values[:-1]
        down_move[1:] = low_values[:-1] - low_values[1:]

    plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0.0).astype(float)
    minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0.0).astype(float)
    plus_dm[0] = np.nan
    minus_dm[0] = np.nan
    return plus_dm, minus_dm


def _true_range(high: pd.Series, low: pd.Series, close: pd.Series) -> np.ndarray:
    """计算真实波幅。首根因缺少前收记为缺失。"""
    high_values = high.to_numpy(dtype=float)
    low_values = low.to_numpy(dtype=float)
    close_values = close.to_numpy(dtype=float)
    previous_close = np.full(len(close_values), np.nan)
    if len(close_values) > 1:
        previous_close[1:] = close_values[:-1]

    high_low = high_values - low_values
    high_close = np.abs(high_values - previous_close)
    low_close = np.abs(low_values - previous_close)
    true_range = np.maximum(high_low, np.maximum(high_close, low_close))
    true_range[0] = np.nan
    return true_range


def _wilder_rma(values: np.ndarray, period: int) -> np.ndarray:
    """
    SMA 种子的 Wilder RMA。

    种子取首个完整窗口的算术平均，之后递推 S_t = (S_{t-1} * (period - 1) + X_t) / period。
    不用 ewm(adjust=False)，以免种子落在第一根而不是前 period 根的平均。
    """
    smoothed = np.full(len(values), np.nan)
    if period < 1 or len(values) < period:
        return smoothed

    seed_index = None
    for index in range(period - 1, len(values)):
        window = values[index - period + 1:index + 1]
        if np.all(np.isfinite(window)):
            seed_index = index
            break
    if seed_index is None:
        return smoothed

    smoothed[seed_index] = float(np.mean(values[seed_index - period + 1:seed_index + 1]))
    for index in range(seed_index + 1, len(values)):
        current = values[index]
        previous = smoothed[index - 1]
        if not np.isfinite(current) or not np.isfinite(previous):
            break
        smoothed[index] = (previous * (period - 1) + current) / period
    return smoothed


def _directional_index(smooth_dm: np.ndarray, smooth_tr: np.ndarray) -> np.ndarray:
    """平滑方向运动与平滑真实波幅的比值。波幅为 0 时记 0，预热段保持缺失。"""
    directional_index = np.full(len(smooth_tr), np.nan)
    valid = np.isfinite(smooth_dm) & np.isfinite(smooth_tr)
    positive_range = valid & (smooth_tr > 0)
    zero_range = valid & (smooth_tr <= 0)
    directional_index[positive_range] = 100.0 * smooth_dm[positive_range] / smooth_tr[positive_range]
    directional_index[zero_range] = 0.0
    return directional_index


def _dx_from_di(plus_di: np.ndarray, minus_di: np.ndarray) -> np.ndarray:
    """DX。方向指数之和为 0 时记 0，避免除零把后续 ADX 变成缺失。"""
    dx = np.full(len(plus_di), np.nan)
    di_sum = plus_di + minus_di
    valid = np.isfinite(plus_di) & np.isfinite(minus_di) & np.isfinite(di_sum)
    has_direction = valid & (di_sum > 0)
    no_direction = valid & (di_sum <= 0)
    dx[has_direction] = 100.0 * np.abs(plus_di[has_direction] - minus_di[has_direction]) / di_sum[has_direction]
    dx[no_direction] = 0.0
    return dx


def calculate_adx(df: pd.DataFrame, period: int = 14) -> Optional[float]:
    """
    计算 Welles Wilder ADX。

    方向运动、真实波幅与 DX 都用周期 period 的 SMA 种子 RMA。
    样本短于 2 * period，或最后一个平滑值为缺失时返回空，不把算不出的指标记成 0。

    Args:
        df: 包含 high、low、close 的 DataFrame
        period: 平滑周期，默认 14

    Returns:
        最后一个有效 ADX；不可用时返回 None
    """
    try:
        if df is None or period < 1 or len(df) < period * 2:
            return None
        required_columns = ('high', 'low', 'close')
        if any(column not in df.columns for column in required_columns):
            logger.error("ADX计算失败: 缺少 high/low/close")
            return None

        plus_dm, minus_dm = build_directional_movement(df['high'], df['low'])
        smooth_tr = _wilder_rma(_true_range(df['high'], df['low'], df['close']), period)
        plus_di = _directional_index(_wilder_rma(plus_dm, period), smooth_tr)
        minus_di = _directional_index(_wilder_rma(minus_dm, period), smooth_tr)
        adx_series = _wilder_rma(_dx_from_di(plus_di, minus_di), period)
        last_adx = adx_series[-1]
        if not np.isfinite(last_adx):
            return None
        return float(last_adx)
    except Exception as e:
        logger.error(f"ADX计算失败: {str(e)}")
        return None
