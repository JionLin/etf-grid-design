/**
 * ETF 搜索历史本地持久化管理模块 (LRU 队列)
 * 特性：
 * 1. 物理持久化于 localStorage，抗浏览器关闭与电脑重启；
 * 2. 严格代码去重：再次搜索或点选同一标的，将其更新时间戳并移至最前；
 * 3. 严格时间倒序：最新检索的标的永远位于索引 0；
 * 4. 容量上限截断：默认保留最近 10 条，避免下拉列表失控；
 * 5. 支持单条即时移除与一键完全清空。
 */

export const SEARCH_HISTORY_STORAGE_KEY = "etf_search_history";
export const MAX_SEARCH_HISTORY_ITEMS = 10;

/**
 * 获取当前所有搜索历史记录 (按时间倒序)
 * @returns {Array<{code: string, name: string, sector: string, timestamp: number}>}
 */
export function getSearchHistory() {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // 格式防守并按时间倒序排序
    return parsed
      .filter((item) => item && typeof item.code === "string" && item.code.trim())
      .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
  } catch (err) {
    console.warn("读取搜索历史失败:", err);
    return [];
  }
}

/**
 * 记录一次标的搜索/点选 (自动去重、置顶并截断至上限)
 * @param {{code: string, name?: string, sector?: string}} item
 * @returns {Array} 更新后的历史列表
 */
export function saveSearchHistoryItem(item) {
  if (!item || !item.code || typeof window === "undefined" || !window.localStorage) {
    return getSearchHistory();
  }

  const cleanCode = String(item.code).trim();
  if (!cleanCode) return getSearchHistory();

  try {
    const current = getSearchHistory();
    // 1. 去重：过滤掉旧的相同代码项
    const remaining = current.filter((existing) => existing.code !== cleanCode);

    // 2. 构造最新项 (置于头部)
    const newItem = {
      code: cleanCode,
      name: item.name ? String(item.name).trim() : cleanCode,
      sector: item.sector ? String(item.sector).trim() : "",
      timestamp: Date.now(),
    };

    // 3. 截断至最多 10 条
    const updated = [newItem, ...remaining].slice(0, MAX_SEARCH_HISTORY_ITEMS);

    window.localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn("保存搜索历史失败:", err);
    return getSearchHistory();
  }
}

/**
 * 删除单条搜索历史
 * @param {string} code 
 * @returns {Array} 更新后的历史列表
 */
export function removeSearchHistoryItem(code) {
  if (!code || typeof window === "undefined" || !window.localStorage) {
    return getSearchHistory();
  }
  const cleanCode = String(code).trim();
  try {
    const current = getSearchHistory();
    const updated = current.filter((item) => item.code !== cleanCode);
    window.localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn("删除单条搜索历史失败:", err);
    return getSearchHistory();
  }
}

/**
 * 清空所有搜索历史
 */
export function clearSearchHistory() {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(SEARCH_HISTORY_STORAGE_KEY);
  } catch (err) {
    console.warn("清空搜索历史失败:", err);
  }
}
