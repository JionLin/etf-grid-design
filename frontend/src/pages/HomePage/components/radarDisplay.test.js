import assert from "node:assert/strict";
import test from "node:test";
import {
  CARD_RENDER_LIMIT,
  DEFAULT_COLLAPSE_LIMIT,
  PRIMARY_SECTORS,
  buildTruncationLabel,
  filterByStoredSubsector,
  subsectorsForSector,
  aggregateSectorCounts,
} from "./radarDisplay.js";

test("default collapse limit is 6 items", () => {
  assert.equal(DEFAULT_COLLAPSE_LIMIT, 6);
});

test("primary capsules do not include 其他主题", () => {
  assert.equal(PRIMARY_SECTORS.includes("其他主题"), false);
  assert.equal(PRIMARY_SECTORS.includes("未归类"), false);
  assert.equal(PRIMARY_SECTORS.filter((name) => name !== "全部").length, 11);
});

test("truncation label uses hit total instead of rendered count", () => {
  assert.equal(buildTruncationLabel(537, CARD_RENDER_LIMIT), "展示前 48 / 共 537");
  assert.equal(buildTruncationLabel(12, 12), "");
});

test("drill-down uses stored subsector and does not treat 科创50 as mega-cap", () => {
  const items = [
    { name: "科创50ETF华夏", subsector: "双创成长" },
    { name: "沪深300ETF", subsector: "超大盘(300/50)" },
  ];
  const growth = filterByStoredSubsector(items, "双创成长");
  const mega = filterByStoredSubsector(items, "超大盘(300/50)");
  assert.deepEqual(growth.map((item) => item.name), ["科创50ETF华夏"]);
  assert.deepEqual(mega.map((item) => item.name), ["沪深300ETF"]);
});

test("subsector counts come from the catalog, including zeros", () => {
  const summary = [
    { sector: "医药健康", name: "中药", count: 1 },
    { sector: "医药健康", name: "生物疫苗", count: 0 },
    { sector: "核心宽基", name: "双创成长", count: 4 },
  ];
  assert.deepEqual(
    subsectorsForSector(summary, "医药健康").map((item) => item.count),
    [1, 0]
  );
});

test("aggregateSectorCounts dynamically computes counts matching mature pool", () => {
  const items = [
    { name: "煤炭ETF", sector: "周期资源" },
    { name: "有色金属ETF", sector: "周期资源" },
    { name: "半导体ETF", sector: "科技芯片" },
  ];
  const map = aggregateSectorCounts(items);
  assert.equal(map["周期资源"], 2);
  assert.equal(map["科技芯片"], 1);
  assert.equal(map["医药健康"], undefined);
  assert.equal(Object.values(map).reduce((a, b) => a + b, 0), items.length);
});

