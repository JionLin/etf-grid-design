"""
网格策略历史回测引擎
支持 T+1 账户簿记、50%底仓+50%现金初始化、日内高低点撮合、多轨利润归因与超额收益统计
"""

import logging
from typing import Any, Dict, List, Optional
import pandas as pd

logger = logging.getLogger(__name__)


class GridBacktestEngine:
    """网格策略真实历史回测引擎"""

    def __init__(self, commission_rate: float = 0.00005):
        """
        初始化回测引擎

        Args:
            commission_rate: 交易佣金费率 (默认万分之0.5，ETF免印花税)
        """
        self.commission_rate = commission_rate

    def run_backtest(
        self,
        daily_df: pd.DataFrame,
        total_capital: float,
        composite_grid: Dict[str, Any],
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        reinvest_mode: str = "cash",
    ) -> Dict[str, Any]:
        """
        执行历史网格回测

        Args:
            daily_df: 包含历史日K线的 DataFrame (含 date/trade_date, open, high, low, close)
            total_capital: 回测总投入资金 (如 100,000 元)
            composite_grid: 复合网格配置 (包含 merged_ladder 与 rails)
            start_date: 回测起始日期 (可选)
            end_date: 回测结束日期 (可选)

        Returns:
            Dict 包含 KPI 指标、时序净值曲线、三轨归因与逐笔交易清单
        """
        if daily_df.empty or len(daily_df) < 5:
            raise ValueError("历史行情数据不足，无法执行回测")

        # 确保按日期升序排列
        df = daily_df.copy()
        date_col = "date" if "date" in df.columns else "trade_date"
        df[date_col] = pd.to_datetime(df[date_col])
        df = df.sort_values(by=date_col).reset_index(drop=True)

        if start_date:
            cond = df[date_col] >= pd.to_datetime(start_date)
            df = df.loc[cond].reset_index(drop=True)
        if end_date:
            cond = df[date_col] <= pd.to_datetime(end_date)
            df = df.loc[cond].reset_index(drop=True)

        if len(df) < 5:
            raise ValueError("选定时间区间内交易日不足，无法执行回测")

        # 1. 账户初始化 (50% 现金 + 50% 底仓)
        start_price = float(df.iloc[0]["open"] if "open" in df.columns else df.iloc[0]["close"])
        initial_capital = float(total_capital)
        target_base_capital = initial_capital * 0.5
        base_shares = int(target_base_capital / start_price / 100) * 100
        base_cost = base_shares * start_price
        cash = initial_capital - base_cost

        available_position = base_shares
        frozen_position = 0

        # 模式 B 利润蓄水池与 0 成本免费份额账本
        profit_pool = 0.0
        free_shares = 0
        free_shares_history: List[Dict[str, Any]] = []

        trades: List[Dict[str, Any]] = []
        equity_curve: List[Dict[str, Any]] = []

        # 挂单阶梯分解
        merged_ladder = composite_grid.get("merged_ladder", [])
        sell_orders = [o for o in merged_ladder if o.get("action") == "SELL"]
        buy_orders = [o for o in merged_ladder if o.get("action") == "BUY"]

        # 三轨利润与成交统计
        rail_stats = {
            "small": {"name": "小网 (高频做T)", "tag": "小网", "trades_count": 0, "profit": 0.0},
            "medium": {"name": "中网 (波段巡航)", "tag": "中网", "trades_count": 0, "profit": 0.0},
            "large": {"name": "大网 (估值防守)", "tag": "大网", "trades_count": 0, "profit": 0.0},
        }

        peak_equity = initial_capital
        max_drawdown = 0.0
        total_commission = 0.0

        # 2. 逐日模拟撮合 (T+1 机制)
        for _, row in df.iterrows():
            # 每日开盘前：将昨日买入冻结份额解冻并入可用持仓
            available_position += frozen_position
            frozen_position = 0

            date_str = pd.to_datetime(row[date_col]).strftime("%Y-%m-%d")
            high_price = float(row["high"])
            low_price = float(row["low"])
            close_price = float(row["close"])

            # 撮合卖单 (高价向上触发)
            for order in sell_orders:
                target_p = order["price"]
                shares_needed = order["shares"]
                if high_price >= target_p and available_position >= shares_needed:
                    trade_amt = round(shares_needed * target_p, 2)
                    fee = round(trade_amt * self.commission_rate, 2)
                    profit = round(order.get("est_profit", shares_needed * (target_p - start_price)), 2)

                    if reinvest_mode == "pool_shares":
                        # 模式 B: 回收本金入现金池，纯利润流入利润蓄水池
                        capital_back = trade_amt - fee - profit
                        cash += capital_back
                        profit_pool += profit

                        # 判定蓄水池资金是否满当前价格 100 股
                        lot_cost = round(target_p * 100, 2)
                        if lot_cost > 0 and profit_pool >= lot_cost:
                            new_lots = int(profit_pool / lot_cost)
                            if new_lots > 0:
                                add_shares = new_lots * 100
                                cost_deducted = round(add_shares * target_p, 2)
                                free_shares += add_shares
                                profit_pool = round(profit_pool - cost_deducted, 2)
                                free_shares_history.append({
                                    "date": date_str,
                                    "price": target_p,
                                    "shares": add_shares,
                                    "cost": cost_deducted,
                                    "total_free": free_shares,
                                })
                    else:
                        cash += trade_amt - fee

                    available_position -= shares_needed
                    total_commission += fee

                    rail_key = order.get("rail", "small")
                    if rail_key in rail_stats:
                        rail_stats[rail_key]["trades_count"] += 1
                        rail_stats[rail_key]["profit"] += profit

                    trades.append({
                        "trade_time": f"{date_str} 14:15",
                        "date": date_str,
                        "action": "SELL",
                        "action_label": "卖出",
                        "price": target_p,
                        "shares": shares_needed,
                        "amount": trade_amt,
                        "fee": fee,
                        "profit": profit,
                        "rail": rail_key,
                        "rail_name": order.get("rail_name", "网格"),
                        "tag": order.get("tag", "网格"),
                    })

            # 撮合买单 (低价向下触发)
            for order in buy_orders:
                target_p = order["price"]
                shares_needed = order["shares"]
                buy_cost = round(shares_needed * target_p, 2)
                fee = round(buy_cost * self.commission_rate, 2)

                if low_price <= target_p and cash >= (buy_cost + fee):
                    cash -= (buy_cost + fee)
                    frozen_position += shares_needed  # T+1 锁定，当日不可卖出
                    total_commission += fee
                    profit = round(order.get("est_profit", 0.0), 2)

                    rail_key = order.get("rail", "small")
                    if rail_key in rail_stats:
                        rail_stats[rail_key]["trades_count"] += 1

                    trades.append({
                        "trade_time": f"{date_str} 10:30",
                        "date": date_str,
                        "action": "BUY",
                        "action_label": "买入",
                        "price": target_p,
                        "shares": shares_needed,
                        "amount": buy_cost,
                        "fee": fee,
                        "profit": profit,
                        "rail": rail_key,
                        "rail_name": order.get("rail_name", "网格"),
                        "tag": order.get("tag", "网格"),
                    })

            # 每日收盘结算与净值记录
            regular_shares = available_position + frozen_position
            free_shares_val = round(free_shares * close_price, 2)
            pool_val = round(profit_pool, 2)
            if reinvest_mode == "pool_shares":
                current_equity = round(cash + regular_shares * close_price + free_shares_val + pool_val, 2)
            else:
                current_equity = round(cash + regular_shares * close_price, 2)

            benchmark_equity = round(initial_capital * (close_price / start_price), 2)

            if current_equity > peak_equity:
                peak_equity = current_equity
            dd = (peak_equity - current_equity) / peak_equity if peak_equity > 0 else 0.0
            if dd > max_drawdown:
                max_drawdown = dd

            equity_curve.append({
                "date": date_str,
                "strategy_equity": current_equity,
                "benchmark_equity": benchmark_equity,
                "strategy_nav": round(current_equity / initial_capital, 4),
                "benchmark_nav": round(close_price / start_price, 4),
                "cash": round(cash, 2),
                "position_shares": regular_shares,
                "free_shares": free_shares,
                "free_shares_value": free_shares_val,
                "profit_pool": pool_val,
                "position_value": round(regular_shares * close_price, 2),
            })

        # 3. 绩效关键指标统计
        final_price = float(df.iloc[-1]["close"])
        final_equity = equity_curve[-1]["strategy_equity"] if equity_curve else initial_capital
        strategy_return = round((final_equity - initial_capital) / initial_capital * 100, 2)
        benchmark_return = round((final_price - start_price) / start_price * 100, 2)
        alpha = round(strategy_return - benchmark_return, 2)

        sell_count = sum(1 for t in trades if t["action"] == "SELL")
        buy_count = sum(1 for t in trades if t["action"] == "BUY")
        total_trades_count = len(trades)
        paired_count = min(sell_count, buy_count)
        win_rate = round((paired_count / max(1, sell_count)) * 100, 1) if sell_count > 0 else 100.0

        # 网格做 T 纯差价利润总额
        grid_cash_profit = sum(t.get("profit", 0.0) for t in trades if t["action"] == "SELL")

        # 4. 三轨利润归因百分比计算
        total_rail_profit = sum(max(0, s["profit"]) for s in rail_stats.values())
        rail_attribution = []
        for r_key in ["small", "medium", "large"]:
            st = rail_stats[r_key]
            p_val = max(0.0, round(st["profit"], 2))
            pct = round(p_val / total_rail_profit * 100, 1) if total_rail_profit > 0 else 33.3
            rail_attribution.append({
                "rail": r_key,
                "name": st["name"],
                "tag": st["tag"],
                "trades_count": st["trades_count"],
                "profit": p_val,
                "profit_ratio": pct,
            })

        return {
            "summary": {
                "initial_capital": round(initial_capital, 2),
                "final_equity": round(final_equity, 2),
                "strategy_return": strategy_return,
                "benchmark_return": benchmark_return,
                "alpha": alpha,
                "max_drawdown": round(max_drawdown * 100, 2),
                "win_rate": win_rate,
                "total_trades_count": total_trades_count,
                "sell_trades_count": sell_count,
                "buy_trades_count": buy_count,
                "paired_trades_count": paired_count,
                "total_commission": round(total_commission, 2),
                "grid_cash_profit": round(grid_cash_profit, 2),
                "backtest_days": len(df),
                "start_date": df.iloc[0][date_col].strftime("%Y-%m-%d"),
                "end_date": df.iloc[-1][date_col].strftime("%Y-%m-%d"),
                "reinvest_mode": reinvest_mode,
                "profit_pool": {
                    "enabled": reinvest_mode == "pool_shares",
                    "reinvest_mode": reinvest_mode,
                    "free_shares": free_shares,
                    "free_shares_value": round(free_shares * final_price, 2),
                    "profit_pool_remainder": round(profit_pool, 2),
                    "total_profit_accumulated": round(grid_cash_profit, 2),
                    "next_lot_needed": round(max(0.0, final_price * 100 - profit_pool), 2),
                    "transfer_count": len(free_shares_history),
                    "transfer_history": free_shares_history,
                },
            },
            "profit_pool": {
                "enabled": reinvest_mode == "pool_shares",
                "reinvest_mode": reinvest_mode,
                "free_shares": free_shares,
                "free_shares_value": round(free_shares * final_price, 2),
                "profit_pool_remainder": round(profit_pool, 2),
                "total_profit_accumulated": round(grid_cash_profit, 2),
                "next_lot_needed": round(max(0.0, final_price * 100 - profit_pool), 2),
                "transfer_count": len(free_shares_history),
                "transfer_history": free_shares_history,
            },
            "rail_attribution": rail_attribution,
            "equity_curve": equity_curve,
            "recent_trades": trades[-50:],  # 最近 50 笔交易
            "total_trades_all": trades,
        }
