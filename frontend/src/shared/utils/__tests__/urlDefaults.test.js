import {
  DEFAULT_PARAMS,
  encodeAnalysisParams,
  parseAnalysisURL,
  validateAndCompleteParams,
} from "../url.js";

function runTests() {
  console.log("▶ 开始测试 url 默认参数对齐 (10% 倒金字塔加码)...");

  // 1. 默认配置常量校验
  if (DEFAULT_PARAMS.scaling !== "0.1") {
    throw new Error(`DEFAULT_PARAMS.scaling 应为 "0.1"，实际为 ${DEFAULT_PARAMS.scaling}`);
  }
  if (DEFAULT_PARAMS.reinvest !== "pool_shares") {
    throw new Error(`DEFAULT_PARAMS.reinvest 应为 "pool_shares"，实际为 ${DEFAULT_PARAMS.reinvest}`);
  }
  console.log("  ✓ DEFAULT_PARAMS 常量默认值校验通过 (0.1 / pool_shares)");

  // 2. 缺省补全验证
  const completed = validateAndCompleteParams({ etfCode: "515220" });
  if (completed.params.scalingRatio !== 0.1) {
    throw new Error(`validateAndCompleteParams 应补全 scalingRatio 为 0.1，实际为 ${completed.params.scalingRatio}`);
  }
  if (completed.params.reinvestMode !== "pool_shares") {
    throw new Error(`validateAndCompleteParams 应补全 reinvestMode 为 "pool_shares"，实际为 ${completed.params.reinvestMode}`);
  }
  console.log("  ✓ validateAndCompleteParams 默认补全 10% 倒金字塔加码通过");

  // 3. 编码与解码回环验证
  const encoded = encodeAnalysisParams({
    etfCode: "515220",
    scalingRatio: 0.1,
    reinvestMode: "pool_shares",
  });
  const parsed = parseAnalysisURL("/analysis/515220", `?${encoded.toString()}`);
  if (parsed.params.scalingRatio !== 0.1) {
    throw new Error(`URL 解码后 scalingRatio 应为 0.1，实际为 ${parsed.params.scalingRatio}`);
  }
  if (parsed.params.reinvestMode !== "pool_shares") {
    throw new Error(`URL 解码后 reinvestMode 应为 "pool_shares"，实际为 ${parsed.params.reinvestMode}`);
  }
  console.log("  ✓ encodeAnalysisParams / parseAnalysisURL 10% 加码回环验证通过");

  // 4. 用户显式设置 0% 加码时应被尊重，不被默认值覆盖
  const customZero = validateAndCompleteParams({ etfCode: "515220", scalingRatio: 0.0 });
  if (customZero.params.scalingRatio !== 0.0) {
    throw new Error(`用户主动设置 0.0 加码应被保持，实际为 ${customZero.params.scalingRatio}`);
  }
  console.log("  ✓ 用户显式配置 0% 等额分配被正确保持");

  console.log("🎉 URL 默认参数对齐测试全部通过！\n");
}

runTests();
