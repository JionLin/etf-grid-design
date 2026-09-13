export const CARD_RENDER_LIMIT = 48;

export const PRIMARY_SECTORS = [
  "全部",
  "科技芯片",
  "新能源制造",
  "医药健康",
  "大金融",
  "大消费",
  "周期资源",
  "公用红利",
  "国防军工",
  "跨境全球",
  "大宗商品",
  "核心宽基",
];

export function filterByStoredSubsector(items, subsectorName) {
  if (!subsectorName || subsectorName === "全部") {
    return items;
  }
  return items.filter((item) => item.subsector === subsectorName);
}

export function subsectorsForSector(summary, sector) {
  return (summary || []).filter((row) => row.sector === sector);
}

export function buildTruncationLabel(hitCount, renderedCount) {
  if (!hitCount || hitCount <= renderedCount) {
    return "";
  }
  return `展示前 ${renderedCount} / 共 ${hitCount}`;
}
