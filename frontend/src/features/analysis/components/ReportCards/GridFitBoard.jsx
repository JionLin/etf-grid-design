import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { getGridFitBoard, refreshGridFit } from "@shared/services/api";
import {
  ANNUAL_RETURN_LABEL,
  CASH_YIELD_LABEL,
  GRID_FIT_SECTORS,
  buildGridFitQuery,
  formatCashYield,
  sortByAtrCashYield,
} from "./gridFitDisplay";

function formatPercentPoint(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const number = Number(value);
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function ProtocolCell({ cell }) {
  if (!cell) return <span className="text-gray-400">未计算</span>;
  if (cell.status !== "ranked") {
    return <span className="text-amber-700">{cell.status_reason || "未入榜"}</span>;
  }
  return (
    <div>
      <div className="text-[11px] text-gray-400">第 {cell.rank} 名</div>
      <div className={Number(cell.cash_yield) < 0 ? "text-emerald-700" : "text-red-600"}>
        {formatCashYield(cell.cash_yield)}
      </div>
    </div>
  );
}

function ReasonList({ title, items }) {
  if (!items?.length) return null;
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
      <ul className="space-y-1 text-xs text-gray-600">
        {items.map((item) => {
          const reason = item.atr?.status_reason || item.fixed_eda?.status_reason || "未入榜";
          return (
            <li key={`${title}-${item.etf_code}`}>
              {item.etf_code} {item.etf_name} · {reason}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function GridFitBoard() {
  const [sector, setSector] = useState("全部");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadBoard = async (nextSector = sector) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getGridFitBoard(buildGridFitQuery(nextSector));
      if (!res?.success) {
        setError(res?.error || "读取适合度榜失败");
        return;
      }
      setPayload(res.data || null);
    } catch (err) {
      setError(err?.message || "读取适合度榜失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoard(sector);
  }, [sector]);

  useEffect(() => {
    if (payload?.job?.status !== "running") return undefined;
    const timer = setInterval(() => loadBoard(sector), 5000);
    return () => clearInterval(timer);
  }, [payload?.job?.status, sector]);

  const handleRefresh = async () => {
    setError(null);
    try {
      const res = await refreshGridFit();
      if (!res?.success) {
        setError(res?.error || "启动补齐失败");
        return;
      }
      await loadBoard(sector);
    } catch (err) {
      setError(err?.message || "启动补齐失败");
    }
  };

  const progress = payload?.progress || {};
  const board = sortByAtrCashYield(payload?.board || []);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs space-y-6">
      <div className="flex flex-col gap-3 border-b border-gray-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">网格适合度榜</h2>
          <p className="mt-1 text-xs text-gray-500">
            锁定协议比较 11 个可购赛道。主排序是 {CASH_YIELD_LABEL}，协议结果不进入个人回测档案。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/" className="text-xs text-gray-500 underline">
            返回选品雷达
          </Link>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            补齐并重算
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {GRID_FIT_SECTORS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setSector(name)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              sector === name
                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                : "border-gray-200 bg-white text-gray-600"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <span>已入榜 {progress.ranked || 0}</span>
        <span>短样本 {progress.short_sample || 0}</span>
        <span>未就绪 {progress.not_ready || 0}</span>
        <span>失败 {progress.failed || 0}</span>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-gray-400">
            <tr>
              <th className="py-2 pr-3">标的</th>
              <th className="py-2 pr-3">ATR {CASH_YIELD_LABEL}</th>
              <th className="py-2 pr-3">自定义网格 {CASH_YIELD_LABEL}</th>
              <th className="py-2">{ANNUAL_RETURN_LABEL}</th>
            </tr>
          </thead>
          <tbody>
            {board.map((row) => (
              <tr key={row.etf_code} className="border-t border-gray-100">
                <td className="py-3 pr-3">
                  <div className="font-mono font-semibold text-gray-900">{row.etf_code}</div>
                  <div className="text-gray-500">{row.etf_name} · {row.sector}</div>
                </td>
                <td className="py-3 pr-3"><ProtocolCell cell={row.atr} /></td>
                <td className="py-3 pr-3"><ProtocolCell cell={row.fixed_eda} /></td>
                <td className="py-3 font-mono">{formatPercentPoint(row.atr?.annual_return ?? row.fixed_eda?.annual_return)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && board.length === 0 && (
          <p className="py-8 text-center text-xs text-gray-400">当前赛道还没有入榜标的。可先补齐行情后再看名次。</p>
        )}
      </div>

      <ReasonList title="短样本区（不进五年主榜）" items={payload?.short_sample} />
      <ReasonList title="未就绪" items={payload?.not_ready} />
      <ReasonList title="失败" items={payload?.failed} />
      <ReasonList title="成交过稀或回撤超线" items={payload?.blocked} />
    </div>
  );
}
