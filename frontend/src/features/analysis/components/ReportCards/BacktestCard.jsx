import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  Award,
  ShieldAlert,
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
  Sliders,
  PiggyBank,
} from "lucide-react";
import { runBacktest } from "@shared/services/api";

const BacktestCard = ({
  etfCode,
  totalCapital = 30000,
  initialDays = 180,
  reinvestMode = "pool_shares",
  scalingRatio = 0.0,
  stepMode = "atr",
}) => {
  const safeTotalCapital = Number(totalCapital || 30000);
  const [backtestDays, setBacktestDays] = useState(initialDays);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [backtestData, setBacktestData] = useState(null);
  const [showAllTrades, setShowAllTrades] = useState(false);

  // 加载回测数据
  const fetchBacktest = async (days) => {
    if (!etfCode) return;
    setLoading(true);
    setError(null);
    try {
      const res = await runBacktest({
        etfCode,
        totalCapital: safeTotalCapital,
        backtestDays: days,
        reinvestMode,
        scalingRatio,
        stepMode,
      });
      if (res?.success && res.data) {
        setBacktestData(res.data);
      } else {
        setError(res?.error || "回测数据获取失败");
      }
    } catch (err) {
      setError(err?.message || "回测请求异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (etfCode) {
      fetchBacktest(backtestDays);
    }
  }, [etfCode, safeTotalCapital, backtestDays, reinvestMode, scalingRatio, stepMode]);

  const summary = backtestData?.summary;
  const profitPool = backtestData?.profit_pool || summary?.profit_pool;
  const railAttribution = backtestData?.rail_attribution || [];
  const equityCurve = backtestData?.equity_curve || [];
  const trades = backtestData?.recent_trades || [];

  // 计算 SVG 净值图表坐标点
  const chartPoints = useMemo(() => {
    if (!equityCurve || equityCurve.length < 2) return null;

    const width = 800;
    const height = 240;
    const padding = { top: 20, right: 30, bottom: 30, left: 50 };

    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    // 获取净值极值
    let minNav = 0.8;
    let maxNav = 1.2;

    equityCurve.forEach((d) => {
      if (d.strategy_nav < minNav) minNav = d.strategy_nav;
      if (d.strategy_nav > maxNav) maxNav = d.strategy_nav;
      if (d.benchmark_nav < minNav) minNav = d.benchmark_nav;
      if (d.benchmark_nav > maxNav) maxNav = d.benchmark_nav;
    });

    minNav = Math.floor((minNav - 0.05) * 10) / 10;
    maxNav = Math.ceil((maxNav + 0.05) * 10) / 10;
    const navRange = maxNav - minNav || 1;

    const getX = (index) => padding.left + (index / (equityCurve.length - 1)) * innerWidth;
    const getY = (nav) => padding.top + innerHeight - ((nav - minNav) / navRange) * innerHeight;

    const strategyPoints = equityCurve.map((d, i) => `${getX(i)},${getY(d.strategy_nav)}`).join(" ");
    const benchmarkPoints = equityCurve.map((d, i) => `${getX(i)},${getY(d.benchmark_nav)}`).join(" ");

    // 区域填充闭合路径
    const baselineY = getY(minNav);
    const strategyArea = `${padding.left},${baselineY} ` + strategyPoints + ` ${padding.left + innerWidth},${baselineY}`;

    // 横轴刻度采样 (取 5 个日期点)
    const xTicks = [];
    const step = Math.floor(equityCurve.length / 4);
    for (let i = 0; i < equityCurve.length; i += step) {
      xTicks.push({
        x: getX(i),
        label: equityCurve[i].date.slice(5), // MM-DD
      });
    }
    if (xTicks[xTicks.length - 1].x < padding.left + innerWidth - 40) {
      xTicks.push({
        x: getX(equityCurve.length - 1),
        label: equityCurve[equityCurve.length - 1].date.slice(5),
      });
    }

    // 纵轴刻度采样 (3 个点)
    const yTicks = [
      { y: getY(minNav), label: minNav.toFixed(2) },
      { y: getY((minNav + maxNav) / 2), label: ((minNav + maxNav) / 2).toFixed(2) },
      { y: getY(maxNav), label: maxNav.toFixed(2) },
    ];

    return {
      width,
      height,
      padding,
      strategyPoints,
      benchmarkPoints,
      strategyArea,
      xTicks,
      yTicks,
    };
  }, [equityCurve]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs space-y-6">
      {/* 头部标题与周期切换 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100/80 rounded-xl text-blue-700">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900">真实历史策略回测验证</h3>
              <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                {summary?.trade_mode === "t0" ? "50% 底仓 · T+0 日内回转模拟" : "50% 底仓 · T+1 严格模拟"}
              </span>
              {summary?.trade_mode === "t0" && (
                <span className="text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full">
                  ★ T+0 跨境标的 · 支持日内回转交易
                </span>
              )}
              {stepMode === "fixed_eda" ? (
                <span className="text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full font-mono">
                  🏛️ E大原版步长 (5%/15%/30%)
                </span>
              ) : (
                <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-mono">
                  🌊 ATR 自适应步长
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              回测期间：{summary?.start_date || "..."} 至 {summary?.end_date || "..."}（共 {summary?.backtest_days || 0} 个有效交易日）
            </p>
          </div>
        </div>

        {/* 周期切换胶囊 */}
        <div className="flex items-center gap-1.5 bg-gray-100/90 p-1 rounded-xl self-start sm:self-auto text-xs">
          <button
            type="button"
            disabled={loading}
            onClick={() => setBacktestDays(90)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              backtestDays === 90
                ? "bg-white text-blue-700 font-bold shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            90 天 (近一季)
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => setBacktestDays(180)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              backtestDays === 180
                ? "bg-white text-blue-700 font-bold shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            ★ 180 天 (半年 · 默认)
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => setBacktestDays(365)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              backtestDays === 365
                ? "bg-white text-blue-700 font-bold shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            365 天 (年度防守)
          </button>
        </div>
      </div>

      {/* 加载或报错状态 */}
      {loading && (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-500">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-xs font-medium">正在执行历史行情逐日 T+1 撮合回测...</span>
        </div>
      )}

      {error && !loading && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
          <span>回测异常: {error}</span>
          <button
            type="button"
            onClick={() => fetchBacktest(backtestDays)}
            className="px-3 py-1 bg-white border border-red-300 rounded text-red-700 font-medium hover:bg-red-100"
          >
            重试
          </button>
        </div>
      )}

      {!loading && !error && summary && (
        <>
          {/* 1. 核心战绩 KPI 跑道 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 策略收益 */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50/80 to-white border border-blue-100">
              <div className="text-xs text-gray-500 flex items-center justify-between mb-1">
                <span>策略累计总收益率</span>
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className={`text-2xl font-black font-mono ${summary.strategy_return >= 0 ? "text-red-600" : "text-green-600"}`}>
                {summary.strategy_return >= 0 ? `+${summary.strategy_return}%` : `${summary.strategy_return}%`}
              </div>
              <div className="text-[11px] text-gray-500 mt-1 font-mono">
                期末总资产: ¥{summary.final_equity?.toLocaleString()}
              </div>
            </div>

            {/* 标的基准收益 */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-200">
              <div className="text-xs text-gray-500 flex items-center justify-between mb-1">
                <span>标的持有同期涨跌</span>
                <Calendar className="w-3.5 h-3.5 text-gray-500" />
              </div>
              <div className={`text-2xl font-black font-mono ${summary.benchmark_return >= 0 ? "text-red-600" : "text-green-600"}`}>
                {summary.benchmark_return >= 0 ? `+${summary.benchmark_return}%` : `${summary.benchmark_return}%`}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                基准对照（买入并持有）
              </div>
            </div>

            {/* 跑赢超额 (Alpha) */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50/80 to-white border border-emerald-100">
              <div className="text-xs text-gray-500 flex items-center justify-between mb-1">
                <span>跑赢标的超额 (Alpha)</span>
                <Award className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className={`text-2xl font-black font-mono ${summary.alpha >= 0 ? "text-emerald-700" : "text-gray-700"}`}>
                {summary.alpha >= 0 ? `+${summary.alpha}%` : `${summary.alpha}%`}
              </div>
              <div className="text-[11px] text-emerald-700 mt-1 font-medium">
                网格纯做T利润: +¥{summary.grid_cash_profit?.toLocaleString()}
              </div>
            </div>

            {/* 胜率与风控 */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50/80 to-white border border-purple-100">
              <div className="text-xs text-gray-500 flex items-center justify-between mb-1">
                <span>做T胜率 / 最大回撤</span>
                <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-purple-900 font-mono">{summary.win_rate}%</span>
                <span className="text-xs text-gray-500 font-mono">回撤 {summary.max_drawdown}%</span>
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                总成交 {summary.total_trades_count} 笔 (买{summary.buy_trades_count}/卖{summary.sell_trades_count}) · 佣金¥{summary.total_commission}
              </div>
            </div>
          </div>

          {/* 模式 B 专属：0 成本免费份额沉淀库卡片 */}
          {profitPool?.enabled && (
            <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-white border border-emerald-300 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/60 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-600 rounded-lg text-white">
                    <PiggyBank className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                      <span>0 成本免费份额沉淀库 (E大 2.1 留股模式)</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-sans font-semibold">
                        自动转增 {profitPool.transfer_count} 次
                      </span>
                    </h4>
                  </div>
                </div>
                <span className="text-xs text-emerald-700 font-medium font-sans">
                  做 T 纯差价利润全额换股 · 终身免受牛市踏空之苦
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-white/90 p-3 rounded-xl border border-emerald-200">
                  <div className="text-[11px] text-gray-500">已沉淀免费份额</div>
                  <div className="text-xl font-black font-mono text-emerald-800 mt-0.5">
                    +{profitPool.free_shares?.toLocaleString()} 股
                  </div>
                  <div className="text-[10px] text-emerald-700 mt-1 font-sans">
                    持仓综合成本: ¥0.000 / 股
                  </div>
                </div>

                <div className="bg-white/90 p-3 rounded-xl border border-emerald-200">
                  <div className="text-[11px] text-gray-500">免费份额当前市值</div>
                  <div className="text-xl font-black font-mono text-gray-900 mt-0.5">
                    ¥{profitPool.free_shares_value?.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1 font-sans">
                    永不卖飞，享受长牛复利
                  </div>
                </div>

                <div className="bg-white/90 p-3 rounded-xl border border-emerald-200">
                  <div className="text-[11px] text-gray-500">蓄水池现金余额 (零头)</div>
                  <div className="text-xl font-black font-mono text-blue-700 mt-0.5">
                    ¥{profitPool.profit_pool_remainder}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1 font-sans">
                    再攒 ¥{profitPool.next_lot_needed} 可再转100股
                  </div>
                </div>

                <div className="bg-white/90 p-3 rounded-xl border border-emerald-200">
                  <div className="text-[11px] text-gray-500">累计做T纯差价毛利润</div>
                  <div className="text-xl font-black font-mono text-gray-900 mt-0.5">
                    ¥{profitPool.total_profit_accumulated?.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-emerald-700 mt-1 font-sans">
                    100% 榨干波动，化为真实股份
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. 净值时序走势对决图 (轻量 SVG 矢量渲染) */}
          <div className="border border-gray-200 rounded-xl p-5 bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <span>策略净值走势对决</span>
                  <span className="text-[10px] text-gray-500 font-normal">（单位净值从 1.00 起步）</span>
                </h4>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-blue-600 rounded-full inline-block"></span>
                  <span className="text-gray-700 font-medium">网格做T策略净值 (平滑稳健)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 border-t-2 border-dashed border-gray-400 inline-block"></span>
                  <span className="text-gray-500">标的持有基准 (波动剧烈)</span>
                </div>
              </div>
            </div>

            {chartPoints && (
              <div className="w-full overflow-x-auto">
                <svg
                  viewBox={`0 0 ${chartPoints.width} ${chartPoints.height}`}
                  className="w-full h-52 select-none"
                >
                  <defs>
                    <linearGradient id="strategyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* 背景参考线 */}
                  {chartPoints.yTicks.map((tick, idx) => (
                    <g key={idx}>
                      <line
                        x1={chartPoints.padding.left}
                        y1={tick.y}
                        x2={chartPoints.width - chartPoints.padding.right}
                        y2={tick.y}
                        stroke="#f1f5f9"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={chartPoints.padding.left - 8}
                        y={tick.y + 4}
                        fontSize="10"
                        fill="#94a3b8"
                        textAnchor="end"
                        fontFamily="monospace"
                      >
                        {tick.label}
                      </text>
                    </g>
                  ))}

                  {/* 时间横轴 */}
                  {chartPoints.xTicks.map((tick, idx) => (
                    <text
                      key={idx}
                      x={tick.x}
                      y={chartPoints.height - 8}
                      fontSize="10"
                      fill="#94a3b8"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {tick.label}
                    </text>
                  ))}

                  {/* 策略净值阴影面积 */}
                  <polygon points={chartPoints.strategyArea} fill="url(#strategyGrad)" />

                  {/* 标的持有走势曲线 (灰色虚线) */}
                  <polyline
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    points={chartPoints.benchmarkPoints}
                  />

                  {/* 网格策略净值曲线 (蓝色实线) */}
                  <polyline
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={chartPoints.strategyPoints}
                  />
                </svg>
              </div>
            )}
          </div>

          {/* 3. 三色彩虹利润归因条 */}
          {railAttribution && railAttribution.length > 0 && (
            <div className="border border-gray-200 rounded-xl p-5 bg-white">
              <h4 className="font-bold text-gray-900 text-sm mb-3 flex items-center justify-between">
                <span>三轨做 T 利润贡献归因</span>
                <span className="text-xs text-gray-500 font-normal">多轨协同吸收不同波段振幅</span>
              </h4>

              {/* 彩虹比例条 */}
              <div className="w-full h-3.5 bg-gray-100 rounded-full overflow-hidden flex mb-3 shadow-inner">
                {railAttribution.map((r) => {
                  const widthPct = Math.max(5, r.profit_ratio || 33);
                  const color =
                    r.rail === "large"
                      ? "bg-purple-500"
                      : r.rail === "medium"
                      ? "bg-blue-500"
                      : "bg-emerald-500";
                  return (
                    <div
                      key={r.rail}
                      style={{ width: `${widthPct}%` }}
                      className={`${color} transition-all`}
                      title={`${r.name}: ${r.profit_ratio}%`}
                    ></div>
                  );
                })}
              </div>

              {/* 三轨统计卡片 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {railAttribution.map((r) => {
                  const isSmall = r.rail === "small";
                  const isMed = r.rail === "medium";
                  const border = isSmall
                    ? "border-emerald-200 bg-emerald-50/40"
                    : isMed
                    ? "border-blue-200 bg-blue-50/40"
                    : "border-purple-200 bg-purple-50/40";
                  const dotColor = isSmall ? "bg-emerald-500" : isMed ? "bg-blue-500" : "bg-purple-500";

                  return (
                    <div key={r.rail} className={`p-3 rounded-lg border ${border} text-xs`}>
                      <div className="flex items-center justify-between font-bold mb-1 text-gray-900">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                          {r.name}
                        </span>
                        <span className="font-mono text-gray-700">利润占比 {r.profit_ratio}%</span>
                      </div>
                      <div className="flex items-center justify-between text-gray-600 mt-2 font-mono">
                        <span>成交: {r.trades_count} 次</span>
                        <span className="font-bold text-gray-900">贡献利润: +¥{r.profit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. 可折叠逐笔交易明细流水 */}
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setShowAllTrades(!showAllTrades)}
              className="w-full py-3 px-5 bg-gray-50 flex items-center justify-between text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <span>回测撮合交易流水明细（最近 {trades.length} 笔）</span>
              <span className="flex items-center gap-1 text-blue-600">
                {showAllTrades ? "收起明细" : "展开明细"}
                {showAllTrades ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </button>

            {showAllTrades && (
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead className="bg-gray-50/80 sticky top-0 border-b border-gray-200 text-gray-500">
                    <tr>
                      <th className="py-2 px-4 font-semibold">成交时间</th>
                      <th className="py-2 px-4 font-semibold">动作</th>
                      <th className="py-2 px-4 font-semibold">轨道</th>
                      <th className="py-2 px-4 font-semibold">成交价格</th>
                      <th className="py-2 px-4 font-semibold">股数</th>
                      <th className="py-2 px-4 font-semibold">成交金额</th>
                      <th className="py-2 px-4 font-semibold">手续费</th>
                      <th className="py-2 px-4 font-semibold">预估获利</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {trades.map((t, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="py-2 px-4 text-gray-500">{t.trade_time}</td>
                        <td className="py-2 px-4">
                          <span
                            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-bold font-sans ${
                              t.action === "SELL"
                                ? "bg-red-100 text-red-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {t.action === "SELL" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {t.action_label}
                          </span>
                        </td>
                        <td className="py-2 px-4">
                          <span className="text-gray-700 font-sans font-medium">{t.rail_name}</span>
                        </td>
                        <td className="py-2 px-4 font-bold text-gray-900">¥{Number(t.price).toFixed(3)}</td>
                        <td className="py-2 px-4">{t.shares?.toLocaleString()} 股</td>
                        <td className="py-2 px-4">¥{t.amount?.toLocaleString()}</td>
                        <td className="py-2 px-4 text-gray-400">¥{t.fee}</td>
                        <td className="py-2 px-4 font-bold text-red-600 font-sans">
                          {t.action === "SELL" ? `+¥${t.profit}` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default BacktestCard;
