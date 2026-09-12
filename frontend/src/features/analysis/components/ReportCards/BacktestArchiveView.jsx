import React, { useState, useEffect, useMemo } from "react";
import {
  Database,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Filter,
  Layers,
  Calendar,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  getBacktestRecords,
  getBacktestRecordDetail,
  deleteBacktestRecord,
  getBacktestDistinctETFs,
} from "@shared/services/api";

export default function BacktestArchiveView({ onApplyParams }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [records, setRecords] = useState([]);
  const [distinctEtfs, setDistinctEtfs] = useState([]);
  const [selectedEtf, setSelectedEtf] = useState("");
  const [selectedDays, setSelectedDays] = useState("");
  const [latestOnly, setLatestOnly] = useState(true);
  const [appliedNotice, setAppliedNotice] = useState(null);

  // 展开查看详情的状态
  const [expandedRunId, setExpandedRunId] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState({});

  // 详情内部的分轨与分页
  const [detailRail, setDetailRail] = useState("all");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // 格式化测算时间
  const formatRecordTime = (timeStr) => {
    if (!timeStr) return "-";
    if (typeof timeStr === "string") {
      return timeStr.replace("T", " ").replace(/\.\d+.*$/, "").slice(0, 19);
    }
    return String(timeStr);
  };

  // 加载档案列表与标的列表
  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedEtf) params.etfCode = selectedEtf;
      if (selectedDays) params.days = selectedDays;
      params.latestOnly = latestOnly ? "true" : "false";

      const [res, etfRes] = await Promise.all([
        getBacktestRecords(params),
        getBacktestDistinctETFs(),
      ]);

      if (res?.success && res.data) {
        const rawList = res.data.records || [];
        // 按照周期最长排在最上面进行倒序展示 (5年 -> 3年 -> 2年 -> 1年 -> 半年 -> 90天)
        const sortedList = rawList.slice().sort((a, b) => (Number(b.backtest_days) || 0) - (Number(a.backtest_days) || 0));
        setRecords(sortedList);
      } else {
        setError(res?.error || "读取回测档案失败");
      }

      if (etfRes?.success && etfRes.data) {
        setDistinctEtfs(etfRes.data || []);
      }
    } catch (err) {
      setError(err?.message || "网络请求异常");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [selectedEtf, selectedDays, latestOnly]);

  // 切换展开/收起详情
  const toggleDetail = async (runId) => {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      return;
    }
    setExpandedRunId(runId);
    setDetailRail("all");
    setCurrentPage(1);

    if (!detailData[runId]) {
      setDetailLoading(true);
      try {
        const res = await getBacktestRecordDetail(runId);
        if (res?.success && res.data) {
          setDetailData((prev) => ({ ...prev, [runId]: res.data }));
        }
      } catch (err) {
        console.error("加载档案详情失败:", err);
      } finally {
        setDetailLoading(false);
      }
    }
  };

  // 删除档案
  const handleDelete = async (runId, e) => {
    e.stopPropagation();
    if (!window.confirm("确定要删除这条回测档案记录吗？")) return;
    try {
      const res = await deleteBacktestRecord(runId);
      if (res?.success) {
        setRecords((prev) => prev.filter((r) => r.run_id !== runId));
        if (expandedRunId === runId) setExpandedRunId(null);
      } else {
        alert(res?.error || "删除失败");
      }
    } catch (err) {
      alert("删除异常: " + err.message);
    }
  };

  // 回填参数
  const handleApplyParams = (record, e) => {
    e.stopPropagation();
    if (onApplyParams) {
      onApplyParams(record.params || {}, record);
    }
    setAppliedNotice(`已成功将【${rec_label(record)}】参数回填至回测面板！`);
    setTimeout(() => setAppliedNotice(null), 3000);
  };

  const rec_label = (r) => `${r.etf_code} ${r.etf_name} (${r.backtest_days}天)`;

  // 当前展开记录的流水与分轨
  const activeDetail = expandedRunId ? detailData[expandedRunId] : null;
  const activeTrades = activeDetail?.trades || [];

  const filteredTrades = useMemo(() => {
    if (detailRail === "all") return activeTrades;
    return activeTrades.filter((t) => t.rail === detailRail);
  }, [activeTrades, detailRail]);

  const totalPages = Math.max(1, Math.ceil(filteredTrades.length / pageSize));
  const paginatedTrades = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTrades.slice(start, start + pageSize);
  }, [filteredTrades, currentPage, pageSize]);

  // 导出 CSV
  const handleExportCsv = (record) => {
    if (!filteredTrades.length) return;
    const headers = ["成交时间", "动作", "轨道", "成交价格(元)", "成交股数", "成交金额(元)", "手续费(元)", "扣费净利(元)"];
    const rows = filteredTrades.map((t) => [
      t.trade_time,
      t.action_label || (t.action === "SELL" ? "卖出" : "买入"),
      t.rail_name || t.rail,
      Number(t.price).toFixed(3),
      t.shares,
      t.amount,
      t.fee,
      t.action === "SELL" ? t.profit : "0.00",
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `回测档案_${record.etf_code}_${record.run_id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs space-y-6">
      {/* 头部导航与多维筛选 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100/80 rounded-xl text-indigo-700">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900">本地策略回测档案库</h3>
              <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-mono">
                SQLite 零依赖存储
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              自动沉淀历次全量回测快照，支持无刷新免重算秒级复盘与多轨流水追溯
            </p>
          </div>
        </div>

        {/* 筛选控制器 */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* 标的筛选 */}
          <select
            value={selectedEtf}
            onChange={(e) => setSelectedEtf(e.target.value)}
            className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">全部已测标的</option>
            {distinctEtfs.map((item) => (
              <option key={item.etf_code} value={item.etf_code}>
                {item.etf_code} {item.etf_name}
              </option>
            ))}
          </select>

          {/* 周期筛选 */}
          <select
            value={selectedDays}
            onChange={(e) => setSelectedDays(e.target.value)}
            className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">全部周期</option>
            <option value="90">90 天</option>
            <option value="180">180 天</option>
            <option value="365">1 年</option>
            <option value="730">2 年</option>
            <option value="1095">3 年</option>
            <option value="1825">5 年 (牛熊)</option>
          </select>

          {/* 仅看各周期最新开关 */}
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-700 select-none bg-gray-50 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={latestOnly}
              onChange={(e) => setLatestOnly(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="font-medium">仅看各周期最新</span>
          </label>

          {/* 刷新 */}
          <button
            type="button"
            onClick={loadRecords}
            disabled={loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>
      </div>

      {/* 回填成功提示 */}
      {appliedNotice && (
        <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs border border-emerald-200 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>{appliedNotice}</span>
        </div>
      )}

      {/* 档案列表 */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs border border-red-200">
          {error}
        </div>
      )}

      {loading && records.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
          正在加载回测档案...
        </div>
      ) : records.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-xs bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
          <Database className="w-8 h-8 mx-auto text-gray-300 mb-2" />
          暂无符合条件的回测档案。请在【历史策略回测】标签页运行回测，系统将自动归档。
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((rec) => {
            const isExpanded = expandedRunId === rec.run_id;
            const currentDetail = detailData[rec.run_id];

            return (
              <div
                key={rec.run_id}
                className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs transition-all hover:border-indigo-300"
              >
                {/* 档案摘要行卡片 */}
                <div
                  onClick={() => toggleDetail(rec.run_id)}
                  className="p-4 bg-gray-50/50 hover:bg-gray-50 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-white border border-gray-200 text-indigo-600 font-mono font-bold text-xs">
                      {rec.etf_code}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm">{rec.etf_name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                          {rec.backtest_days} 天 ({rec.actual_days} 交易日)
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-mono">
                          {rec.step_mode === "fixed_eda" ? "🏛️ E大原版" : "🌊 ATR 自适应"}
                        </span>
                        {rec.reinvest_mode === "pool_shares" && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 font-medium">
                            🪙 模式B留股 ({rec.free_shares}股)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1.5 font-mono">
                        <span>测算时间: {formatRecordTime(rec.created_at)}</span>
                        <span>初始本金: ¥{Number(rec.total_capital).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* 核心 KPI 指标 */}
                  <div className="flex items-center gap-6 font-mono text-xs">
                    <div>
                      <div className="text-gray-400 text-[11px]">年化收益率</div>
                      <div className={`font-bold text-sm ${rec.annual_return >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {rec.annual_return >= 0 ? `+${rec.annual_return}%` : `${rec.annual_return}%`}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-[11px]">做 T 纯利润</div>
                      <div className="font-bold text-sm text-red-600">
                        +¥{Number(rec.total_profit).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-[11px]">最大回撤</div>
                      <div className="font-bold text-sm text-emerald-700">
                        -{rec.max_drawdown}%
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-[11px]">成交笔数</div>
                      <div className="font-bold text-sm text-gray-800">
                        {rec.total_trades} 笔
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
                      <button
                        type="button"
                        onClick={(e) => handleApplyParams(rec, e)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                        title="将此档案的资金量与步长配置回填至策略回测面板"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        回填参数
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(rec.run_id, e)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="删除该记录"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 展开的快照详情（净值走势与全量流水） */}
                {isExpanded && (
                  <div className="p-5 border-t border-gray-100 bg-white space-y-4">
                    {detailLoading && !currentDetail ? (
                      <div className="py-8 text-center text-xs text-gray-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-500 mb-1" />
                        正在从本地 SQLite 数据库还原回测快照...
                      </div>
                    ) : (
                      <>
                        {/* 流水筛选控制 */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/80 p-3 rounded-xl border border-gray-100">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-gray-500 font-medium mr-1 flex items-center gap-1">
                              <Filter className="w-3.5 h-3.5" /> 轨道筛选:
                            </span>
                            {[
                              { id: "all", label: `全部 (${activeTrades.length})` },
                              { id: "small", label: `小网 (${activeTrades.filter((t) => t.rail === "small").length})` },
                              { id: "medium", label: `中网 (${activeTrades.filter((t) => t.rail === "medium").length})` },
                              { id: "large", label: `大网 (${activeTrades.filter((t) => t.rail === "large").length})` },
                            ].map((rail) => (
                              <button
                                key={rail.id}
                                type="button"
                                onClick={() => {
                                  setDetailRail(rail.id);
                                  setCurrentPage(1);
                                }}
                                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                                  detailRail === rail.id
                                    ? "bg-white text-indigo-700 font-bold shadow-xs border border-gray-200"
                                    : "text-gray-600 hover:text-gray-900"
                                }`}
                              >
                                {rail.label}
                              </button>
                            ))}
                          </div>

                          <div className="flex items-center gap-2 text-xs">
                            <select
                              value={pageSize}
                              onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                              }}
                              className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-gray-700 text-xs"
                            >
                              <option value={20}>每页 20 笔</option>
                              <option value={50}>每页 50 笔</option>
                              <option value={100}>每页 100 笔</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => handleExportCsv(rec)}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors shadow-2xs"
                            >
                              <Download className="w-3.5 h-3.5 text-gray-600" />
                              导出 CSV
                            </button>
                          </div>
                        </div>

                        {/* 流水表格 */}
                        <div className="overflow-x-auto max-h-72 border border-gray-200 rounded-lg">
                          <table className="w-full text-left text-xs border-collapse font-mono">
                            <thead className="bg-gray-50/90 sticky top-0 border-b border-gray-200 text-gray-500">
                              <tr>
                                <th className="py-2.5 px-4 font-semibold">成交时间</th>
                                <th className="py-2.5 px-4 font-semibold">动作</th>
                                <th className="py-2.5 px-4 font-semibold">轨道</th>
                                <th className="py-2.5 px-4 font-semibold">成交价格</th>
                                <th className="py-2.5 px-4 font-semibold">股数</th>
                                <th className="py-2.5 px-4 font-semibold">成交金额</th>
                                <th className="py-2.5 px-4 font-semibold">手续费</th>
                                <th className="py-2.5 px-4 font-semibold">落袋净利</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {paginatedTrades.length === 0 ? (
                                <tr>
                                  <td colSpan={8} className="py-6 text-center text-gray-400">
                                    暂无成交明细
                                  </td>
                                </tr>
                              ) : (
                                paginatedTrades.map((t, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                    <td className="py-2 px-4 text-gray-500">{t.trade_time}</td>
                                    <td className="py-2 px-4">
                                      <span
                                        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-bold font-sans ${
                                          t.action === "SELL"
                                            ? "bg-red-100 text-red-800"
                                            : "bg-emerald-100 text-emerald-800"
                                        }`}
                                      >
                                        {t.action === "SELL" ? (
                                          <ArrowUpRight className="w-3 h-3" />
                                        ) : (
                                          <ArrowDownRight className="w-3 h-3" />
                                        )}
                                        {t.action_label || (t.action === "SELL" ? "卖出" : "买入")}
                                      </span>
                                    </td>
                                    <td className="py-2 px-4">
                                      <span className="text-gray-700 font-sans font-medium">{t.rail_name || t.rail}</span>
                                    </td>
                                    <td className="py-2 px-4 font-bold text-gray-900">¥{Number(t.price).toFixed(3)}</td>
                                    <td className="py-2 px-4">{t.shares?.toLocaleString()} 股</td>
                                    <td className="py-2 px-4">¥{t.amount?.toLocaleString()}</td>
                                    <td className="py-2 px-4 text-gray-400">¥{t.fee}</td>
                                    <td className="py-2 px-4 font-bold text-red-600 font-sans">
                                      {t.action === "SELL" ? `+¥${t.profit}` : "-"}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* 分页控制栏 */}
                        <div className="flex items-center justify-between text-xs text-gray-500 pt-1 font-mono">
                          <div>
                            显示第 {(currentPage - 1) * pageSize + 1} -{" "}
                            {Math.min(currentPage * pageSize, filteredTrades.length)} 笔，共 {filteredTrades.length} 笔
                          </div>
                          <div className="flex items-center gap-2 font-sans">
                            <button
                              type="button"
                              disabled={currentPage <= 1}
                              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                              className="px-2.5 py-1 rounded border border-gray-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 font-medium"
                            >
                              上一页
                            </button>
                            <span className="font-mono">
                              {currentPage} / {totalPages}
                            </span>
                            <button
                              type="button"
                              disabled={currentPage >= totalPages}
                              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                              className="px-2.5 py-1 rounded border border-gray-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 font-medium"
                            >
                              下一页
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
