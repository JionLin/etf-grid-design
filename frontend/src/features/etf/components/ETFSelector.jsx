import React, { useState, useMemo } from "react";
import { Search, TrendingUp, ChevronDown, ChevronUp, Layers, CheckCircle2 } from "lucide-react";
import ETFInfoSkeleton from "./ETFInfoSkeleton";
import { ETF_CATEGORIES, getAllETFs } from "../../../shared/constants/etfCategories";

/**
 * 方案 B：两级分类胶囊标签 + 卡片矩阵 ETF 选择器组件
 */
export default function ETFSelector({
  value,
  onChange,
  error,
  popularETFs = [],
  etfInfo,
  loading,
}) {
  // 一级分类：'all' | 'stable' | 'prosperity'
  const [activeCategory, setActiveCategory] = useState("all");
  // 二级细分子类：'all' 或子类名称
  const [activeSubCategory, setActiveSubCategory] = useState("all");
  // 搜索关键字
  const [keyword, setKeyword] = useState("");
  // 是否展开全部卡片
  const [isExpanded, setIsExpanded] = useState(false);

  // 全量标的扁平列表
  const allETFs = useMemo(() => getAllETFs(), []);

  // 当前一级分类下的二级子类列表
  const currentSubCategories = useMemo(() => {
    if (activeCategory === "all") {
      const subs = new Set();
      allETFs.forEach((e) => subs.add(e.subCategory));
      return Array.from(subs);
    }
    const cat = ETF_CATEGORIES.find((c) => c.id === activeCategory);
    return cat ? cat.subCategories.map((s) => s.name) : [];
  }, [activeCategory, allETFs]);

  // 过滤后的卡片列表
  const filteredETFs = useMemo(() => {
    return allETFs.filter((item) => {
      // 一级过滤
      if (activeCategory !== "all" && item.categoryId !== activeCategory) {
        return false;
      }
      // 二级过滤
      if (activeSubCategory !== "all" && item.subCategory !== activeSubCategory) {
        return false;
      }
      // 关键字搜索过滤 (代码或名称)
      if (keyword.trim()) {
        const kw = keyword.trim().toLowerCase();
        const matchCode = item.code.toLowerCase().includes(kw);
        const matchName = item.name.toLowerCase().includes(kw);
        const matchTag = item.tag?.toLowerCase().includes(kw);
        return matchCode || matchName || matchTag;
      }
      return true;
    });
  }, [allETFs, activeCategory, activeSubCategory, keyword]);

  // 显示的标的列表（折叠时显示前 10 个或全部搜索结果）
  const displayedETFs = useMemo(() => {
    if (isExpanded || keyword.trim()) {
      return filteredETFs;
    }
    return filteredETFs.slice(0, 10);
  }, [filteredETFs, isExpanded, keyword]);

  // 切换一级分类
  const handleCategoryChange = (catId) => {
    setActiveCategory(catId);
    setActiveSubCategory("all");
  };

  return (
    <div className="space-y-4">
      {/* 头部标题与统计 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-base font-semibold text-gray-800">
          <Layers className="w-5 h-5 text-blue-600" />
          全市场做T ETF 标的池
          <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            共 {allETFs.length} 只标的
          </span>
        </label>
      </div>

      {/* 方案 B：标的卡片看板容器 */}
      <div className="p-4 bg-gradient-to-b from-gray-50 to-slate-50 border border-gray-200 rounded-xl shadow-sm space-y-3">
        {/* 一级大类选择与搜索框 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* 一级大类切换标签 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCategoryChange("all")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeCategory === "all"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              全部标的 ({allETFs.length})
            </button>
            {ETF_CATEGORIES.map((cat) => {
              const count = allETFs.filter((e) => e.categoryId === cat.id).length;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>

          {/* 关键字搜索框 */}
          <div className="relative w-full md:w-56">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索代码、名称或行业..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* 二级细分行业胶囊 */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-gray-200/80 text-xs">
          <span className="text-gray-400 mr-1 text-[11px]">细分行业:</span>
          <button
            type="button"
            onClick={() => setActiveSubCategory("all")}
            className={`px-2.5 py-0.5 rounded-full transition-colors ${
              activeSubCategory === "all"
                ? "bg-blue-100 text-blue-800 font-semibold"
                : "text-gray-600 hover:bg-gray-200/70"
            }`}
          >
            全部
          </button>
          {currentSubCategories.map((subName) => {
            const subCount = allETFs.filter(
              (e) =>
                (activeCategory === "all" || e.categoryId === activeCategory) &&
                e.subCategory === subName
            ).length;
            const isSubActive = activeSubCategory === subName;
            return (
              <button
                key={subName}
                type="button"
                onClick={() => setActiveSubCategory(subName)}
                className={`px-2.5 py-0.5 rounded-full transition-colors ${
                  isSubActive
                    ? "bg-blue-100 text-blue-800 font-semibold"
                    : "text-gray-600 hover:bg-gray-200/70"
                }`}
              >
                {subName} <span className="opacity-60 text-[10px]">({subCount})</span>
              </button>
            );
          })}
        </div>

        {/* 卡片矩阵 (响应式排布) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 pt-2">
          {displayedETFs.map((etf) => {
            const isSelected = value === etf.code;
            return (
              <button
                key={etf.code}
                type="button"
                onClick={() => onChange(etf.code)}
                className={`group relative text-left p-2.5 rounded-lg border transition-all duration-200 flex flex-col justify-between ${
                  isSelected
                    ? "bg-blue-50/90 border-blue-500 shadow-md ring-2 ring-blue-400/50"
                    : "bg-white border-gray-200/90 hover:border-blue-300 hover:shadow-sm"
                }`}
              >
                {/* 顶部：代码与微标签 */}
                <div className="flex items-center justify-between w-full mb-1">
                  <span
                    className={`font-mono text-sm font-bold tracking-tight ${
                      isSelected ? "text-blue-700" : "text-gray-900 group-hover:text-blue-600"
                    }`}
                  >
                    {etf.code}
                  </span>
                  {etf.tag && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        isSelected
                          ? "bg-blue-200/80 text-blue-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {etf.tag}
                    </span>
                  )}
                </div>

                {/* 中部：完整中文名称 */}
                <div className="font-medium text-xs text-gray-800 line-clamp-1 mb-1">
                  {etf.name}
                </div>

                {/* 底部：行业与说明 */}
                <div className="flex items-center justify-between text-[11px] text-gray-600 pt-1 border-t border-gray-100">
                  <span className="truncate max-w-[120px]">{etf.note || etf.subCategory}</span>
                  {isSelected && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* 无匹配结果 */}
        {filteredETFs.length === 0 && (
          <div className="text-center py-6 text-xs text-gray-500">
            没有找到与 “{keyword}” 相关的标的
          </div>
        )}

        {/* 展开/收起按钮 */}
        {!keyword.trim() && filteredETFs.length > 10 && (
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium py-1 px-3 rounded hover:bg-blue-50 transition-colors"
            >
              {isExpanded ? (
                <>
                  收起标的池 <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  展开全部 {filteredETFs.length} 只标的 <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 手动输入与当前选中标的实时行情展示栏 */}
      <div className="pt-1">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
          <span>手动精确输入 ETF 代码：</span>
          {value && (
            <span className="text-blue-600 font-medium">当前已选：{value}</span>
          )}
        </div>
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={(e) =>
              onChange(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="支持从上方卡片点击选中，或在此输入6位代码，如：515220"
            className={`w-full px-4 py-2.5 text-sm bg-white border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              error ? "border-red-300" : "border-gray-300"
            }`}
            maxLength={6}
          />
        </div>

        {/* 实时行情卡片预览 */}
        <div className="mt-2.5" style={{ minHeight: "75px" }}>
          {loading && <ETFInfoSkeleton />}

          {!loading && etfInfo && (
            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-lg flex items-center justify-between shadow-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-gray-900 text-sm">
                    {etfInfo.name} ({etfInfo.code || value})
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                    {etfInfo.management_company || "公募ETF"}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  成交额：{(etfInfo.amount / 100000000).toFixed(2)} 亿元 | 成交量：{(etfInfo.volume / 10000).toFixed(0)} 万手
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-mono font-bold text-blue-800">
                  ¥{etfInfo.current_price?.toFixed(3)}
                </div>
                <div
                  className={`text-xs font-semibold ${
                    etfInfo.change_pct >= 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {etfInfo.change_pct >= 0 ? "+" : ""}
                  {etfInfo.change_pct?.toFixed(2)}%
                </div>
              </div>
            </div>
          )}

          {!loading && error && (
            <p className="mt-1 text-xs text-red-600">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
