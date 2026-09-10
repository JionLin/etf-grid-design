import React, { useState, useEffect, useRef } from "react";
import { LoadingSpinner } from "@shared/components/ui";
import { useShare } from "@shared/hooks";
import ReportTabs from "./ReportTabs";
import OverviewTab from "./OverviewTab";
import ErrorState from "./ErrorState";
import Disclaimer from "./Disclaimer";
import SuitabilityCard from "./ReportCards/SuitabilityCard";
import GridParametersCard from "./ReportCards/GridParametersCard";
import BacktestCard from "./ReportCards/BacktestCard";

/**
 * 分析报告容器组件
 * 负责协调各个报告子组件和状态管理
 */
const AnalysisReport = ({
  data,
  loading,
  onBackToInput,
  onReAnalysis,
}) => {
  const [activeTab, setActiveTab] = useState("overview");
  const { shareContent } = useShare();
  const giscusRef = useRef(null);

  // 加载 Giscus 评论组件
  useEffect(() => {
    if (data && !data.error && giscusRef.current) {
      // 清除之前的 Giscus 实例
      giscusRef.current.innerHTML = '';
      
      // 创建 Giscus 脚本
      const script = document.createElement('script');
      script.src = 'https://giscus.app/client.js';
      script.setAttribute('data-repo', 'jorben/etf-grid-design');
      script.setAttribute('data-repo-id', 'R_kgDOPzq5AA');
      script.setAttribute('data-category', 'General');
      script.setAttribute('data-category-id', 'DIC_kwDOPzq5AM4Cv-y9');
      script.setAttribute('data-mapping', 'title');
      script.setAttribute('data-strict', '0');
      script.setAttribute('data-reactions-enabled', '1');
      script.setAttribute('data-emit-metadata', '0');
      script.setAttribute('data-input-position', 'top');
      script.setAttribute('data-theme', 'preferred_color_scheme');
      script.setAttribute('data-lang', 'zh-CN');
      script.setAttribute('data-loading', 'lazy');
      script.setAttribute('crossorigin', 'anonymous');
      script.async = true;
      
      giscusRef.current.appendChild(script);
    }
  }, [data]);


  // 显示加载状态
  if (loading) {
    return (
      <LoadingSpinner
        message="正在分析ETF数据..."
        showProgress={true}
        progress={75}
      />
    );
  }

  // 显示错误状态
  if (data?.error) {
    return (
      <ErrorState
        type="error"
        message={data.message}
        onBackToInput={onBackToInput}
        onReAnalysis={onReAnalysis}
      />
    );
  }

  if (!data) return null;

  const {
    etf_info,
    data_quality,
    suitability_evaluation,
    grid_strategy,
    strategy_rationale,
    adjustment_suggestions,
    input_parameters,
  } = data;

  // 数据完整性检查
  const isDataComplete = () => {
    if (!suitability_evaluation || !grid_strategy || !etf_info) {
      return false;
    }

    const dataObjects = {
      suitability_evaluation: suitability_evaluation,
      grid_strategy: grid_strategy,
      etf_info: etf_info,
    };

    const requiredFields = {
      suitability_evaluation: ["total_score", "conclusion"],
      grid_strategy: ["grid_config", "fund_allocation"],
      etf_info: ["code", "name", "current_price"],
    };

    for (const [objName, fields] of Object.entries(requiredFields)) {
      const obj = dataObjects[objName];
      for (const field of fields) {
        if (obj[field] === undefined || obj[field] === null) {
          return false;
        }
      }
    }

    return true;
  };

  if (!isDataComplete()) {
    return (
      <ErrorState
        type="data_incomplete"
        message="分析数据不完整，请重新分析"
        onBackToInput={onBackToInput}
        onReAnalysis={onReAnalysis}
      />
    );
  }

  // 集中归一化解析用户投资总资金与标的代码（消除蛇形/驼峰差异，严防回退 100000）
  const userTotalCapital = Number(
    input_parameters?.total_capital ??
    input_parameters?.totalCapital ??
    grid_strategy?.composite_grid?.total_capital ??
    grid_strategy?.fund_allocation?.total_capital ??
    30000
  );

  const targetEtfCode = input_parameters?.etf_code || input_parameters?.etfCode || etf_info?.code;
  const targetDays = Number(input_parameters?.analysis_days || input_parameters?.analysisDays || 180);
  const targetReinvestMode = input_parameters?.reinvest_mode || input_parameters?.reinvestMode || "pool_shares";
  const targetScalingRatio = Number(input_parameters?.scaling_ratio ?? input_parameters?.scalingRatio ?? 0.0);
  const targetStepMode = input_parameters?.step_mode || input_parameters?.stepMode || "atr";

  const normalizedInputParams = {
    ...input_parameters,
    total_capital: userTotalCapital,
    totalCapital: userTotalCapital,
    etf_code: targetEtfCode,
    etfCode: targetEtfCode,
    analysis_days: targetDays,
    analysisDays: targetDays,
    reinvest_mode: targetReinvestMode,
    reinvestMode: targetReinvestMode,
    scaling_ratio: targetScalingRatio,
    scalingRatio: targetScalingRatio,
    step_mode: targetStepMode,
    stepMode: targetStepMode,
  };

  return (
    <div className="space-y-6">
      {/* 标签页导航 */}
      <div className="bg-white rounded-xl shadow-lg">
        <ReportTabs activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="p-6">
          {/* 概览标签页 */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <OverviewTab
                etfInfo={etf_info}
                suitabilityEvaluation={suitability_evaluation}
                gridStrategy={grid_strategy}
                dataQuality={data_quality}
                inputParameters={normalizedInputParams}
              />
              <BacktestCard
                etfCode={targetEtfCode}
                totalCapital={userTotalCapital}
                initialDays={targetDays}
                reinvestMode={targetReinvestMode}
                scalingRatio={targetScalingRatio}
                stepMode={targetStepMode}
              />
            </div>
          )}

          {/* 网格策略标签页 */}
          {activeTab === "strategy" && (
            <div className="space-y-6">
              <GridParametersCard
                gridStrategy={grid_strategy}
                inputParameters={normalizedInputParams}
                totalCapital={userTotalCapital}
                stepMode={targetStepMode}
                strategyRationale={strategy_rationale}
                adjustmentSuggestions={adjustment_suggestions}
                showDetailed={true}
                dataQuality={data_quality}
              />
              <BacktestCard
                etfCode={targetEtfCode}
                totalCapital={userTotalCapital}
                initialDays={targetDays}
                reinvestMode={targetReinvestMode}
                scalingRatio={targetScalingRatio}
                stepMode={targetStepMode}
              />
            </div>
          )}

          {/* 历史回测标签页 */}
          {activeTab === "backtest" && (
            <BacktestCard
              etfCode={targetEtfCode}
              totalCapital={userTotalCapital}
              initialDays={targetDays}
              reinvestMode={targetReinvestMode}
              scalingRatio={targetScalingRatio}
              stepMode={targetStepMode}
            />
          )}

          {/* 适宜度评估标签页 */}
          {activeTab === "suitability" && (
            <SuitabilityCard
              evaluation={suitability_evaluation}
              dataQuality={data_quality}
              showDetailed={true}
            />
          )}
        </div>
      </div>

      {/* GitHub 评论组件 */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">讨论与反馈</h3>
        <div ref={giscusRef} className="giscus-container"></div>
      </div>

      {/* 免责声明 */}
      <Disclaimer />
    </div>
  );
};

export default AnalysisReport;
