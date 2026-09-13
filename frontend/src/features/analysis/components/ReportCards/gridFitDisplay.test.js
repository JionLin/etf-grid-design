import assert from "node:assert/strict";
import test from "node:test";
import {
  ANNUAL_RETURN_LABEL,
  CASH_YIELD_LABEL,
  GRID_FIT_BOARD_PATH,
  GRID_FIT_SECTORS,
  buildGridFitQuery,
  formatCashYield,
  ranksForSector,
  sortByAtrCashYield,
} from "./gridFitDisplay.js";

test("board query is not the personal archive endpoint", () => {
  assert.equal(GRID_FIT_BOARD_PATH, "/grid-fit/board");
  assert.equal(GRID_FIT_BOARD_PATH.includes("records"), false);
  assert.equal(GRID_FIT_SECTORS.includes("其他主题"), false);
  assert.equal(GRID_FIT_SECTORS.filter((name) => name !== "全部").length, 11);
});

test("cash yield stays negative and annual return is labeled as including base position", () => {
  assert.equal(formatCashYield(-0.01), "-1.00%");
  assert.equal(formatCashYield(null), null);
  assert.equal(ANNUAL_RETURN_LABEL.includes("含底仓涨跌"), true);
  assert.equal(CASH_YIELD_LABEL, "年化做 T 现金收益率");
});

test("default sort uses ATR cash yield, and rank changes with sector", () => {
  const rows = [
    {
      etf_code: "512760",
      sector: "科技芯片",
      atr: { status: "ranked", cash_yield: 0.02, annual_return: 30, rank: 2 },
    },
    {
      etf_code: "512480",
      sector: "科技芯片",
      atr: { status: "ranked", cash_yield: 0.05, annual_return: 1, rank: 1 },
    },
    {
      etf_code: "515220",
      sector: "周期资源",
      atr: { status: "ranked", cash_yield: 0.2, annual_return: 40, rank: 1 },
    },
  ];
  const ordered = sortByAtrCashYield(rows);
  assert.equal(ordered[0].etf_code, "515220");
  assert.deepEqual(ranksForSector(rows, "科技芯片"), [
    { code: "512480", rank: 1 },
    { code: "512760", rank: 2 },
  ]);
  assert.deepEqual(ranksForSector(rows, "周期资源"), [{ code: "515220", rank: 1 }]);
  assert.notDeepEqual(ranksForSector(rows, "科技芯片"), ranksForSector(rows, "周期资源"));
  assert.deepEqual(buildGridFitQuery("科技芯片"), { sector: "科技芯片" });
  assert.deepEqual(buildGridFitQuery("全部"), {});
});
