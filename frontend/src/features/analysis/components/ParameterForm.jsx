import React, { useState, useEffect } from "react";
import { Settings, Clock, Calendar, PiggyBank, Layers, TrendingUp, Sparkles } from "lucide-react";
import { usePersistedState } from "@shared/hooks";
import { validateETFCode, validateCapital } from "@shared/utils/validation";
import { checkDisclaimerStatus, acceptDisclaimer } from "@shared/utils/disclaimer";
import ETFSelector from "@features/etf/components/ETFSelector";
import CapitalInput from "./CapitalInput";
import GridTypeSelector from "./GridTypeSelector";
import RiskSelector from "./RiskSelector";
import AdjustmentCoefficientSlider from "./AdjustmentCoefficientSlider";
import DisclaimerModal from "./DisclaimerModal";

/**
 * 参数表单容器组件
 * 负责协调各个输入组件和表单验证
 */
const ParameterForm = ({ onAnalysis, loading, initialValues }) => {
  // 状态管理
  const [etfCode, setEtfCode] = usePersistedState(
    "etfCode",
    initialValues?.etfCode || "510300",
  );
  const [totalCapital, setTotalCapital] = usePersistedState(
    "totalCapital",
    initialValues?.totalCapital?.toString() || "100000",
  );
  const [gridType, setGridType] = usePersistedState(
    "gridType",
    initialValues?.gridType || "等比",
  );
  const [riskPreference, setRiskPreference] = usePersistedState(
    "riskPreference",
    initialValues?.riskPreference || "均衡",
  );
  const [adjustmentCoefficient, setAdjustmentCoefficient] = usePersistedState(
    "adjustmentCoefficient",
    initialValues?.adjustmentCoefficient || 1.0,
  );
  const [analysisDays, setAnalysisDays] = usePersistedState(
    "analysisDays",
    initialValues?.analysisDays || 180,
  );
  // 做T收益模式：'pool_shares' 利润池滚存留股 (推荐) | 'cash' 全额留现金
  const [reinvestMode, setReinvestMode] = usePersistedState(
    "reinvestMode",
    initialValues?.reinvestMode || "pool_shares",
  );
  // 逐格加码比例：0.0 (等额) | 0.05~0.20 (倒金字塔递增)
  const [scalingRatio, setScalingRatio] = usePersistedState(
    "scalingRatio",
    initialValues?.scalingRatio !== undefined ? Number(initialValues.scalingRatio) : 0.0,
  );
  const [enableScaling, setEnableScaling] = useState(Number(scalingRatio) > 0);
  // 步长生成模式：'atr' 默认ATR自适应 | 'fixed_eda' E大原版经典大步长(5%/15%/30%)
  const [stepMode, setStepMode] = usePersistedState(
    "stepMode",
    initialValues?.stepMode || "atr",
  );

  const [popularETFs, setPopularETFs] = useState([]);
  const [capitalPresets, setCapitalPresets] = useState([]);
  const [etfInfo, setEtfInfo] = useState(null);
  const [etfLoading, setEtfLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [pendingFormData, setPendingFormData] = useState(null);

  // 当初始值变化时更新状态
  useEffect(() => {
    if (initialValues) {
      if (initialValues.etfCode && initialValues.etfCode !== etfCode) {
        setEtfCode(initialValues.etfCode);
      }
      if (
        initialValues.totalCapital &&
        initialValues.totalCapital.toString() !== totalCapital
      ) {
        setTotalCapital(initialValues.totalCapital.toString());
      }
      if (initialValues.gridType && initialValues.gridType !== gridType) {
        setGridType(initialValues.gridType);
      }
      if (
        initialValues.riskPreference &&
        initialValues.riskPreference !== riskPreference
      ) {
        setRiskPreference(initialValues.riskPreference);
      }
      if (
        initialValues.adjustmentCoefficient &&
        initialValues.adjustmentCoefficient !== adjustmentCoefficient
      ) {
        setAdjustmentCoefficient(initialValues.adjustmentCoefficient);
      }
    }
  }, [
    initialValues,
    etfCode,
    totalCapital,
    gridType,
    riskPreference,
    adjustmentCoefficient,
    setEtfCode,
    setTotalCapital,
    setGridType,
    setRiskPreference,
    setAdjustmentCoefficient,
  ]);

  // 获取热门ETF列表
  useEffect(() => {
    fetch("/api/popular-etfs")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPopularETFs(data.data);
        }
      })
      .catch((err) => console.error("获取热门ETF失败:", err));
  }, []);

  // 获取资金预设
  useEffect(() => {
    fetch("/api/capital-presets")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCapitalPresets(data.data);
        }
      })
      .catch((err) => console.error("获取资金预设失败:", err));
  }, []);

  // ETF代码变化时获取基础信息
  useEffect(() => {
    if (etfCode && etfCode.length === 6) {
      setEtfLoading(true);
      setEtfInfo(null);

      fetch(`/api/etf/basic-info/${etfCode}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setEtfInfo(data.data);
            setErrors((prev) => ({ ...prev, etfCode: "" }));
          } else {
            setEtfInfo(null);
            setErrors((prev) => ({ ...prev, etfCode: data.error }));
          }
        })
        .catch((err) => {
          setEtfInfo(null);
          setErrors((prev) => ({ ...prev, etfCode: "获取ETF信息失败" }));
        })
        .finally(() => {
          setEtfLoading(false);
        });
    } else {
      setEtfInfo(null);
      setEtfLoading(false);
    }
  }, [etfCode]);

  // 表单验证
  const validateForm = () => {
    const newErrors = {};

    if (!validateETFCode(etfCode)) {
      newErrors.etfCode = "请输入6位数字ETF代码";
    }

    const capitalValidation = validateCapital(parseFloat(totalCapital));
    if (!capitalValidation.isValid) {
      newErrors.totalCapital = capitalValidation.error;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 表单提交
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const formData = {
      etfCode,
      totalCapital: parseFloat(totalCapital),
      gridType,
      riskPreference,
      adjustmentCoefficient: parseFloat(adjustmentCoefficient),
      analysisDays: parseInt(analysisDays, 10) || 180,
      scalingRatio: enableScaling ? parseFloat(scalingRatio) : 0.0,
      reinvestMode,
      stepMode,
    };

    // 检查用户是否需要重新确认免责声明
    if (!checkDisclaimerStatus()) {
      // 未确认或已过期，显示免责声明弹窗
      setPendingFormData(formData);
      setShowDisclaimer(true);
      return;
    }

    // 已同意且未过期，直接执行分析
    onAnalysis(formData);
  };

  // 处理免责声明同意
  const handleDisclaimerAccept = () => {
    // 记录用户已同意免责声明
    acceptDisclaimer();
    setShowDisclaimer(false);
    
    // 执行之前暂存的表单提交
    if (pendingFormData) {
      onAnalysis(pendingFormData);
      setPendingFormData(null);
    }
  };

  // 处理免责声明取消
  const handleDisclaimerCancel = () => {
    setShowDisclaimer(false);
    setPendingFormData(null);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Settings className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">策略参数设置</h2>
          <p className="text-sm text-gray-600">
            请填写您的投资偏好，系统将为您量身定制网格交易策略
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <ETFSelector
          value={etfCode}
          onChange={setEtfCode}
          error={errors.etfCode}
          popularETFs={popularETFs}
          etfInfo={etfInfo}
          loading={etfLoading}
        />

        <CapitalInput
          value={totalCapital}
          onChange={setTotalCapital}
          error={errors.totalCapital}
          presets={capitalPresets}
        />

        {/* 历史分析周期选择器 */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Clock className="w-4 h-4 text-blue-600" />
              历史分析周期
            </label>
            <span className="text-xs text-gray-500 font-normal">
              {analysisDays === 180 ? "★ 推荐黄金平衡 (半年跨度)" : analysisDays === 90 ? "⚡ 短线高频波动" : "🛡️ 52周大箱体"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setAnalysisDays(90)}
              className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all ${
                analysisDays === 90
                  ? "bg-blue-50/90 border-blue-500 text-blue-700 ring-2 ring-blue-400/50 font-bold shadow-xs"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <div className="font-semibold text-xs">90 天</div>
              <div className="text-[10px] opacity-75 mt-0.5">高频做T · 灵敏</div>
            </button>
            <button
              type="button"
              onClick={() => setAnalysisDays(180)}
              className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all ${
                analysisDays === 180
                  ? "bg-blue-50/90 border-blue-500 text-blue-700 ring-2 ring-blue-400/50 font-bold shadow-xs"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <div className="font-semibold text-xs">180 天 (默认)</div>
              <div className="text-[10px] opacity-75 mt-0.5">★ 黄金平衡 · 半年</div>
            </button>
            <button
              type="button"
              onClick={() => setAnalysisDays(365)}
              className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all ${
                analysisDays === 365
                  ? "bg-blue-50/90 border-blue-500 text-blue-700 ring-2 ring-blue-400/50 font-bold shadow-xs"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <div className="font-semibold text-xs">365 天</div>
              <div className="text-[10px] opacity-75 mt-0.5">年度大箱体 · 防守</div>
            </button>
          </div>
        </div>

        {/* 步长生成模式选择器 (ATR自适应 vs E大原版5%/15%/30%) */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              步长生成模式
            </label>
            <span className="text-xs text-indigo-700 font-medium">
              {stepMode === "fixed_eda" ? "🏛️ E大原版 5%/15%/30%" : "★ 🌊 ATR 动态自适应"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStepMode("atr")}
              className={`py-2 px-3 text-xs font-medium rounded-lg border text-left transition-all ${
                stepMode === "atr"
                  ? "bg-indigo-50/90 border-indigo-500 text-indigo-900 ring-2 ring-indigo-400/40 font-bold shadow-xs"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <div className="font-semibold text-xs text-indigo-950 flex items-center gap-1">
                <span>★ 🌊 ATR 动态自适应 (默认)</span>
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                基于14日波幅自适应计算(小网~1.9%/中网~3.8%/大网~7.9%)，适合高频做T现金流
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStepMode("fixed_eda")}
              className={`py-2 px-3 text-xs font-medium rounded-lg border text-left transition-all ${
                stepMode === "fixed_eda"
                  ? "bg-amber-50/90 border-amber-500 text-amber-900 ring-2 ring-amber-400/40 font-bold shadow-xs"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <div className="font-semibold text-xs text-amber-950 flex items-center gap-1">
                <span>🏛️ E大原版经典大步长</span>
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                小网 5% / 中网 15% / 大网 30%，跨度宏大、交易频率低，适合长周期守株待兔
              </div>
            </button>
          </div>
        </div>

        {/* 做 T 收益处理机制 (E大 2.1 留利润) */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <PiggyBank className="w-4 h-4 text-emerald-600" />
              做 T 收益留存机制 (E大 2.1)
            </label>
            <span className="text-xs text-emerald-700 font-medium">
              {reinvestMode === "pool_shares" ? "★ 聚沙成塔 · 滚存0成本份额" : "落袋为安 · 全现金"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setReinvestMode("pool_shares")}
              className={`py-2 px-3 text-xs font-medium rounded-lg border text-left transition-all ${
                reinvestMode === "pool_shares"
                  ? "bg-emerald-50/90 border-emerald-500 text-emerald-800 ring-2 ring-emerald-400/40 font-bold shadow-xs"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-xs text-emerald-900">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                智能利润滚存 (推荐)
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">每攒满100股自动沉淀为0成本锁仓份额</div>
            </button>
            <button
              type="button"
              onClick={() => setReinvestMode("cash")}
              className={`py-2 px-3 text-xs font-medium rounded-lg border text-left transition-all ${
                reinvestMode === "cash"
                  ? "bg-blue-50/90 border-blue-500 text-blue-800 ring-2 ring-blue-400/40 font-bold shadow-xs"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <div className="font-semibold text-xs text-gray-900">💰 全额落袋现金</div>
              <div className="text-[10px] text-gray-500 mt-0.5">经典1.0模式，差价利润全额收回为可用现金</div>
            </button>
          </div>
        </div>

        {/* 逢跌买入节奏 (E大 2.2 逐格加码) */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Layers className="w-4 h-4 text-blue-600" />
              逢跌买入节奏 (E大 2.2 逐格加码)
            </label>
            <span className="text-xs text-gray-500 font-mono">
              {enableScaling ? `倒金字塔递增 +${Math.round(scalingRatio * 100)}%` : "各档等额买入 (0%)"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              type="button"
              onClick={() => {
                setEnableScaling(false);
                setScalingRatio(0.0);
              }}
              className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all ${
                !enableScaling
                  ? "bg-blue-50/90 border-blue-500 text-blue-700 ring-2 ring-blue-400/40 font-bold shadow-xs"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <div className="font-semibold text-xs">⚖️ 各档等额 (默认 0%)</div>
              <div className="text-[10px] text-gray-400 mt-0.5">平分流动资金，风险均匀分布</div>
            </button>
            <button
              type="button"
              onClick={() => {
                setEnableScaling(true);
                if (Number(scalingRatio) === 0) setScalingRatio(0.10);
              }}
              className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all ${
                enableScaling
                  ? "bg-purple-50/90 border-purple-500 text-purple-800 ring-2 ring-purple-400/40 font-bold shadow-xs"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <div className="font-semibold text-xs">📐 逐格加码 (倒金字塔)</div>
              <div className="text-[10px] text-gray-400 mt-0.5">越跌买越多，极速摊薄持仓成本</div>
            </button>
          </div>

          {enableScaling && (
            <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-purple-900 font-medium">每格递增资金比例：</span>
                <span className="font-mono font-bold text-purple-700">+{Math.round(scalingRatio * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.20"
                step="0.01"
                value={scalingRatio}
                onChange={(e) => setScalingRatio(parseFloat(e.target.value))}
                className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="flex items-center justify-between gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setScalingRatio(0.05)}
                  className={`px-2 py-0.5 rounded border transition-all ${
                    scalingRatio === 0.05 ? "bg-purple-600 text-white font-bold" : "bg-white text-purple-700 border-purple-200"
                  }`}
                >
                  5% (温和)
                </button>
                <button
                  type="button"
                  onClick={() => setScalingRatio(0.10)}
                  className={`px-2 py-0.5 rounded border transition-all ${
                    scalingRatio === 0.10 ? "bg-purple-600 text-white font-bold" : "bg-white text-purple-700 border-purple-200"
                  }`}
                >
                  ★ 10% (E大推荐)
                </button>
                <button
                  type="button"
                  onClick={() => setScalingRatio(0.20)}
                  className={`px-2 py-0.5 rounded border transition-all ${
                    scalingRatio === 0.20 ? "bg-purple-600 text-white font-bold" : "bg-white text-purple-700 border-purple-200"
                  }`}
                >
                  20% (激进大底)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 提交按钮 */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                正在分析策略...
              </div>
            ) : (
              "开始分析策略"
            )}
          </button>
        </div>

        {/* 分隔线 */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">更多设置</span>
          </div>
        </div>

        <GridTypeSelector value={gridType} onChange={setGridType} />
        <RiskSelector value={riskPreference} onChange={setRiskPreference} />
        <AdjustmentCoefficientSlider
          value={adjustmentCoefficient}
          onChange={setAdjustmentCoefficient}
        />
      </form>

      {/* 免责声明弹窗 */}
      <DisclaimerModal
        isOpen={showDisclaimer}
        onAccept={handleDisclaimerAccept}
        onCancel={handleDisclaimerCancel}
      />
    </div>
  );
};

export default ParameterForm;
