import assert from "node:assert/strict";
import test from "node:test";
import {
  CARD_RENDER_LIMIT,
  PRIMARY_SECTORS,
  SUB_SECTORS_MAP,
  buildTruncationLabel,
  matchesSubSector,
} from "./radarDisplay.js";

test("primary capsules do not include 其他主题", () => {
  assert.equal(PRIMARY_SECTORS.includes("其他主题"), false);
  assert.equal(PRIMARY_SECTORS.includes("未归类"), false);
  assert.equal(PRIMARY_SECTORS.filter((name) => name !== "全部").length, 11);
});

test("truncation label uses hit total instead of rendered count", () => {
  assert.equal(buildTruncationLabel(537, CARD_RENDER_LIMIT), "展示前 48 / 共 537");
  assert.equal(buildTruncationLabel(12, 12), "");
});

test("nasdaq and gold aliases hit the expected subsectors", () => {
  const nasdaq = SUB_SECTORS_MAP["跨境全球"].find((item) => item.name === "美股纳指标普");
  const gold = SUB_SECTORS_MAP["大宗商品"].find((item) => item.name === "黄金贵金属");
  assert.equal(matchesSubSector("纳指ETF广发", nasdaq.kws), true);
  assert.equal(matchesSubSector("金ETF富国", gold.kws), true);
  assert.equal(matchesSubSector("上海金ETF中银", gold.kws), true);
});
