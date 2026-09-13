import React from "react";
import { TrendingUp } from "lucide-react";
import ETFInfoSkeleton from "./ETFInfoSkeleton";

/**
 * 手动 ETF 代码输入。发现标的由首页活跃池雷达承担。
 */
export default function ETFSelector({
  value,
  onChange,
  error,
  etfInfo,
  loading,
  inputRef,
}) {
  return (
    <div className="space-y-4">
      <div className="pt-1">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
          <span>手动精确输入 ETF 代码：</span>
          {value && (
            <span className="text-blue-600 font-medium">当前已选：{value}</span>
          )}
        </div>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) =>
              onChange(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="从上方雷达点选，或在此输入6位代码，如：515220"
            className={`w-full px-4 py-2.5 text-sm bg-white border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              error ? "border-red-300" : "border-gray-300"
            }`}
            maxLength={6}
          />
        </div>

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
