import React from "react";
import { Clock, Trash2, X } from "lucide-react";

/**
 * 搜索历史下拉卡片组件
 */
export default function SearchHistoryDropdown({
  history = [],
  isOpen = false,
  onSelect,
  onRemove,
  onClear,
}) {
  if (!isOpen || history.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute right-0 top-full mt-1.5 w-80 max-w-[90vw] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl z-50 overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-100"
      onMouseDown={(e) => {
        // 防止点击内部时触发 input 的 onBlur
        e.preventDefault();
      }}
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 dark:bg-gray-750 border-b border-gray-100 dark:border-gray-700">
        <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-blue-500" />
          <span>最近检索的标的 ({history.length})</span>
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-slate-400 hover:text-rose-500 flex items-center gap-1 font-medium transition-colors"
          title="清空所有历史"
        >
          <Trash2 className="w-3 h-3" />
          <span>清空</span>
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/60">
        {history.map((item) => (
          <div
            key={item.code}
            onClick={() => onSelect && onSelect(item)}
            className="flex items-center justify-between px-3.5 py-2 hover:bg-blue-50/70 dark:hover:bg-gray-700 cursor-pointer group transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <span className="font-mono font-bold text-gray-900 dark:text-gray-100 text-sm">
                {item.code}
              </span>
              <span className="text-gray-700 dark:text-gray-300 truncate font-medium">
                {item.name}
              </span>
              {item.sector && (
                <span className="text-[10px] px-1.5 py-0.2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded shrink-0">
                  {item.sector}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove && onRemove(item.code);
              }}
              className="p-1 rounded-md text-gray-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 transition-all shrink-0"
              title="删除此条记录"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
