import React from "react";
import MethodologyModal from "../MethodologyModal.jsx";

function runTests() {
  console.log("▶ 开始测试 MethodologyModal 组件定义与属性契约...");

  // 1. 验证组件为合法的 React 函数式组件
  if (typeof MethodologyModal !== "function") {
    throw new Error("MethodologyModal 必须为有效的 React 函数组件");
  }
  console.log("  ✓ MethodologyModal 函数式组件导出正确");

  // 2. 验证关闭状态返回 null
  const nullRender = MethodologyModal({ isOpen: false, onClose: () => {} });
  if (nullRender !== null) {
    throw new Error("当 isOpen 为 false 时，组件必须返回 null");
  }
  console.log("  ✓ isOpen=false 时返回 null 条件渲染正确");

  // 3. 验证开启状态下正确渲染弹窗主体
  const activeRender = MethodologyModal({ isOpen: true, onClose: () => {} });
  if (!activeRender || activeRender.type !== "div") {
    throw new Error("当 isOpen 为 true 时，组件必须渲染外层弹窗容器");
  }
  console.log("  ✓ isOpen=true 时渲染顶层容器正确");

  console.log("🎉 MethodologyModal 单元测试全部通过！\n");
}

runTests();
