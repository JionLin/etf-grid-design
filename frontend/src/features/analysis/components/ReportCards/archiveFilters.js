import { PRIMARY_SECTORS } from "../../../../pages/HomePage/components/radarDisplay.js";

export const ARCHIVE_SECTORS = [...PRIMARY_SECTORS, "未入池"];

export const ARCHIVE_STEP_FILTERS = [
  { id: "", label: "全部步长" },
  { id: "atr", label: "ATR 自适应" },
  { id: "fixed_eda", label: "自定义网格" },
];

export function buildArchiveListParams({
  etfCode = "",
  days = "",
  latestOnly = true,
  sector = "全部",
  stepMode = "",
} = {}) {
  const params = { latestOnly: latestOnly ? "true" : "false" };
  if (etfCode) params.etfCode = etfCode;
  if (days) params.days = days;
  if (sector && sector !== "全部") params.sector = sector;
  if (stepMode === "atr" || stepMode === "fixed_eda") params.stepMode = stepMode;
  return params;
}

export function archiveStepLabel(record) {
  if (record?.step_label) return record.step_label;
  if (record?.step_mode === "atr") return "ATR 自适应";
  if (record?.step_mode === "fixed_eda") return "自定义网格";
  return "未知";
}
