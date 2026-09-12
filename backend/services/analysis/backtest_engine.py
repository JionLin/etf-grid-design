"""
网格策略历史回测引擎 (基于配对网格槽位状态机 Grid Slot State Machine)
支持有状态槽位生命周期、小网5格上限熔断、买卖闭环对冲、T+1隔夜解冻、多轨利润归因与留利润模式
"""

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class GridSlot:
    """网格配对槽位数据模型"""
    slot_id: str                # 槽位唯一标识 (如 small_buy_1, medium_sell_2)
    rail: str                   # 轨道代号 (small, medium, large)
    rail_name: str              # 轨道中文名 (小网 (高频做T), 中网 (波段巡航), 大网 (估值防守))
    tag: str                    # 轨道短标签 (小网, 中网, 大网)
    slot_type: str              # 槽位类型: 'BUY_GRID' (向下吸筹对冲) 或 'SELL_GRID' (向上高抛对冲)
    level: int                  # 档位序号 (1 ~ 5)
    buy_price: float            # 买入触发价
    sell_price: float           # 卖出目标价
    shares: int                 # 交易股数
    state: str                  # 当前状态: 'WAIT_BUY' (待买入) 或 'WAIT_SELL' (待卖出)
    holding_shares: int = 0     # 当前槽位持仓股数
    buy_cost: float = 0.0       # 买入金额 (本金)
    buy_fee: float = 0.0        # 买入佣金
    buy_date: str = ""          # 买入成交日期 (用于 T+1 限制)
    sell_revenue: float = 0.0   # 卖出金额
    sell_fee: float = 0.0       # 卖出佣金
    sell_date: str = ""         # 卖出成交日期


class GridBacktestEngine:
    """网格策略真实历史回测引擎 (有状态槽位机版本)"""

    # 各轨道最大档位数限制 (严格风控，小网绝不买超 5 格)
    MAX_LEVELS = {
        "small": 5,
        "medium": 4,
        "large": 3,
    }

    def __init__(self, commission_rate: float = 0.0001, min_commission: float = 0.20):
        """
        初始化回测引擎

        Args:
            commission_rate: 交易佣金费率 (默认万分之1，免印花税)
            min_commission: 单笔最低佣金 (默认 0.20 元，免5)
        """
        self.commission_rate = commission_rate
        self.min_commission = min_commission

    def calculate_commission(self, amount: float) -> float:
        """计算单笔交易佣金 (支持单笔最低保底收费门槛)"""
        return max(self.min_commission, round(amount * self.commission_rate, 2))

    def build_grid_slots(self, composite_grid: Dict[str, Any], current_price: float) -> List[GridSlot]:
        """
        根据复合多轨配置构建有状态的网格槽位池 (支持各轨道档位上限保护)
        
        Args:
            composite_grid: 复合网格参数字典 (包含 rails 配置)
            current_price: 开网基准价格
            
        Returns:
            List[GridSlot]: 初始化的网格槽位列表
        """
        slots: List[GridSlot] = []
        rails_conf = composite_grid.get("rails", {})

        for rail_key in ["small", "medium", "large"]:
            rail_data = rails_conf.get(rail_key, {})
            if not rail_data:
                continue

            rail_name = rail_data.get("name", rail_key)
            tag = rail_data.get("tag", rail_key)
            step_ratio = rail_data.get("step_ratio", 0.02)
            max_allowed = self.MAX_LEVELS.get(rail_key, 5)

            # 1. 向下低吸网格槽位 (BUY_GRID)
            # 初始状态全为 WAIT_BUY，低吸后挂 sell_price 等待反弹
            buy_levels = rail_data.get("buy_levels", [])
            # 严格截断至最大允许档位数 (小网最多 5 档)
            filtered_buy_levels = sorted(
                [lvl for lvl in buy_levels if lvl.get("level_index", 1) <= max_allowed],
                key=lambda x: x.get("level_index", 1)
            )

            for i, lvl in enumerate(filtered_buy_levels):
                lvl_idx = lvl.get("level_index", i + 1)
                b_price = lvl["price"]
                shares = lvl["shares"]
                # 目标卖出价：反弹回上一档价格 (若是买1档则目标为基准价或上浮一格)
                if i == 0:
                    s_price = round(max(current_price, b_price * (1.0 + step_ratio)), 3)
                else:
                    s_price = filtered_buy_levels[i - 1]["price"]

                slots.append(GridSlot(
                    slot_id=f"{rail_key}_buy_slot_{lvl_idx}",
                    rail=rail_key,
                    rail_name=rail_name,
                    tag=tag,
                    slot_type="BUY_GRID",
                    level=lvl_idx,
                    buy_price=b_price,
                    sell_price=s_price,
                    shares=shares,
                    state="WAIT_BUY",
                ))

            # 2. 向上高抛网格槽位 (SELL_GRID)
            # 依托开网 50% 底仓，初始状态为 WAIT_SELL，高抛后挂 buy_price 等待回调买回
            sell_levels = rail_data.get("sell_levels", [])
            filtered_sell_levels = sorted(
                [lvl for lvl in sell_levels if lvl.get("level_index", 1) <= max_allowed],
                key=lambda x: x.get("level_index", 1)
            )

            for i, lvl in enumerate(filtered_sell_levels):
                lvl_idx = lvl.get("level_index", i + 1)
                s_price = lvl["price"]
                shares = lvl["shares"]
                # 目标买回价：回调至下一档价格
                if i == 0:
                    b_price = round(min(current_price, s_price * (1.0 - step_ratio)), 3)
                else:
                    b_price = filtered_sell_levels[i - 1]["price"]

                slots.append(GridSlot(
                    slot_id=f"{rail_key}_sell_slot_{lvl_idx}",
                    rail=rail_key,
                    rail_name=rail_name,
                    tag=tag,
                    slot_type="SELL_GRID",
                    level=lvl_idx,
                    buy_price=b_price,
                    sell_price=s_price,
                    shares=shares,
                    state="WAIT_SELL",
                    holding_shares=shares,
                    buy_cost=round(shares * current_price, 2),
                    buy_fee=self.calculate_commission(round(shares * current_price, 2)),
                    buy_date="INIT",
                ))

        return slots

    def run_backtest(
        self,
        daily_df: pd.DataFrame,
        total_capital: float,
        composite_grid: Dict[str, Any],
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        reinvest_mode: str = "cash",
        trade_mode: str = "t1",
    ) -> Dict[str, Any]:
        """
        执行有状态槽位驱动的历史网格回测

        Args:
            daily_df: 包含历史日K线的 DataFrame (含 date/trade_date, open, high, low, close)
            total_capital: 回测总投入资金 (如 100,000 元)
            composite_grid: 复合网格配置 (包含 merged_ladder 与 rails)
            start_date: 回测起始日期 (可选)
            end_date: 回测结束日期 (可选)
            reinvest_mode: 收益处置模式 ('cash' 模式A 或 'pool_shares' 模式B留利润)
            trade_mode: 交易制度 ('t1' A股T+1 或 't0' 跨境/期权T+0)

        Returns:
            Dict 包含完整KPI、时序净值曲线、三轨利润归因与逐笔交易流水清单
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
        base_cost = round(base_shares * start_price, 2)
        cash = initial_capital - base_cost

        available_position = base_shares
        frozen_position = 0

        # 构建有状态网格槽位机
        slots = self.build_grid_slots(composite_grid, start_price)

        # 模式 B 利润蓄水池与 0 成本免费份额账本
        profit_pool = 0.0
        free_shares = 0
        free_shares_history: List[Dict[str, Any]] = []

        trades: List[Dict[str, Any]] = []
        equity_curve: List[Dict[str, Any]] = []

        # 三轨利润与成交统计初始化
        rail_stats = {
            "small": {"name": "小网 (高频做T)", "tag": "小网", "trades_count": 0, "profit": 0.0},
            "medium": {"name": "中网 (波段巡航)", "tag": "中网", "trades_count": 0, "profit": 0.0},
            "large": {"name": "大网 (估值防守)", "tag": "大网", "trades_count": 0, "profit": 0.0},
        }

        peak_equity = initial_capital
        max_drawdown = 0.0
        total_commission = 0.0

        # 2. 逐日模拟撮合 (基于槽位机状态转移)
        for _, row in df.iterrows():
            date_str = pd.to_datetime(row[date_col]).strftime("%Y-%m-%d")
            high_price = float(row["high"])
            low_price = float(row["low"])
            close_price = float(row["close"])

            # 每日开盘前：将昨日买入冻结份额解冻并入可用持仓
            available_position += frozen_position
            frozen_position = 0

            # -------------------------------------------------------------
            # 步骤 A：撮合卖出 (日内高点向上冲高触发)
            # 遍历所有处于 WAIT_SELL 状态且符合卖出条件的槽位
            # -------------------------------------------------------------
            active_sell_slots = [
                s for s in slots
                if s.state == "WAIT_SELL" and high_price >= s.sell_price
            ]
            # 卖出按价格从低到高依次触发
            active_sell_slots.sort(key=lambda x: x.sell_price)

            for slot in active_sell_slots:
                # 检查 T+1 规则：当日买入的份额当日不可卖出 (T+0 标的除外)
                if trade_mode == "t1" and slot.buy_date == date_str:
                    continue

                shares_to_sell = slot.shares
                if available_position < shares_to_sell:
                    continue

                sell_amt = round(shares_to_sell * slot.sell_price, 2)
                fee = self.calculate_commission(sell_amt)

                # 精确计算该笔做 T 差价纯利润 (扣除买卖双边手续费)
                if slot.slot_type == "BUY_GRID":
                    raw_spread = sell_amt - slot.buy_cost
                    profit = round(raw_spread - fee - slot.buy_fee, 2)
                else:
                    # 底仓高抛槽位：按基准价与卖出价差价核算
                    raw_spread = round(shares_to_sell * (slot.sell_price - slot.buy_price), 2)
                    profit = round(raw_spread - fee - self.calculate_commission(round(shares_to_sell * slot.buy_price, 2)), 2)

                # 资金处理 (模式 A 现金回流 / 模式 B 留利润)
                if reinvest_mode == "pool_shares":
                    capital_back = sell_amt - fee - profit
                    cash += capital_back
                    profit_pool += profit

                    # 判定蓄水池资金是否攒够当前价格 100 股
                    lot_cost = round(slot.sell_price * 100, 2)
                    if lot_cost > 0 and profit_pool >= lot_cost:
                        new_lots = int(profit_pool / lot_cost)
                        if new_lots > 0:
                            add_shares = new_lots * 100
                            cost_deducted = round(add_shares * slot.sell_price, 2)
                            free_shares += add_shares
                            profit_pool = round(profit_pool - cost_deducted, 2)
                            free_shares_history.append({
                                "date": date_str,
                                "price": slot.sell_price,
                                "shares": add_shares,
                                "cost": cost_deducted,
                                "total_free": free_shares,
                            })
                else:
                    cash += sell_amt - fee

                available_position -= shares_to_sell
                total_commission += fee

                # 轨道统计更新
                if slot.rail in rail_stats:
                    rail_stats[slot.rail]["trades_count"] += 1
                    rail_stats[slot.rail]["profit"] += profit

                # 记录卖出流水明细 (展现真实利润)
                trades.append({
                    "trade_time": f"{date_str} 14:1{slot.level % 10}",
                    "date": date_str,
                    "action": "SELL",
                    "action_label": "卖出",
                    "price": slot.sell_price,
                    "shares": shares_to_sell,
                    "amount": sell_amt,
                    "fee": fee,
                    "profit": profit,
                    "rail": slot.rail,
                    "rail_name": slot.rail_name,
                    "tag": slot.tag,
                })

                # 槽位状态转移：由 WAIT_SELL 重置回 WAIT_BUY (释放该档，允许再吸)
                slot.state = "WAIT_BUY"
                slot.holding_shares = 0
                slot.sell_date = str(date_str)

            # -------------------------------------------------------------
            # 步骤 B：撮合买入 (日内低点向下探底触发)
            # 遍历所有处于 WAIT_BUY 状态且符合买入条件的槽位
            # -------------------------------------------------------------
            active_buy_slots = [
                s for s in slots
                if s.state == "WAIT_BUY" and low_price <= s.buy_price
            ]
            # 买入按价格从高到低依次触发
            active_buy_slots.sort(key=lambda x: x.buy_price, reverse=True)

            for slot in active_buy_slots:
                shares_to_buy = slot.shares
                buy_cost = round(shares_to_buy * slot.buy_price, 2)
                fee = self.calculate_commission(buy_cost)

                if cash < (buy_cost + fee):
                    continue

                cash -= (buy_cost + fee)
                if trade_mode == "t0":
                    available_position += shares_to_buy
                else:
                    frozen_position += shares_to_buy

                total_commission += fee
                if slot.rail in rail_stats:
                    rail_stats[slot.rail]["trades_count"] += 1

                # 记录买入流水明细 (买入阶段 profit 为 0，待平仓时结算)
                trades.append({
                    "trade_time": f"{date_str} 10:1{slot.level % 10}",
                    "date": date_str,
                    "action": "BUY",
                    "action_label": "买入",
                    "price": slot.buy_price,
                    "shares": shares_to_buy,
                    "amount": buy_cost,
                    "fee": fee,
                    "profit": 0.0,
                    "rail": slot.rail,
                    "rail_name": slot.rail_name,
                    "tag": slot.tag,
                })

                # 槽位状态转移：由 WAIT_BUY 锁定为 WAIT_SELL (已持仓，严禁重复买)
                slot.state = "WAIT_SELL"
                slot.holding_shares = shares_to_buy
                slot.buy_cost = buy_cost
                slot.buy_fee = fee
                slot.buy_date = str(date_str)

            # -------------------------------------------------------------
            # 步骤 C：每日收盘结算与净值曲线记录
            # -------------------------------------------------------------
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
        winning_sells = sum(
            1 for t in trades if t["action"] == "SELL" and float(t.get("profit") or 0) > 0
        )
        win_rate = round(winning_sells / sell_count * 100, 1) if sell_count > 0 else None

        # 网格做 T 纯差价落袋利润总额
        grid_cash_profit = sum(t.get("profit", 0.0) for t in trades if t["action"] == "SELL")

        # 4. 三轨利润归因计算
        signed_profits = {
            r_key: round(rail_stats[r_key]["profit"], 2) for r_key in ["small", "medium", "large"]
        }
        positive_total = sum(value for value in signed_profits.values() if value > 0)
        rail_attribution = []
        for r_key in ["small", "medium", "large"]:
            st = rail_stats[r_key]
            p_val = signed_profits[r_key]
            pct = round(p_val / positive_total * 100, 1) if p_val > 0 and positive_total > 0 else 0.0
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
                "trade_mode": trade_mode,
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
            "recent_trades": trades[-50:],
            "total_trades_all": trades,
        }
