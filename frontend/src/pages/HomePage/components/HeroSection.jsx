import React from "react";
import { Sparkles, ShieldCheck, Layers } from "lucide-react";

/**
 * 首页紧凑型横幅组件 (Compact Banner)
 * @description 突出产品定位与量化哲学，释放首屏黄金空间给选品决策雷达
 */
export default function HeroSection({ onStartAnalysis }) {
  return (
    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:px-6 sm:py-3.5 shadow-md border border-indigo-900/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shrink-0 shadow-inner">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1.5">
              <span>ETF Grid Pro · 交易决策沙盘</span>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                桌面工作台
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            解构震荡，收割波动 —— 深度承袭 <strong className="text-amber-300 font-semibold">E大（ETF拯救世界）</strong> 网格 2.0 / 3.0 哲学体系，专为 A 股量身打造的真实撮合回测
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-start md:self-auto shrink-0 text-xs">
        <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-400 mr-2">
          <span className="flex items-center gap-1 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            T+1 隔夜解冻
          </span>
          <span className="flex items-center gap-1 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            模式B 留免费股票池
          </span>
        </div>
        {onStartAnalysis && (
          <button
            type="button"
            onClick={onStartAnalysis}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-xs transition-colors shadow-xs"
          >
            底部完整参数 ▼
          </button>
        )}
      </div>
    </div>
  );
}
