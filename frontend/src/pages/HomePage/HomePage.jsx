import React, { useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import HeroSection from "./components/HeroSection";
import ETFActivePoolRadar from "./components/ETFActivePoolRadar";
import BacktestArchiveView from "@features/analysis/components/ReportCards/BacktestArchiveView";
import ParameterForm from "@features/analysis/components/ParameterForm";
import AnalysisHistory from "@features/history/components/AnalysisHistory";
import { generateAnalysisURL } from "@shared/utils/url";

/**
 * 首页组件
 * 负责展示首页内容和处理分析请求
 */
export default function HomePage() {
  const formSectionRef = useRef(null);
  const parameterFormRef = useRef(null);
  const [selectionMode, setSelectionMode] = useState("radar"); // 'radar' | 'matrix'

  // 处理分析请求 - 跳转到分析页面
  const handleAnalysis = async (parameters) => {
    const analysisUrl = generateAnalysisURL(parameters.etfCode, parameters);
    window.location.href = analysisUrl;
  };

  const handleSelectETF = (code) => {
    parameterFormRef.current?.selectEtf(code);
    scrollToParameterForm();
  };

  const handleApplyFromMatrix = (params, record) => {
    if (params?.etfCode) {
      parameterFormRef.current?.selectEtf(params.etfCode);
      scrollToParameterForm();
    }
  };

  const scrollToParameterForm = () => {
    if (formSectionRef.current) {
      formSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  return (
    <>
      <Helmet>
        <title>ETFer.Top - 基于ATR算法的智能网格交易策略设计工具</title>
        <meta
          name="description"
          content="专业的ETF网格交易策略分析系统，基于ATR算法动态计算最优网格参数，提供详细的收益预测和风险评估。"
        />
      </Helmet>

      <div className="space-y-8">
        <HeroSection onStartAnalysis={scrollToParameterForm} />

        {/* 全市场做 T 标的选品与策略决策中心 (双模式胶囊切换) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3.5">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>🎯 全市场做 T 标的选品与策略决策中心</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                结合近期 20 日流动性与 5 年历史实证长跑战绩，挑出真正适合做网格的优质品种
              </p>
            </div>

            {/* 双模式切换胶囊按钮组 */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl self-start sm:self-auto text-xs shrink-0">
              <button
                type="button"
                onClick={() => setSelectionMode("radar")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  selectionMode === "radar"
                    ? "bg-white text-indigo-600 font-bold shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <span>🎯 20日活跃选品雷达</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectionMode("matrix")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  selectionMode === "matrix"
                    ? "bg-white text-indigo-600 font-bold shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <span>🏆 5年多周期回测天梯</span>
              </button>
            </div>
          </div>

          {/* 选品视图展示 */}
          <div>
            {selectionMode === "radar" ? (
              <ETFActivePoolRadar onSelectETF={handleSelectETF} isEmbedded={true} />
            ) : (
              <BacktestArchiveView onApplyParams={handleApplyFromMatrix} isEmbedded={true} />
            )}
          </div>
        </div>

        <div ref={formSectionRef}>
          <ParameterForm ref={parameterFormRef} onAnalysis={handleAnalysis} />
        </div>

        <AnalysisHistory />
      </div>
    </>
  );
}
