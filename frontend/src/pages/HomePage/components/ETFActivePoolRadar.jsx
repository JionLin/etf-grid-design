import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  CARD_RENDER_LIMIT,
  PRIMARY_SECTORS,
  buildTruncationLabel,
  filterByStoredSubsector,
  subsectorsForSector,
} from "./radarDisplay";

export default function ETFActivePoolRadar({ onSelectETF }) {
  const [loading, setLoading] = useState(true);
  const [poolData, setPoolData] = useState({
    total: 0,
    t0_total: 0,
    sectors_summary: [],
    items: [],
  });
  const [selectedSector, setSelectedSector] = useState("全部");
  const [selectedSubSector, setSelectedSubSector] = useState("全部");
  const [onlyT0, setOnlyT0] = useState(false);
  const [selectedElasticity, setSelectedElasticity] = useState("全部");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [showUnclassified, setShowUnclassified] = useState(false);
  const [unclassifiedItems, setUnclassifiedItems] = useState([]);

  // 当一级分类变更时，重置二级分类为“全部”
  const handlePrimarySectorChange = (sector) => {
    setSelectedSector(sector);
    setSelectedSubSector("全部");
  };

  // 加载全市场做 T 标的池
  useEffect(() => {
    const controller = new AbortController();
    fetchPoolData(controller.signal);
    return () => controller.abort();
  }, [selectedSector, selectedSubSector, onlyT0, selectedElasticity]);

  const fetchUnclassified = async (signal) => {
    try {
      const params = new URLSearchParams();
      params.append("sector", "未归类");
      params.append("min_ma20_amount", "3000");
      params.append("min_atr", "1.5");
      const res = await fetch(`/api/etf/pool?${params.toString()}`, { signal });
      const json = await res.json();
      if (signal?.aborted) return;
      if (json.success && json.data) {
        setUnclassifiedItems(json.data.items || []);
      }
    } catch (e) {
      if (e?.name === "AbortError") return;
      console.error("加载未归类标的失败:", e);
    }
  };

  const fetchPoolData = async (signal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedSector !== "全部") params.append("sector", selectedSector);
      if (onlyT0) params.append("is_t0", "true");
      if (selectedElasticity !== "全部")
        params.append("elasticity", selectedElasticity);
      if (selectedSubSector !== "全部") params.append("subsector", selectedSubSector);
      params.append("min_ma20_amount", "3000");
      params.append("min_atr", "1.5");

      const res = await fetch(`/api/etf/pool?${params.toString()}`, { signal });
      const json = await res.json();
      if (signal?.aborted) return;
      if (json.success && json.data) {
        setPoolData(json.data);
      }
    } catch (e) {
      if (e?.name === "AbortError") return;
      console.error("加载标的池失败:", e);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  // 建立一级赛道数量映射
  const sectorCountMap = useMemo(() => {
    const map = {};
    (poolData.sectors_summary || []).forEach((s) => {
      map[s.name] = s.count;
    });
    return map;
  }, [poolData.sectors_summary]);

  // 当前一级赛道下的二级细分列表配置
  const currentSubSectors = useMemo(() => {
    if (selectedSector === "全部") {
      return [];
    }
    const subs = subsectorsForSector(poolData.subsectors_summary, selectedSector);
    const sectorCount = sectorCountMap[selectedSector] ?? 0;
    return [{ name: "全部", count: sectorCount }, ...subs];
  }, [selectedSector, poolData.subsectors_summary, sectorCountMap]);

  // 客户端过滤：二级分类 + 搜索关键字
  const filteredItems = useMemo(() => {
    let result = poolData.items || [];

    result = filterByStoredSubsector(result, selectedSubSector);

    // 2. 搜索关键字过滤
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      result = result.filter(
        (item) =>
          item.etf_code.toLowerCase().includes(kw) ||
          item.name.toLowerCase().includes(kw)
      );
    }

    return result;
  }, [poolData.items, selectedSector, selectedSubSector, searchKeyword]);

  const renderedItems = filteredItems.slice(0, CARD_RENDER_LIMIT);
  const sectorHitCount =
    selectedSector === "全部"
      ? poolData.total || 0
      : sectorCountMap[selectedSector] ?? filteredItems.length;
  const selectedSubCount = currentSubSectors.find((item) => item.name === selectedSubSector)?.count;
  const usesClientFilter = Boolean(searchKeyword.trim());
  const hitCount = usesClientFilter
    ? filteredItems.length
    : selectedSubSector !== "全部"
      ? selectedSubCount ?? filteredItems.length
      : sectorHitCount;
  const truncationLabel = buildTruncationLabel(hitCount, renderedItems.length);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 sm:p-8 space-y-6">
      {/* 标题栏与双重护城河介绍 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 dark:border-gray-700 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
              全市场做 T 核心 ETF 选品雷达
            </h2>
            <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs px-2.5 py-1 rounded-full font-bold border border-emerald-200 dark:border-emerald-800">
              本机 MySQL 直出
            </span>
            <Link
              to="/grid-fit"
              className="text-xs font-semibold text-indigo-700 underline"
            >
              网格适合度榜
            </Link>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1.5 flex items-center gap-1.5">
            <span>🛡️</span>
            <span>
              三重品质护城河：已自动过滤上市未满 3 年次新、月均成交低于 3,000 万元及波幅低于 1.5% 的死水标的，精选高胜率做 T 标的池
            </span>
          </p>
        </div>

        {/* 快捷搜索框 */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="搜索代码 / 名称..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
          />
          <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
        </div>
      </div>

      {/* 第一层：8 大产业链赛道胶囊切换 (带动态真实总数) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            产业与资产赛道 (互斥主分类)
          </span>
          <span className="text-xs font-semibold text-gray-400">
            共精选出 {poolData.total || 0} 只成熟标的
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRIMARY_SECTORS.map((sector) => {
            const isSelected = selectedSector === sector;
            const count =
              sector === "全部"
                ? poolData.total || 0
                : sectorCountMap[sector] ?? 0;

            return (
              <button
                key={sector}
                onClick={() => handlePrimarySectorChange(sector)}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-105"
                    : "bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                <span>{sector}</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected
                      ? "bg-blue-700 text-blue-100"
                      : "bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 第二层：选定赛道后的二级产业链细分下钻展开 (带数量标记) */}
      {currentSubSectors.length > 0 && (
        <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50 space-y-2 animate-fadeIn">
          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800 dark:text-blue-300">
            <span>▼</span>
            <span>{selectedSector} 产业链细分下钻:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {currentSubSectors.map((sub) => {
              const isSubSelected = selectedSubSector === sub.name;
              return (
                <button
                  key={sub.name}
                  onClick={() => setSelectedSubSector(sub.name)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    isSubSelected
                      ? "bg-blue-600 text-white shadow-sm scale-105"
                      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-blue-200/60 dark:border-gray-700 hover:bg-blue-100/50"
                  }`}
                >
                  <span>{sub.name}</span>
                  <span
                    className={`text-[10px] font-mono px-1 rounded ${
                      isSubSelected
                        ? "bg-blue-700 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-500"
                    }`}
                  >
                    {sub.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 第三层：正交量化特征过滤器 */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-700">
        {/* T+0 开关 */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">交易机制:</span>
          <button
            onClick={() => setOnlyT0(!onlyT0)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              onlyT0
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-amber-500"
            }`}
          >
            <span>⚡</span>
            <span>仅看日内 T+0 ({poolData.t0_total || 0}只)</span>
          </button>
        </div>

        {/* ATR 弹性档位 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">ATR 弹性:</span>
          {["全部", "高弹性", "稳健型", "低波防守"].map((elast) => (
            <button
              key={elast}
              onClick={() => setSelectedElasticity(elast)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                selectedElasticity === elast
                  ? "bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              {elast}
            </button>
          ))}
        </div>
      </div>

      {poolData.unclassified_count > 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              const next = !showUnclassified;
              setShowUnclassified(next);
              if (next && unclassifiedItems.length === 0) {
                fetchUnclassified();
              }
            }}
            className="text-xs font-semibold text-gray-500 dark:text-gray-400"
          >
            {showUnclassified ? "收起" : "展开"}未归类（{poolData.unclassified_count}）· 不进入选品与回测宇宙
          </button>
          {showUnclassified && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              这些名称无法归入 11 个可购赛道，默认不出现在主列表。它们不计入「全部」，也不进入网格适合度榜。
              {unclassifiedItems.length > 0
                ? ` ${unclassifiedItems.map((item) => item.name).slice(0, 8).join("、")}${unclassifiedItems.length > 8 ? "…" : ""}`
                : ""}
            </p>
          )}
        </div>
      )}

      {/* 标的卡片网格列表 */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-gray-500">正在从本地数据库提取标的池...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">
          未匹配到符合条件的标的，可尝试切换其他细分赛道
        </div>
      ) : (
        <div className="space-y-3">
          {truncationLabel && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {truncationLabel}
              。标题中的总数是当前赛道命中数，不是本页已画出的卡片数。
              {searchKeyword.trim() ? " 搜索只作用于已返回列表，不是全宇宙。" : ""}
            </p>
          )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderedItems.map((item) => {
            const isUp = item.pct_change >= 0;
            return (
              <div
                key={item.etf_code}
                onClick={() => onSelectETF && onSelectETF(item.etf_code)}
                className="bg-white dark:bg-gray-800/90 border border-gray-100 dark:border-gray-700/80 rounded-xl p-4 hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200 group flex flex-col justify-between cursor-pointer"
              >
                <div>
                  {/* 第一行：代码、名称与徽章 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-gray-900 dark:text-gray-100 text-base">
                        {item.etf_code}
                      </span>
                      <span className="font-bold text-gray-800 dark:text-gray-200 text-sm line-clamp-1">
                        {item.name}
                      </span>
                    </div>
                    {item.is_t0 && (
                      <span className="bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] font-black px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-800">
                        T+0
                      </span>
                    )}
                  </div>

                  {/* 第二行：赛道分类与弹性标签 */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded">
                      {item.sector}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        item.elasticity === "高弹性"
                          ? "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400"
                          : item.elasticity === "稳健型"
                          ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"
                          : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {item.elasticity} (ATR {item.atr_pct}%)
                    </span>
                  </div>

                  {/* 第三行：行情与流动性指标 */}
                  <div className="grid grid-cols-2 gap-2 py-2 border-t border-b border-gray-50 dark:border-gray-700/50 text-xs mb-3">
                    <div>
                      <span className="text-gray-400 block text-[11px]">最新价格</span>
                      <span className="font-bold font-mono text-gray-800 dark:text-gray-200">
                        ¥{Number(item.latest_price).toFixed(3)}
                      </span>
                      <span
                        className={`ml-1.5 font-semibold font-mono ${
                          isUp ? "text-rose-500" : "text-emerald-500"
                        }`}
                      >
                        {isUp ? "+" : ""}
                        {Number(item.pct_change).toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-400 block text-[10px]">
                        今日: {item.amount_10k >= 10000 ? `${(item.amount_10k / 10000).toFixed(2)}亿` : `${Number(item.amount_10k).toFixed(0)}万`}
                      </span>
                      <span className="font-bold font-mono text-blue-600 dark:text-blue-400 block text-[11px]">
                        月均: {item.amount_ma20_10k >= 10000 ? `${(item.amount_ma20_10k / 10000).toFixed(2)} 亿元` : `${Number(item.amount_ma20_10k).toFixed(0)} 万元`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 底部一键带入按钮 */}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (onSelectETF) {
                      onSelectETF(item.etf_code);
                    }
                  }}
                  className="w-full mt-1 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white dark:bg-blue-950/50 dark:hover:bg-blue-600 dark:text-blue-300 dark:hover:text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 group-hover:scale-[1.02]"
                >
                  <span>↓</span>
                  <span>填入下方代码</span>
                </button>
              </div>
            );
          })}
        </div>
        </div>
      )}
    </div>
  );
}
