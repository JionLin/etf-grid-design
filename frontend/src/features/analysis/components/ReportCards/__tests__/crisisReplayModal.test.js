import React from "react";
import CrisisReplayModal from "../CrisisReplayModal.jsx";

function runTests() {
  console.log("▶ 开始测试 CrisisReplayModal 组件定义与属性契约...");

  // 1. 验证组件为合法的 React 函数式组件
  if (typeof CrisisReplayModal !== "function") {
    throw new Error("CrisisReplayModal 必须为有效的 React 函数组件");
  }
  console.log("  ✓ CrisisReplayModal 函数组件导出正确");

  // 2. 验证关闭状态返回 null
  const nullRender = CrisisReplayModal({ isOpen: false, onClose: () => {}, crisisData: null });
  if (nullRender !== null) {
    throw new Error("当 isOpen 为 false 时，组件必须返回 null");
  }
  console.log("  ✓ isOpen=false 时返回 null 条件渲染正确");

  // 3. 验证未提供 crisisData 时返回 null
  const noDataRender = CrisisReplayModal({ isOpen: true, onClose: () => {}, crisisData: null });
  if (noDataRender !== null) {
    throw new Error("当 crisisData 为 null 时，组件必须返回 null");
  }
  console.log("  ✓ crisisData 为 null 时安全降级返回 null 正确");

  // 4. 验证提供正常数据时渲染外层弹窗容器
  const sampleCrisis = {
    rank: 1,
    max_dd_pct: 26.56,
    peak_date: "2023-04-18",
    start_date: "2023-04-19",
    trough_date: "2023-08-22",
    recovered_date: "2023-11-05",
    is_recovered: true,
    underwater_days: 186,
    fall_days: 88,
    recovery_days: 98,
    buy_count: 38,
    buy_amount: 12400,
    t_profit: 2140,
  };
  const activeRender = CrisisReplayModal({
    isOpen: true,
    onClose: () => {},
    crisisData: sampleCrisis,
    etfCode: "515220",
    etfName: "煤炭ETF",
  });

  if (!activeRender || activeRender.type !== "div") {
    throw new Error("当提供合法数据且 isOpen=true 时，组件必须渲染顶层模态框容器");
  }
  console.log("  ✓ 正常数据驱动下渲染结构正确");

  console.log("🎉 CrisisReplayModal 单元测试全部通过！\n");
}

runTests();
