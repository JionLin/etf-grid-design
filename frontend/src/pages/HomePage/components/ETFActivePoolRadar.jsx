import React, { useState, useEffect, useMemo } from "react";

// 二级产业链细分定义映射树
const SUB_SECTORS_MAP = {
  科技芯片: [
    { name: "半导体芯片", kws: ["半导体", "芯片"] },
    { name: "人工智能/AI", kws: ["人工智能", "AI", "算力", "机器人"] },
    { name: "软件信创", kws: ["软件", "计算机", "信创", "大数据", "云计算"] },
    { name: "电子通信", kws: ["电子", "通信", "5G", "消费电子"] },
    { name: "传媒游戏", kws: ["传媒", "游戏", "影视", "动漫"] },
  ],
  周期资源: [
    { name: "有色金属", kws: ["有色", "金属", "铜", "铝", "金"] },
    { name: "煤炭资源", kws: ["煤炭"] },
    { name: "化工材料", kws: ["化工", "橡胶"] },
    { name: "钢铁资源", kws: ["钢铁"] },
    { name: "油气石化", kws: ["油", "气", "能源", "石化"] },
    { name: "稀土稀有", kws: ["稀土", "稀有"] },
  ],
  大金融: [
    { name: "证券券商", kws: ["证券", "券商"] },
    { name: "银行", kws: ["银行"] },
    { name: "保险/金融科技/地产", kws: ["保险", "金融科技", "金融", "地产"] },
  ],
  新能源制造: [
    { name: "光伏设备", kws: ["光伏"] },
    { name: "电池储能", kws: ["电池", "锂电", "储能", "风电"] },
    { name: "新能车", kws: ["汽车", "智能网联", "新能"] },
    { name: "高端装备", kws: ["机械", "装备", "工业母机", "高端制造"] },
  ],
  医药健康: [
    { name: "创新药", kws: ["创新药", "药"] },
    { name: "医疗器械", kws: ["医疗", "器械"] },
    { name: "中药", kws: ["中药"] },
    { name: "生物疫苗", kws: ["生物", "疫苗"] },
  ],
  大消费: [
    { name: "白酒酒类", kws: ["白酒", "酒"] },
    { name: "食品饮料", kws: ["食品", "饮料"] },
    { name: "家用电器", kws: ["家电", "电器"] },
    { name: "农业养殖旅游", kws: ["农业", "养殖", "畜牧", "旅游"] },
  ],
  公用红利: [
    { name: "红利低波", kws: ["红利", "低波", "高股息"] },
    { name: "绿色电力", kws: ["电力", "绿电"] },
    { name: "公用基建", kws: ["公用", "基建", "水务", "核电"] },
  ],
  国防军工: [
    { name: "军工龙头", kws: ["军工"] },
    { name: "航空航天", kws: ["航空", "航天", "国防"] },
  ],
  跨境全球: [
    { name: "港股科技", kws: ["恒生科技", "港股通科技", "互联网", "中概"] },
    { name: "港股医药/红利", kws: ["恒生医疗", "港股通红利", "港股通医药"] },
    { name: "美股纳指标普", kws: ["纳斯达克", "纳指", "标普"] },
    { name: "日韩亚太", kws: ["日经", "韩国", "亚太", "中韩"] },
    { name: "欧洲成熟", kws: ["德国", "法国", "欧洲"] },
  ],
  大宗商品: [
    { name: "黄金贵金属", kws: ["黄金", "白银"] },
    { name: "农产品豆粕", kws: ["豆粕"] },
    { name: "能源化工期货", kws: ["能源化工", "有色期货"] },
  ],
  核心宽基: [
    { name: "超大盘(300/50)", kws: ["300", "50", "A50"] },
    { name: "中小盘(500/1000/2000)", kws: ["500", "1000", "2000"] },
    { name: "双创成长", kws: ["创业板", "科创50", "科创100"] },
  ],
};

const ALL_PRIMARY_SECTORS = [
  "全部",
  "科技芯片",
  "新能源制造",
  "医药健康",
  "大金融",
  "大消费",
  "周期资源",
  "公用红利",
  "国防军工",
  "跨境全球",
  "大宗商品",
  "核心宽基",
];

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

  // 当一级分类变更时，重置二级分类为“全部”
  const handlePrimarySectorChange = (sector) => {
    setSelectedSector(sector);
    setSelectedSubSector("全部");
  };

  // 加载全市场做 T 标的池
  useEffect(() => {
    fetchPoolData();
  }, [selectedSector, onlyT0, selectedElasticity]);

  const fetchPoolData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedSector !== "全部") params.append("sector", selectedSector);
      if (onlyT0) params.append("is_t0", "true");
      if (selectedElasticity !== "全部")
        params.append("elasticity", selectedElasticity);
      params.append("min_ma20_amount", "3000");
      params.append("min_atr", "1.5");

      const res = await fetch(`/api/etf/pool?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setPoolData(json.data);
      }
    } catch (e) {
      console.error("加载标的池失败:", e);
    } finally {
      setLoading(false);
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
    if (selectedSector === "全部" || !SUB_SECTORS_MAP[selectedSector]) {
      return [];
    }
    const defs = SUB_SECTORS_MAP[selectedSector];
    const items = poolData.items || [];

    // 动态计算每个二级分类的命中数量
    const subs = defs.map((def) => {
      const count = items.filter((it) =>
        def.kws.some((k) => it.name.includes(k))
      ).length;
      return { ...def, count };
    });

    return [{ name: "全部", count: items.length, kws: [] }, ...subs];
  }, [selectedSector, poolData.items]);

  // 客户端过滤：二级分类 + 搜索关键字
  const filteredItems = useMemo(() => {
    let result = poolData.items || [];

    // 1. 二级细分分类过滤
    if (selectedSubSector !== "全部" && SUB_SECTORS_MAP[selectedSector]) {
      const targetDef = SUB_SECTORS_MAP[selectedSector].find(
        (s) => s.name === selectedSubSector
      );
      if (targetDef && targetDef.kws.length > 0) {
        result = result.filter((it) =>
          targetDef.kws.some((k) => it.name.includes(k))
        );
      }
    }

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
              本地 SQLite 毫秒直出
            </span>
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
          {ALL_PRIMARY_SECTORS.map((sector) => {
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.slice(0, 48).map((item) => {
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
      )}
    </div>
  );
}
