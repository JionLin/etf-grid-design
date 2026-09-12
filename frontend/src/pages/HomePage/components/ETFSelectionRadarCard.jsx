import React, { useState, useEffect } from "react";
import {
  Compass,
  Flame,
  Snowflake,
  Coins,
  Cpu,
  Layers,
  TrendingUp,
  ShieldCheck,
  ChevronRight,
  ArrowRight
} from "lucide-react";

/**
 * 首页今日 ETF 网格选品雷达看板
 */
const ETFSelectionRadarCard = ({ onSelectETF }) => {
  const [category, setCategory] = useState("all");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tradeDate, setTradeDate] = useState("");

  const categories = [
    { id: "all", label: "🔥 全部优选 (大底防守)", icon: Flame },
    { id: "extreme_bottom", label: "🧊 极寒大底捡便宜", icon: Snowflake },
    { id: "dividend", label: "💰 稳健高股息", icon: Coins },
    { id: "cyclical", label: "⛏️ 周期金融与资源", icon: Layers },
    { id: "tech", label: "⚡ 科技成长做T", icon: Cpu },
  ];

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetch(`/api/etf/radar?category=${category}&limit=15`)
      .then((res) => res.json())
      .then((res) => {
        if (isMounted && res.success) {
          setItems(res.data || []);
          if (res.data?.[0]?.trade_date) {
            setTradeDate(res.data[0].trade_date);
          }
        }
      })
      .catch((err) => {
        console.error("加载选品雷达数据失败:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [category]);

  const getIndustryBadge = (type) => {
    switch (type) {
      case "cyclical_asset":
        return "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400";
      case "tech_growth":
        return "bg-purple-50 text-purple-700 border-purple-200/60 dark:bg-purple-950/40 dark:text-purple-400";
      default:
        return "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-400";
    }
  };

  const getIndustryText = (type) => {
    switch (type) {
      case "cyclical_asset":
        return "周期金融";
      case "tech_growth":
        return "科技成长";
      default:
        return "宽基指数";
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm mb-8 transition-all hover:shadow-md">
      {/* 头部标题与描述 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80 gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
            <Compass className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                今日 ETF 立体网格选品雷达
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/60">
                5y/10y 真大底
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              基于雪球官方双周期全量 ECDF 分位与宏观 ERP 利差模型 · 每日收盘更新
              {tradeDate && ` (${tradeDate})`}
            </p>
          </div>
        </div>
      </div>

      {/* 分类筛选胶囊 */}
      <div className="flex items-center space-x-2 overflow-x-auto py-3.5 scrollbar-none">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = category === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200 dark:shadow-none"
                  : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* 雷达列表表格 */}
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200/70 dark:border-slate-800 text-slate-500 dark:text-slate-400">
              <th className="py-2.5 px-3 font-semibold">标的代码 / 名称</th>
              <th className="py-2.5 px-3 font-semibold">行业属性</th>
              <th className="py-2.5 px-3 font-semibold">市盈率 PE (5y / 10y)</th>
              <th className="py-2.5 px-3 font-semibold">市净率 PB (5y / 10y)</th>
              <th className="py-2.5 px-3 font-semibold">股息率 & ERP</th>
              <th className="py-2.5 px-3 font-semibold">大底安全分</th>
              <th className="py-2.5 px-3 font-semibold text-right">策略操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-400">
                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-indigo-500 border-t-transparent mr-2 align-middle"></div>
                  正在从 SQLite 数据库提取最新雷达榜单...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-400">
                  暂无匹配的优选标的
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.etf_code}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                >
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <span className="font-mono text-indigo-600 dark:text-indigo-400">
                        {item.etf_code}
                      </span>
                      <span className="truncate max-w-[120px] sm:max-w-[160px]">
                        {item.etf_name.split(" ")[0]}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      跟踪：{item.index_name}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${getIndustryBadge(
                        item.industry_type
                      )}`}
                    >
                      {getIndustryText(item.industry_type)}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono">
                    <div className="text-slate-800 dark:text-slate-200">
                      {item.current_pe > 0 ? `${item.current_pe}倍` : "--"}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {item.pe_pct_5y}% / {item.pe_pct_10y}%
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono">
                    <div className="text-slate-800 dark:text-slate-200">
                      {item.current_pb > 0 ? `${item.current_pb}倍` : "--"}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {item.pb_pct_5y}% / {item.pb_pct_10y}%
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-emerald-600 dark:text-emerald-400">
                      {item.dividend_yield > 0 ? `${item.dividend_yield}%` : "--"}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      ERP: {item.erp_value}%
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                        {item.safe_score}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {item.tier}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      建议底仓 {Math.round(item.suggested_base * 100)}%
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => onSelectETF && onSelectETF(item)}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white dark:bg-indigo-950/60 dark:hover:bg-indigo-600 dark:text-indigo-400 dark:hover:text-white text-xs font-bold transition-all border border-indigo-200/80 dark:border-indigo-800/80 shadow-xs"
                    >
                      <span>一键布网</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 底部投顾说明提示 */}
      <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
        <span className="flex items-center">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 mr-1.5" />
          点击任意标的的【一键布网】，系统将自动填充代码，并根据大底估值预设最优底仓与加码参数。
        </span>
      </div>
    </div>
  );
};

export default ETFSelectionRadarCard;
