import React from "react";
import {
  ThermometerSun,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Snowflake,
  Layers,
  Sparkles,
  Percent,
  Scale,
  TrendingDown,
  Coins
} from "lucide-react";

/**
 * 标的历史估值温度计与大底安全边际卡片 (支持 5y/10y 双周期、ERP 与行业自适应)
 */
const ValuationGaugeCard = ({ valuation }) => {
  if (!valuation) return null;

  const {
    index_code,
    index_name,
    industry_type = "broad_balanced",
    current_pe,
    pe_percentile = 50.0,
    current_pb,
    pb_percentile = 50.0,
    dividend_yield,
    temperature = 50.0,
    tier = "适温合理",
    description = "",
    advice = "",
    suggested_base_position = 0.5,
    is_fatal_flaw = false,
    fatal_flaw_reason,
    is_fallback = false,
    source = "csindex_official",
    trade_date = "",
    safe_score,
    erp_info,
    valuation_matrix
  } = valuation;

  // 五档温度样式映射
  const getTierBadge = () => {
    switch (tier) {
      case "极寒低估":
        return {
          bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
          icon: <Snowflake className="w-4 h-4 text-emerald-500 mr-1.5 animate-pulse" />,
          pill: "bg-emerald-600 text-white"
        };
      case "偏冷适中":
        return {
          bg: "bg-teal-500/10 border-teal-500/30 text-teal-600 dark:text-teal-400",
          icon: <ShieldCheck className="w-4 h-4 text-teal-500 mr-1.5" />,
          pill: "bg-teal-600 text-white"
        };
      case "适温合理":
        return {
          bg: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
          icon: <ThermometerSun className="w-4 h-4 text-amber-500 mr-1.5" />,
          pill: "bg-amber-600 text-white"
        };
      case "偏热高位":
        return {
          bg: "bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400",
          icon: <Flame className="w-4 h-4 text-orange-500 mr-1.5" />,
          pill: "bg-orange-600 text-white"
        };
      case "沸点高估":
      default:
        return {
          bg: "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400",
          icon: <AlertTriangle className="w-4 h-4 text-rose-500 mr-1.5" />,
          pill: "bg-rose-600 text-white"
        };
    }
  };

  const badgeStyle = getTierBadge();
  const clampedTemp = Math.max(1, Math.min(99, Number(temperature)));

  // 行业自适应标签
  const getIndustryLabel = () => {
    if (industry_type === "cyclical_asset") return "周期重资产与大金融 (PB/股息主导)";
    if (industry_type === "tech_growth") return "高景气科技与轻资产 (PE/PS主导)";
    return "全市场宽基 (PE/PB均衡加权)";
  };

  const pe5y = valuation_matrix?.pe?.pct_5y ?? pe_percentile;
  const pe10y = valuation_matrix?.pe?.pct_10y ?? pe_percentile;
  const pb5y = valuation_matrix?.pb?.pct_5y ?? pb_percentile;
  const pb10y = valuation_matrix?.pb?.pct_10y ?? pb_percentile;
  const ps5y = valuation_matrix?.ps?.pct_5y ?? 50.0;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6 transition-all hover:shadow-md">
      {/* 头部标题与元信息 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-100 dark:border-slate-800/80 gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
            <ThermometerSun className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                标的历史估值温度计与大底安全边际
              </h3>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeStyle.bg}`}>
                {badgeStyle.icon}
                {tier}
              </span>
              {safe_score !== undefined && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                  安全指数: {safe_score}分
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
              <span>跟踪指数：{index_name} ({index_code})</span>
              <span>· 行业属性：{getIndustryLabel()}</span>
              {trade_date && <span>· 更新日期：{trade_date}</span>}
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {source === "danjuan_official" ? "雪球官方双周期全量源" : source === "csindex_official" ? "中证官方披露" : is_fallback ? "内置基准底表" : source}
              </span>
            </p>
          </div>
        </div>

        {/* 建议底仓胶囊 */}
        <div className="flex items-center bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3.5 py-2 shrink-0">
          <Layers className="w-4 h-4 text-indigo-500 mr-2" />
          <div className="text-right">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">建议初始底仓</div>
            <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
              {Math.round(suggested_base_position * 100)}%
            </div>
          </div>
        </div>
      </div>

      {/* 致命缺陷警示栏 (若存在) */}
      {is_fatal_flaw && (
        <div className="mt-5 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 flex items-start space-x-3 text-rose-800 dark:text-rose-300 animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <div className="font-bold text-sm mb-0.5">【致命缺陷拦截】当前标的处于历史极端高估值区间！</div>
            <div>{fatal_flaw_reason || "标的历史分位数极高，极易遭受漫长估值杀跌，严禁重仓开网，防范戴维斯双杀风险！"}</div>
          </div>
        </div>
      )}

      {/* 五档色带温度计标尺 */}
      <div className="mt-6 mb-6">
        <div className="flex justify-between items-center text-xs mb-2">
          <span className="text-slate-600 dark:text-slate-400 font-medium flex items-center">
            <Percent className="w-3.5 h-3.5 mr-1 text-slate-400" />
            宏观与历史大底综合安全分位标尺
          </span>
          <span className="font-bold text-slate-900 dark:text-slate-100">
            综合温度: <span className="text-indigo-600 dark:text-indigo-400 text-sm">{clampedTemp}%</span> ({tier})
          </span>
        </div>

        {/* 渐变色带 */}
        <div className="relative h-4 rounded-full overflow-hidden flex shadow-inner bg-slate-100 dark:bg-slate-800">
          <div className="w-[20%] bg-emerald-500" title="极寒低估 (0%~20%)" />
          <div className="w-[20%] bg-teal-500" title="偏冷适中 (20%~40%)" />
          <div className="w-[20%] bg-amber-400" title="适温合理 (40%~60%)" />
          <div className="w-[20%] bg-orange-500" title="偏热高位 (60%~80%)" />
          <div className="w-[20%] bg-rose-500" title="沸点高估 (80%~100%)" />
        </div>

        {/* 指针标记 */}
        <div className="relative h-6 mt-1">
          <div
            className="absolute -top-1 -translate-x-1/2 flex flex-col items-center transition-all duration-500"
            style={{ left: `${clampedTemp}%` }}
          >
            <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[6px] border-b-indigo-600 dark:border-b-indigo-400" />
            <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 mt-0.5 bg-white dark:bg-slate-900 px-1 rounded shadow-sm">
              ▲ {clampedTemp}%
            </span>
          </div>
        </div>

        {/* 五档文字标签标尺 */}
        <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1 mt-1 font-medium">
          <span className="text-emerald-600 dark:text-emerald-400">🧊 极寒 (0-20%)</span>
          <span className="text-teal-600 dark:text-teal-400">❄️ 偏冷 (20-40%)</span>
          <span className="text-amber-600 dark:text-amber-400">🌤️ 适温 (40-60%)</span>
          <span className="text-orange-600 dark:text-orange-400">🔥 偏热 (60-80%)</span>
          <span className="text-rose-600 dark:text-rose-400">🌋 沸点 (80-100%)</span>
        </div>
      </div>

      {/* 5y/10y 双周期高精度估值矩阵卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-5">
        {/* 市盈率 PE 卡片 */}
        <div className="bg-slate-50/90 dark:bg-slate-800/40 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">市盈率 (PE-TTM)</span>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {current_pe > 0 ? `${current_pe} 倍` : "--"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
            <div>
              <span className="text-[11px] text-slate-500 block">近5年百分位</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{pe5y}%</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">近10年百分位</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{pe10y}%</span>
            </div>
          </div>
        </div>

        {/* 市净率 PB 卡片 */}
        <div className="bg-slate-50/90 dark:bg-slate-800/40 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">市净率 (PB)</span>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {current_pb > 0 ? `${current_pb} 倍` : "--"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
            <div>
              <span className="text-[11px] text-slate-500 block">近5年百分位</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{pb5y}%</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">近10年百分位</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{pb10y}%</span>
            </div>
          </div>
        </div>

        {/* 现金股息率与宏观利差 ERP 卡片 */}
        <div className="bg-slate-50/90 dark:bg-slate-800/40 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center">
              <Coins className="w-3.5 h-3.5 mr-1 text-emerald-500" />
              股息率 & 股债利差
            </span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {dividend_yield > 0 ? `${dividend_yield}%` : "--"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
            <div>
              <span className="text-[11px] text-slate-500 block">股债利差 (ERP)</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {erp_info ? `${erp_info.erp_value}%` : "--"}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">大底宏观评级</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400 truncate block">
                {erp_info?.level ? erp_info.level.slice(0, 8) : "安全边际良好"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 投顾策略建言 */}
      <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/80 dark:border-indigo-900/30 flex items-start space-x-3">
        <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          <span className="font-bold text-slate-900 dark:text-slate-100 mr-1.5">网格建仓投顾指引：</span>
          {advice || "结合历史估值与波动率特征，合理规划网格步长与资金深度。"}
        </div>
      </div>
    </div>
  );
};

export default ValuationGaugeCard;
