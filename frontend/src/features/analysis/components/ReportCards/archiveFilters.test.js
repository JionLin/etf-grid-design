import assert from "node:assert/strict";
import test from "node:test";
import { PRIMARY_SECTORS } from "../../../../pages/HomePage/components/radarDisplay.js";
import {
  ARCHIVE_SECTORS,
  ARCHIVE_STEP_FILTERS,
  archiveStepLabel,
  buildArchiveListParams,
} from "./archiveFilters.js";

test("archive capsules match homepage sectors and add 未入池", () => {
  assert.deepEqual(ARCHIVE_SECTORS.slice(0, PRIMARY_SECTORS.length), PRIMARY_SECTORS);
  assert.equal(ARCHIVE_SECTORS.includes("其他主题"), false);
  assert.equal(ARCHIVE_SECTORS.at(-1), "未入池");
});

test("step filters pass atr and fixed_eda to the records endpoint params", () => {
  const atr = buildArchiveListParams({ sector: "周期资源", stepMode: "atr" });
  const eda = buildArchiveListParams({ sector: "周期资源", stepMode: "fixed_eda" });
  assert.equal(atr.sector, "周期资源");
  assert.equal(atr.stepMode, "atr");
  assert.equal(eda.stepMode, "fixed_eda");
  assert.equal(ARCHIVE_STEP_FILTERS.some((item) => item.id === "atr"), true);
  assert.equal(ARCHIVE_STEP_FILTERS.some((item) => item.id === "fixed_eda"), true);
  assert.equal("gridFit" in atr, false);
});

test("unknown step mode is not labeled as ATR", () => {
  assert.equal(archiveStepLabel({ step_mode: "composite" }), "未知");
  assert.equal(archiveStepLabel({ step_mode: "atr", step_label: "ATR 自适应" }), "ATR 自适应");
});
