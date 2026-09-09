import React, { useState, useEffect } from "react";
import { Settings, Clock, Calendar } from "lucide-react";
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
