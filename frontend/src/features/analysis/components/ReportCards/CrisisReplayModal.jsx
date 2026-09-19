import React, { useEffect } from "react";
import PropTypes from "prop-types";
import {
  X,
  ShieldAlert,
  Calendar,
  ArrowDownRight,
  TrendingUp,
  Coins,
  ShieldCheck,
  Clock,
  Sparkles,
} from "lucide-react";

export default function CrisisReplayModal({ isOpen, onClose, crisisData, etfCode, etfName }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !crisisData) return null;

  const {
    rank = 1,
    max_dd_pct = 0,
    peak_date = "",
    start_date = "",
    trough_date = "",
    recovered_date = null,
    is_recovered = false,
    underwater_days = 0,
    fall_days = 0,
    recovery_days = 0,
    buy_count = 0,
    buy_amount = 0,
    t_profit = 0,
  } = crisisData;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-2xl p-6 sm:p-8 space-y-6 text-gray-800 dark:text-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          aria-label="关闭弹窗"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 头部 */}
        <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
          <div className="p-3 bg-rose-100 dark:bg-rose-950/60 rounded-xl text-rose-600 dark:text-rose-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span>历史重大回撤危机复盘诊断</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                严重程度 TOP {rank}
              </span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              标的：{etfCode} {etfName} · 穿透量化网格在极端逆境中的自愈对冲全过程
            </p>
          </div>
        </div>

        {/* 核心指标统计横幅 */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200/70 dark:border-gray-700/60">
          <div className="space-y-1">
            <span className="text-[11px] text-gray-500 flex items-center gap-1">
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
              <span>本轮最大浮亏</span>
            </span>
            <div className="text-xl font-black font-mono text-rose-600 dark:text-rose-400">
              -{Math.abs(max_dd_pct)}%
            </div>
            <span className="text-[10px] text-gray-400">相对前高见顶日</span>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] text-gray-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              <span>水下总滞留</span>
            </span>
            <div className="text-xl font-black font-mono text-indigo-600 dark:text-indigo-400">
              {underwater_days} 天
            </div>
            <span className="text-[10px] text-gray-400">
              {is_recovered ? "已彻底填平出水" : "截至最新仍在爬坑"}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] text-gray-500 flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              <span>逆势做T落袋现金</span>
            </span>
            <div className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">
              +¥{t_profit.toLocaleString()}
            </div>
            <span className="text-[10px] text-gray-400">弱势震荡差价收益</span>
          </div>
        </div>

        {/* 周期时间轴展开 */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-500" />
            <span>危机演变时间轴 (Timeline)</span>
          </h4>
          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700 text-xs">
            {/* 顶峰日 */}
            <div className="relative">
              <div className="absolute -left-[19px] top-0.5 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-white dark:ring-gray-900" />
              <div className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span>见顶高位日：{peak_date}</span>
                <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  历史高水位线
                </span>
              </div>
              <p className="text-gray-500 mt-0.5">策略资产达到当时峰值，随后受大盘下挫影响跌破高点开启回撤。</p>
            </div>

            {/* 谷底日 */}
            <div className="relative">
              <div className="absolute -left-[19px] top-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-white dark:ring-gray-900" />
              <div className="font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <span>浮亏极值日：{trough_date}</span>
                <span className="text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                  阴跌历时 {fall_days} 天
                </span>
              </div>
              <p className="text-gray-500 mt-0.5">
                触及该轮最深谷底（-{Math.abs(max_dd_pct)}%），网格倒金字塔在深水区连续吸筹，均价拉低。
              </p>
            </div>

            {/* 出水解套日 */}
            <div className="relative">
              <div className={`absolute -left-[19px] top-0.5 w-2.5 h-2.5 rounded-full ${is_recovered ? "bg-emerald-500" : "bg-amber-400"} ring-4 ring-white dark:ring-gray-900`} />
              <div className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span>
                  {is_recovered ? `彻底解套日：${recovered_date}` : `最新进展：仍在做T修复中`}
                </span>
                <span className={`text-[10px] ${is_recovered ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"} px-1.5 py-0.5 rounded`}>
                  {is_recovered ? `爬坑耗时 ${recovery_days} 天` : `已修复部分回撤`}
                </span>
              </div>
              <p className="text-gray-500 mt-0.5">
                {is_recovered
                  ? "总资产重回前高上方并刷新纪录。依靠网格频繁做 T 降本，比死扛少熬数月。"
                  : "当前策略正持续利用震荡做 T 差价反哺摊平成本，静待新高。"}
              </p>
            </div>
          </div>
        </div>

        {/* 网格对冲贡献与自愈复盘 */}
        <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/40 space-y-2 text-xs">
          <div className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>网格交易机制在本次危机中的自愈对冲分析</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-gray-700 dark:text-gray-300">
            <div>
              <span className="text-gray-400 block">低吸补仓笔数:</span>
              <span className="font-bold font-mono text-gray-900 dark:text-gray-100">{buy_count} 笔</span>
            </div>
            <div>
              <span className="text-gray-400 block">深水动用本金:</span>
              <span className="font-bold font-mono text-gray-900 dark:text-gray-100">¥{buy_amount.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-400 block">做T现金流利润:</span>
              <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">+¥{t_profit.toLocaleString()}</span>
            </div>
          </div>
          <div className="pt-2 text-indigo-800 dark:text-indigo-300 border-t border-indigo-100/60 dark:border-indigo-900/40 flex items-start gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
            <span>
              <strong>复盘结论：</strong>在下跌与随后的筑底震荡阶段，网格累计触发了 {buy_count} 次低吸加码，并斩获 ¥{t_profit.toLocaleString()} 做 T 净现金流，大幅拉低持仓均成本线，使得账户在标的价格尚未完全收复失地时便已提前填平亏损、实现彻底出水。
            </span>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}

CrisisReplayModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  crisisData: PropTypes.shape({
    rank: PropTypes.number,
    max_dd_pct: PropTypes.number,
    peak_date: PropTypes.string,
    start_date: PropTypes.string,
    trough_date: PropTypes.string,
    recovered_date: PropTypes.string,
    is_recovered: PropTypes.bool,
    underwater_days: PropTypes.number,
    fall_days: PropTypes.number,
    recovery_days: PropTypes.number,
    buy_count: PropTypes.number,
    buy_amount: PropTypes.number,
    t_profit: PropTypes.number,
  }),
  etfCode: PropTypes.string,
  etfName: PropTypes.string,
};
