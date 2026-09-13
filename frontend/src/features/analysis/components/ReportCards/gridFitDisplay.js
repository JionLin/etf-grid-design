import { PRIMARY_SECTORS } from "../../../../pages/HomePage/components/radarDisplay.js";

export const GRID_FIT_BOARD_PATH = "/grid-fit/board";
export const GRID_FIT_PAGE_PATH = "/grid-fit";
export const CASH_YIELD_LABEL = "年化做 T 现金收益率";
export const ANNUAL_RETURN_LABEL = "年化总收益（含底仓涨跌）";
export const GRID_FIT_SECTORS = PRIMARY_SECTORS;

export function buildGridFitQuery(sector) {
  if (!sector || sector === "全部") return {};
  return { sector };
}

export function formatCashYield(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return null;
  }
  const percent = Number(value) * 100;
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toFixed(2)}%`;
}

export function sortByAtrCashYield(rows) {
  return rows.slice().sort((left, right) => {
    const leftRanked = left?.atr?.status === "ranked" && left.atr.cash_yield !== null;
    const rightRanked = right?.atr?.status === "ranked" && right.atr.cash_yield !== null;
    if (leftRanked !== rightRanked) return leftRanked ? -1 : 1;
    if (!leftRanked) return 0;
    return Number(right.atr.cash_yield) - Number(left.atr.cash_yield);
  });
}

export function ranksForSector(rows, sector, stepMode = "atr") {
  return rows
    .filter((row) => row.sector === sector && row[stepMode]?.status === "ranked")
    .map((row) => ({ code: row.etf_code, rank: row[stepMode].rank }))
    .sort((left, right) => left.rank - right.rank);
}
