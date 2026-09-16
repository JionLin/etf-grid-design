import React, { useState } from "react";
import { Sparkles, RotateCcw, BookmarkPlus, X, Check } from "lucide-react";
import { SYSTEM_PRESETS } from "@shared/utils/strategyDraftStorage";

/**
 * 策略预设胶囊栏组件
 */
export default function StrategyPresetBar({
  activePresetId = "eda_classic",
  customPresets = [],
  onSelectPreset,
  onSaveCustomPreset,
  onDeleteCustomPreset,
  onResetDefault,
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  const handleConfirmSave = (e) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    if (onSaveCustomPreset) {
      onSaveCustomPreset(newPresetName.trim());
    }
    setNewPresetName("");
    setIsSaving(false);
  };

  return (
    <div className="p-3 bg-slate-50 dark:bg-gray-750/70 border border-slate-200/80 dark:border-gray-700 rounded-xl space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>常用策略方案预设:</span>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
          {!isSaving ? (
            <button
              type="button"
              onClick={() => setIsSaving(true)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-md transition-colors cursor-pointer"
              title="将当前参数另存为新的自定义预设"
            >
              <BookmarkPlus className="w-3 h-3" />
              <span>另存为预设</span>
            </button>
          ) : (
            <form onSubmit={handleConfirmSave} className="flex items-center gap-1 animate-in fade-in duration-150">
              <input
                type="text"
                placeholder="输入预设名称..."
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                autoFocus
                className="px-2 py-0.5 text-xs bg-white dark:bg-gray-700 border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-gray-100 w-28"
              />
              <button
                type="submit"
                className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                title="确认保存"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSaving(false);
                  setNewPresetName("");
                }}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
                title="取消"
              >
                <X className="w-3 h-3" />
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={() => {
              if (window.confirm("确定要将所有策略参数恢复为官方默认设置吗？")) {
                if (onResetDefault) onResetDefault();
              }
            }}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50/50 dark:hover:bg-gray-700 rounded-md transition-colors cursor-pointer"
            title="一键重置为官方推荐出厂参数"
          >
            <RotateCcw className="w-3 h-3" />
            <span>恢复默认</span>
          </button>
        </div>
      </div>

      {/* 预设胶囊列表 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {SYSTEM_PRESETS.map((preset) => {
          const isActive = activePresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset && onSelectPreset(preset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border ${
                isActive
                  ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-blue-500/80 shadow-xs font-bold"
                  : "bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-white"
              }`}
              title={preset.description}
            >
              <span>{preset.name}</span>
              {preset.badge && (
                <span
                  className={`text-[10px] px-1 py-0.2 rounded font-normal ${
                    isActive
                      ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {preset.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* 自定义预设 */}
        {customPresets.map((custom) => {
          const isActive = activePresetId === custom.id;
          return (
            <div
              key={custom.id}
              className={`inline-flex items-center rounded-lg text-xs font-semibold border transition-all ${
                isActive
                  ? "bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 border-purple-500 shadow-xs"
                  : "bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectPreset && onSelectPreset(custom)}
                className="px-2.5 py-1.5 flex items-center gap-1 cursor-pointer"
                title={`自定义方案: ${custom.name}`}
              >
                <span>⭐ {custom.name}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteCustomPreset) onDeleteCustomPreset(custom.id);
                }}
                className="pr-1.5 pl-0.5 text-gray-300 hover:text-rose-500 transition-colors"
                title="删除此预设"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
