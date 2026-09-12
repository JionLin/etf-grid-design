import React, { useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import HeroSection from "./components/HeroSection";
import ETFSelectionRadarCard from "./components/ETFSelectionRadarCard";
import ParameterForm from "@features/analysis/components/ParameterForm";
import AnalysisHistory from "@features/history/components/AnalysisHistory";
import { generateAnalysisURL } from "@shared/utils/url";

/**
 * 首页组件
 * 负责展示首页内容和处理分析请求
 */
export default function HomePage() {
  const parameterFormRef = useRef(null);
  const [formInitialValues, setFormInitialValues] = useState(null);

  // 处理分析请求 - 跳转到分析页面
  const handleAnalysis = async (parameters) => {
    const analysisUrl = generateAnalysisURL(parameters.etfCode, parameters);
    window.location.href = analysisUrl;
  };

  // 滚动到策略参数设置
  const scrollToParameterForm = () => {
    if (parameterFormRef.current) {
      parameterFormRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  // 从选品雷达点击一键布网联动
  const handleSelectFromRadar = (item) => {
    const scaling = item.safe_score >= 85 ? 0.10 : 0.05;
    setFormInitialValues({
      etfCode: item.etf_code,
      scalingRatio: scaling,
      riskPreference: item.safe_score >= 85 ? "激进" : "均衡",
    });

    if (parameterFormRef.current) {
      parameterFormRef.current.scrollIntoView({
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

        {/* 今日网格选品雷达看板 */}
        <ETFSelectionRadarCard onSelectETF={handleSelectFromRadar} />

        <div ref={parameterFormRef}>
          <ParameterForm
            onAnalysis={handleAnalysis}
            initialValues={formInitialValues}
          />
        </div>

        <AnalysisHistory />
      </div>
    </>
  );
}
