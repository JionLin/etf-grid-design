import {
  STRATEGY_DRAFT_STORAGE_KEY,
  LEGACY_KEYS,
  SYSTEM_PRESETS,
  loadDraftSnapshot,
  saveDraftSnapshot,
  saveCustomPreset,
  deleteCustomPreset,
  resetToSystemDefault,
} from "../strategyDraftStorage.js";

// Mock localStorage
const mockStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] !== undefined ? store[key] : null,
    setItem: (key, val) => {
      store[key] = String(val);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

global.window = {
  localStorage: mockStorage,
};

function runTests() {
  console.log("▶ 开始测试 strategyDraftStorage 模块...");
  mockStorage.clear();

  // 1. 空状态默认加载测试
  let draft = loadDraftSnapshot();
  if (!draft || draft.version !== 1 || draft.current.etfCode !== "510300") {
    throw new Error("期望初次加载返回默认 v1 快照");
  }
  console.log("  ✓ 初始快照加载正常");

  // 2. 旧散落键平滑迁移测试
  mockStorage.clear();
  mockStorage.setItem("etfCode", JSON.stringify("512480"));
  mockStorage.setItem("totalCapital", JSON.stringify("80000"));
  mockStorage.setItem("stepMode", JSON.stringify("fixed_eda"));

  draft = loadDraftSnapshot();
  if (draft.current.etfCode !== "512480" || draft.current.totalCapital !== "80000") {
    throw new Error("期望平滑迁移旧散落键数据");
  }
  // 检查旧键是否已清理
  for (const k of LEGACY_KEYS) {
    if (mockStorage.getItem(k) !== null) {
      throw new Error(`期望旧键 ${k} 被清理`);
    }
  }
  console.log("  ✓ 旧散落键平滑迁移与清理正常");

  // 3. 保存更新草稿测试
  saveDraftSnapshot({ totalCapital: "150000", reinvestMode: "cash" }, "custom");
  draft = loadDraftSnapshot();
  if (draft.current.totalCapital !== "150000" || draft.current.reinvestMode !== "cash") {
    throw new Error("期望更新保存后的参数正常生效");
  }
  console.log("  ✓ 草稿原子保存正常");

  // 4. 自定义预设与删除测试
  saveCustomPreset("半导体激进版", { ...draft.current, totalCapital: "200000" });
  draft = loadDraftSnapshot();
  if (draft.customPresets.length !== 1 || draft.customPresets[0].name !== "半导体激进版") {
    throw new Error("期望自定义预设成功沉淀");
  }
  const presetId = draft.customPresets[0].id;
  deleteCustomPreset(presetId);
  draft = loadDraftSnapshot();
  if (draft.customPresets.length !== 0) {
    throw new Error("期望自定义预设被成功删除");
  }
  console.log("  ✓ 自定义预设添加与删除正常");

  // 5. 恢复出厂设置测试
  resetToSystemDefault();
  draft = loadDraftSnapshot();
  if (draft.current.totalCapital !== "30000" || draft.current.reinvestMode !== "pool_shares") {
    throw new Error("期望恢复为官方出厂标准默认配置");
  }
  console.log("  ✓ 一键恢复出厂默认配置正常");

  console.log("🎉 strategyDraftStorage 全部测试通过！");
}

runTests();
