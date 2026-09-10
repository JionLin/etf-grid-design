/**
 * 极限行情压力测试沙盘纯函数计算模块
 * 贯彻 E大“压力测试最重要”哲学，毫秒级推演各跌幅情景下的资金消耗、持仓均价摊薄与绝地脱困反弹阈值
 */

/**
 * 计算压力测试场景下的全套量化安全指标
 *
 * @param {Object} compositeGrid 复合网格数据 (包含 base_position, rails, merged_ladder)
 * @param {number} totalCapital 总资金 (如 100000)
 * @param {number} currentPrice 基准现价 (如 1.341)
 * @param {number} dropPct 模拟跌幅百分比 (如 10, 20, 35, 40, 50，代表下跌 10%、35% 等)
 * @param {number} commissionRate 佣金费率 (默认 0.00005)
 * @returns {Object} 包含推演价、资金消耗、摊薄均价、脱困反弹、三轨水淹热力图等全量指标
 */
export function calculateStressTestScenario(
  compositeGrid,
  totalCapital = 100000,
  currentPrice = 1.0,
  dropPct = 20,
  commissionRate = 0.00005
) {
  if (!compositeGrid || !currentPrice) {
    return null;
  }

  const basePos = compositeGrid.base_position || {};
  const baseShares = basePos.shares || 0;
  const baseCost = basePos.actual_capital || baseShares * currentPrice;
  const liquidCapital = Math.max(0, totalCapital - baseCost);

  // 1. 模拟目标极端价格
  const safeDropPct = Math.max(0, Math.min(60, dropPct));
  const targetPrice = Math.max(0.001, Number((currentPrice * (1 - safeDropPct / 100)).toFixed(3)));

  // 2. 筛选并按价格从高到低排列所有买入档位
  const buyOrders = (compositeGrid.merged_ladder || [])
    .filter((item) => item.action === "BUY")
    .sort((a, b) => b.price - a.price);

  // 3. 统计已击穿档位、吸筹股数与资金消耗
  let triggeredBuyShares = 0;
  let triggeredBuyCost = 0;
  let triggeredBuyFee = 0;
  const triggeredOrders = [];

  // 各轨击穿情况统计
  const railStats = {
    small: { name: "小网 (高频做T)", tag: "小网", total: 0, triggered: 0, shares: 0, cost: 0, color: "emerald" },
    medium: { name: "中网 (波段巡航)", tag: "中网", total: 0, triggered: 0, shares: 0, cost: 0, color: "blue" },
    large: { name: "大网 (估值防守)", tag: "大网", total: 0, triggered: 0, shares: 0, cost: 0, color: "purple" },
  };

  buyOrders.forEach((order) => {
    const railKey = order.rail || "small";
    if (railStats[railKey]) {
      railStats[railKey].total += 1;
    }

    // 判定是否被当前水位淹没击穿 (目标价 <= 买单触发价)
    if (targetPrice <= order.price) {
      triggeredBuyShares += order.shares;
      triggeredBuyCost += order.amount;
      triggeredBuyFee += order.amount * commissionRate;
      triggeredOrders.push(order);

      if (railStats[railKey]) {
        railStats[railKey].triggered += 1;
        railStats[railKey].shares += order.shares;
        railStats[railKey].cost += order.amount;
      }
    }
  });

  // 计算各轨击穿百分比
  Object.keys(railStats).forEach((k) => {
    const r = railStats[k];
    r.cost = Number(r.cost.toFixed(2));
    r.pct = r.total > 0 ? Number(((r.triggered / r.total) * 100).toFixed(1)) : 0;
  });

  // 4. 现金消耗与子弹剩余测算
  const consumedCash = Number((triggeredBuyCost + triggeredBuyFee).toFixed(2));
  const remainingCash = Number(Math.max(0, liquidCapital - consumedCash).toFixed(2));
  const cashDrainRatio = liquidCapital > 0 ? Number(Math.min(100, (consumedCash / liquidCapital) * 100).toFixed(1)) : 0;
  const cashBufferRatio = Number((100 - cashDrainRatio).toFixed(1));

  // 5. 测算资金耗尽临界跌幅点 (Exhaustion Drop Point)
  let cumulativeCost = 0;
  let exhaustionDropPct = null;
  let exhaustionPrice = null;

  for (const order of buyOrders) {
    cumulativeCost += order.amount * (1 + commissionRate);
    if (cumulativeCost >= liquidCapital && exhaustionDropPct === null) {
      exhaustionPrice = order.price;
      exhaustionDropPct = Number((((currentPrice - order.price) / currentPrice) * 100).toFixed(1));
      break;
    }
  }

  // 6. 安全风控等级判定
  let safetyLevel = "safe";
  let safetyLabel = "资金安全 · 储备充裕";
  let safetyBadgeColor = "emerald";

  if (consumedCash >= liquidCapital) {
    safetyLevel = "exhausted";
    safetyLabel = "子弹耗尽 · 底仓锁仓";
    safetyBadgeColor = "red";
  } else if (cashDrainRatio >= 80) {
    safetyLevel = "danger";
    safetyLabel = "重度击穿 · 临界警戒";
    safetyBadgeColor = "orange";
  } else if (cashDrainRatio >= 50) {
    safetyLevel = "warning";
    safetyLabel = "中度消耗 · 子弹待命";
    safetyBadgeColor = "amber";
  }

  // 7. 综合持仓成本加权摊薄 (Breakeven Average Price)
  const totalHoldingShares = baseShares + triggeredBuyShares;
  const totalHoldingCost = baseCost + triggeredBuyCost;
  const avgCostPrice = totalHoldingShares > 0 ? Number((totalHoldingCost / totalHoldingShares).toFixed(3)) : currentPrice;
  const costReductionPct = Number((((currentPrice - avgCostPrice) / currentPrice) * 100).toFixed(2));

  // 8. 绝地脱困反弹阈值 (Breakeven Rebound Gap)
  // 普通死拿标的回本所需涨幅: (P0 - Target) / Target
  const normalReboundNeeded = targetPrice > 0 ? Number((((currentPrice - targetPrice) / targetPrice) * 100).toFixed(1)) : 0;

  // 网格摊薄后回本脱困所需反弹涨幅: (AvgPrice - Target) / Target
  const gridReboundNeeded = targetPrice > 0 ? Number((((avgCostPrice - targetPrice) / targetPrice) * 100).toFixed(1)) : 0;

  // 脱困超额优势 (少涨了多少百分比即可回本)
  const reboundAdvantage = Number(Math.max(0, normalReboundNeeded - gridReboundNeeded).toFixed(1));

  return {
    currentPrice,
    dropPct: safeDropPct,
    targetPrice,
    basePosition: {
      shares: baseShares,
      cost: Number(baseCost.toFixed(2)),
    },
    liquidCapital: Number(liquidCapital.toFixed(2)),
    consumedCash,
    remainingCash,
    cashDrainRatio,
    cashBufferRatio,
    exhaustionDropPct,
    exhaustionPrice,
    safetyLevel,
    safetyLabel,
    safetyBadgeColor,
    totalHoldingShares,
    totalHoldingCost: Number(totalHoldingCost.toFixed(2)),
    avgCostPrice,
    costReductionPct,
    normalReboundNeeded,
    gridReboundNeeded,
    reboundAdvantage,
    railStats,
    triggeredOrdersCount: triggeredOrders.length,
    totalBuyOrdersCount: buyOrders.length,
  };
}

/**
 * 5 大经典历史暴跌情景预设配置
 */
export const STRESS_TEST_PRESETS = [
  { drop: 10, label: "-10% 日常回调", desc: "日常正常波段下挫，小网逐步吸收筹码" },
  { drop: 20, label: "-20% 技术熊市", desc: "技术性熊市分水岭，小网吃满，中网启动" },
  { drop: 30, label: "-30% 深度黄金坑", desc: "行业中级深度调整，中网大部分被击穿" },
  { drop: 40, label: "★ -40% 极值回撤", desc: "E大经典极值铁底，大网大口吞进巨鲸筹码" },
  { drop: 50, label: "-50% 世纪极值", desc: "罕见历史极端测试，检验最后底线安全垫" },
];
