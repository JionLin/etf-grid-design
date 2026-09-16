import {
  SEARCH_HISTORY_STORAGE_KEY,
  MAX_SEARCH_HISTORY_ITEMS,
  getSearchHistory,
  saveSearchHistoryItem,
  removeSearchHistoryItem,
  clearSearchHistory,
} from "../searchHistoryStorage.js";

// 内存 Mock localStorage
const mockStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
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
  console.log("▶ 开始测试 searchHistoryStorage 模块...");
  clearSearchHistory();

  // 1. 空状态测试
  let list = getSearchHistory();
  if (list.length !== 0) throw new Error("期望初始为空");
  console.log("  ✓ 空状态正常");

  // 2. 插入测试与时间倒序
  saveSearchHistoryItem({ code: "510300", name: "300ETF", sector: "核心宽基" });
  saveSearchHistoryItem({ code: "159915", name: "创业板ETF", sector: "核心宽基" });
  list = getSearchHistory();
  if (list.length !== 2 || list[0].code !== "159915" || list[1].code !== "510300") {
    throw new Error("期望最新插入项在头部 (159915)");
  }
  console.log("  ✓ 插入并置顶头部正常");

  // 3. 去重与再次置顶测试
  saveSearchHistoryItem({ code: "510300", name: "沪深300ETF改名", sector: "宽基" });
  list = getSearchHistory();
  if (list.length !== 2 || list[0].code !== "510300" || list[1].code !== "159915") {
    throw new Error("期望 510300 去重后重新成为头部");
  }
  console.log("  ✓ 去重并重新置顶正常");

  // 4. 单条删除测试
  removeSearchHistoryItem("159915");
  list = getSearchHistory();
  if (list.length !== 1 || list[0].code !== "510300") {
    throw new Error("期望 159915 被删除，仅剩 510300");
  }
  console.log("  ✓ 单条删除正常");

  // 5. 容量上限测试 (10条截断)
  clearSearchHistory();
  for (let i = 1; i <= 15; i++) {
    saveSearchHistoryItem({ code: `51000${i}`, name: `ETF-${i}` });
  }
  list = getSearchHistory();
  if (list.length !== MAX_SEARCH_HISTORY_ITEMS || list[0].code !== "5100015") {
    throw new Error(`期望截断为 10 条，实际为 ${list.length}`);
  }
  console.log("  ✓ 上限 10 条截断正常");

  // 6. 清空测试
  clearSearchHistory();
  if (getSearchHistory().length !== 0) throw new Error("期望清空后为空");
  console.log("  ✓ 一键清空正常");

  console.log("🎉 searchHistoryStorage 全部测试通过！");
}

runTests();
