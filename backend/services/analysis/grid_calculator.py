"""
复合网格计算器
负责大中小三层立体复合网格的资金拆解、单轨挂单生成与多轨阶梯合并排序
"""

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class CompositeGridCalculator:
    """复合网格计算器"""

    def __init__(self, commission_rate: float = 0.00005):
        """
        初始化计算器

        Args:
            commission_rate: 券商佣金费率 (默认万分之0.5，免印花税)
        """
        self.commission_rate = commission_rate

    def calculate_composite_grid(
        self,
        total_capital: float,
        current_price: float,
        composite_steps: Dict[str, Dict[str, Any]],
        base_position_ratio: float = 0.5,
        scaling_ratio: float = 0.0,
    ) -> Dict[str, Any]:
        """
        根据总资金、当前价格、三轨步长及逐格加码比例，生成小网、中网、大网及合并阶梯

        Args:
            total_capital: 总资产 (例如 100,000 元)
            current_price: 当前基准价格
            composite_steps: 各轨道步长配置 (来自 GridOptimizer.calculate_composite_steps)
            base_position_ratio: 初始底仓比例 (默认 50%)
            scaling_ratio: 逐格加码比例 (默认 0.0 即等额；0.05~0.20 为倒金字塔递增)

        Returns:
            Dict 包含底仓数据、三轨结构化数据与合并排序挂单阶梯
        """
        try:
            # 1. 划分底仓与网格流动资金
            base_target_capital = total_capital * base_position_ratio
            base_shares = int(base_target_capital / current_price / 100) * 100
            base_actual_capital = round(base_shares * current_price, 2)
            liquid_capital = total_capital - base_actual_capital

            base_position_info = {
                "ratio": base_position_ratio,
                "target_capital": base_target_capital,
                "actual_capital": base_actual_capital,
                "shares": base_shares,
                "current_price": current_price,
            }

            # 2. 为各轨道分别生成买卖档位
            rails_result = {}
            all_ladder_items = []

            for rail_key in ["small", "medium", "large"]:
                conf = composite_steps.get(rail_key, {})
                if not conf:
                    continue

                rail_name = conf.get("name", rail_key)
                tag = conf.get("tag", rail_key)
                capital_ratio = conf.get("capital_ratio", 0.33)
                step_ratio = conf.get("step_ratio", 0.02)
                levels_count = conf.get("levels_per_side", 3)

                rail_fund = liquid_capital * capital_ratio
                fund_per_level = rail_fund / max(1, levels_count)

                sell_levels = []
                buy_levels = []

                # 生成卖出档位 (1 至 levels_count 档)
                for lvl in range(levels_count, 0, -1):
                    sell_price = round(current_price * (1 + step_ratio * lvl), 3)
                    # 股数向下整百对齐
                    sell_shares = int(fund_per_level / current_price / 100) * 100
                    if sell_shares == 0:
                        sell_shares = 100
                    amount = round(sell_shares * sell_price, 2)
                    spread = sell_price - current_price
                    fee = amount * 2 * self.commission_rate
                    profit = round(sell_shares * spread - fee, 2)

                    item = {
                        "id": f"{rail_key}_sell_{lvl}",
                        "level_label": f"卖{lvl}",
                        "level_index": lvl,
                        "rail": rail_key,
                        "rail_name": rail_name,
                        "tag": tag,
                        "action": "SELL",
                        "action_label": "卖出",
                        "price": sell_price,
                        "shares": sell_shares,
                        "amount": amount,
                        "est_profit": profit,
                        "depth_ratio": round(capital_ratio * 100, 1),
                    }
                    sell_levels.append(item)
                    all_ladder_items.append(item)

                # 计算各买入档位的加码资金分配权重 (指数递增加码，倒金字塔)
                buy_weights = [(1.0 + scaling_ratio) ** (lvl - 1) for lvl in range(1, levels_count + 1)]
                sum_weights = sum(buy_weights) if sum(buy_weights) > 0 else levels_count

                # 生成买入档位 (1 至 levels_count 档)
                for lvl in range(1, levels_count + 1):
                    buy_price = round(current_price * (1 - step_ratio * lvl), 3)
                    lvl_weight = buy_weights[lvl - 1]
                    allocated_fund = rail_fund * (lvl_weight / sum_weights)
                    buy_shares = int(allocated_fund / buy_price / 100) * 100
                    if buy_shares == 0:
                        buy_shares = 100
                    amount = round(buy_shares * buy_price, 2)
                    spread = current_price * step_ratio
                    fee = amount * 2 * self.commission_rate
                    profit = round(buy_shares * spread - fee, 2)

                    item = {
                        "id": f"{rail_key}_buy_{lvl}",
                        "level_label": f"买{lvl}",
                        "level_index": lvl,
                        "rail": rail_key,
                        "rail_name": rail_name,
                        "tag": tag,
                        "action": "BUY",
                        "action_label": "买入",
                        "price": buy_price,
                        "shares": buy_shares,
                        "amount": amount,
                        "est_profit": profit,
                        "depth_ratio": round(capital_ratio * 100, 1),
                    }
                    buy_levels.append(item)
                    all_ladder_items.append(item)

                rails_result[rail_key] = {
                    "rail": rail_key,
                    "name": rail_name,
                    "tag": tag,
                    "capital": round(rail_fund, 2),
                    "capital_ratio": capital_ratio,
                    "step_ratio": step_ratio,
                    "levels_count": levels_count,
                    "avg_profit_per_grid": round(
                        (sell_levels[0]["est_profit"] + buy_levels[0]["est_profit"]) / 2, 2
                    )
                    if sell_levels and buy_levels
                    else 0.0,
                    "sell_levels": sell_levels,
                    "buy_levels": buy_levels,
                }

            # 3. 多轨合并阶梯排序 (按价格从高到低倒序)
            merged_ladder = sorted(all_ladder_items, key=lambda x: x["price"], reverse=True)

            return {
                "base_position": base_position_info,
                "liquid_capital": round(liquid_capital, 2),
                "rails": rails_result,
                "merged_ladder": merged_ladder,
                "total_levels": len(merged_ladder),
            }

        except Exception as e:
            logger.error(f"复合网格阶梯计算失败: {str(e)}")
            return {}
