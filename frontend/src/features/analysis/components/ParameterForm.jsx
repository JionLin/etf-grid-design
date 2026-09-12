import React, { useState, useEffect } from "react";
import { Settings, Clock, Calendar, PiggyBank, Layers, TrendingUp, Sparkles, Anchor, Plus, Minus, RotateCcw, Sliders, AlertCircle } from "lucide-react";
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
  // E大原版自定义步长百分比：默认小网5%、中网15%、大网30%
  const [edaSteps, setEdaSteps] = usePersistedState(
    "edaSteps",
    initialValues?.edaSteps || { small: 5, medium: 15, large: 30 },
  );
  // ATR自适应自定义乘数：默认小网0.6、中网1.2、大网2.5
  const [atrMultipliers, setAtrMultipliers] = usePersistedState(
    "atrMultipliers",
    initialValues?.atrMultipliers || { small: 0.6, medium: 1.2, large: 2.5 },
  );
  // 自定义基准价格模式：'market' 最新市场价 (默认) | 'custom' 自定义成本价
  const [benchmarkMode, setBenchmarkMode] = useState(
    initialValues?.benchmarkPrice ? "custom" : "market",
  );
  const [customPrice, setCustomPrice] = useState(
    initialValues?.benchmarkPrice ? initialValues.benchmarkPrice.toString() : "",
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
      if (initialValues.edaSteps) {
        setEdaSteps(initialValues.edaSteps);
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

  // E大原版步长防呆校验
  const getEdaStepError = () => {
    if (stepMode !== "fixed_eda") return null;
    const s = Number(edaSteps?.small);
    const m = Number(edaSteps?.medium);
    const l = Number(edaSteps?.large);
    if (isNaN(s) || isNaN(m) || isNaN(l) || s === "" || m === "" || l === "") {
      return "请输入完整且合法的步长数值";
    }
    if (s < 1) return "小网步长最低为 1%";
    if (s >= m) return `小网步长 (${s}%) 必须小于中网步长 (${m}%)`;
    if (m >= l) return `中网步长 (${m}%) 必须小于大网步长 (${l}%)`;
    if (l > 50) return "大网步长最高为 50%";
    return null;
  };

  const edaStepError = getEdaStepError();

  // 处理步进按钮加减
  const handleStepChange = (rail, delta) => {
    setEdaSteps((prev) => {
      const current = { ...(prev || { small: 5, medium: 15, large: 30 }) };
      const currentVal = Number(current[rail]);
      const nextVal = currentVal + delta;

      if (rail === "small") {
        if (delta > 0 && nextVal >= Number(current.medium)) return prev;
        if (delta < 0 && nextVal < 1) return prev;
      } else if (rail === "medium") {
        if (delta > 0 && nextVal >= Number(current.large)) return prev;
        if (delta < 0 && nextVal <= Number(current.small)) return prev;
      } else if (rail === "large") {
        if (delta > 0 && nextVal > 50) return prev;
        if (delta < 0 && nextVal <= Number(current.medium)) return prev;
      }

      return {
        ...current,
        [rail]: nextVal,
      };
    });
  };

  // 处理输入框手动输入
  const handleStepInput = (rail, rawVal) => {
    const val = rawVal === "" ? "" : parseInt(rawVal, 10);
    setEdaSteps((prev) => ({
      ...(prev || { small: 5, medium: 15, large: 30 }),
      [rail]: isNaN(val) ? "" : val,
    }));
  };

  // 一键恢复默认
  const handleResetEdaSteps = () => {
    setEdaSteps({ small: 5, medium: 15, large: 30 });
  };

  // 校验 ATR 自定义乘数
  const getAtrMultiplierError = () => {
    if (stepMode !== "atr") return null;
    const s = Number(atrMultipliers?.small);
    const m = Number(atrMultipliers?.medium);
    const l = Number(atrMultipliers?.large);
    if (isNaN(s) || isNaN(m) || isNaN(l)) {
      return "请输入完整的乘数数值";
    }
    if (s < 0.2) return "小网乘数最低为 0.2x";
    if (s >= m) return `小网乘数 (${s}x) 必须小于中网乘数 (${m}x)`;
    if (m >= l) return `中网乘数 (${m}x) 必须小于大网乘数 (${l}x)`;
    if (l > 5.0) return "大网乘数最高为 5.0x";
    return null;
  };

  const atrMultiplierError = getAtrMultiplierError();

  // 处理 ATR 乘数步进加减
  const handleAtrMultiplierChange = (rail, delta) => {
    setAtrMultipliers((prev) => {
      const current = { ...(prev || { small: 0.6, medium: 1.2, large: 2.5 }) };
      const currentVal = Number(current[rail]);
      const nextVal = Math.round((currentVal + delta) * 10) / 10;

      if (rail === "small") {
        if (delta > 0 && nextVal >= Number(current.medium)) return prev;
        if (delta < 0 && nextVal < 0.2) return prev;
      } else if (rail === "medium") {
        if (delta > 0 && nextVal >= Number(current.large)) return prev;
        if (delta < 0 && nextVal <= Number(current.small)) return prev;
      } else if (rail === "large") {
        if (delta > 0 && nextVal > 5.0) return prev;
        if (delta < 0 && nextVal <= Number(current.medium)) return prev;
      }

      return {
        ...current,
        [rail]: nextVal,
      };
    });
  };

  // 一键恢复默认 ATR 乘数
  const handleResetAtrMultipliers = () => {
    setAtrMultipliers({ small: 0.6, medium: 1.2, large: 2.5 });
  };

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

    if (stepMode === "fixed_eda" && edaStepError) {
      newErrors.edaSteps = edaStepError;
    }
    if (stepMode === "atr" && atrMultiplierError) {
      newErrors.atrMultipliers = atrMultiplierError;
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
      edaSteps: stepMode === "fixed_eda" ? edaSteps : undefined,
      edaStepRatios: stepMode === "fixed_eda" ? {
        small: Number(edaSteps.small) / 100,
        medium: Number(edaSteps.medium) / 100,
        large: Number(edaSteps.large) / 100,
      } : undefined,
      atrMultipliers: stepMode === "atr" ? atrMultipliers : undefined,
      benchmarkPrice: (benchmarkMode === "custom" && customPrice) ? parseFloat(customPrice) : null,
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

        {/* 基准价格锚点设置 (最新市价 vs 自定义持仓成本价) */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Anchor className="w-4 h-4 text-blue-600" />
              网格基准价格 (P₀ 锚点)
            </label>
            <span className="text-xs text-blue-700 font-medium">
              {benchmarkMode === "custom" ? "✏️ 用户自定义成本锚点" : "⚡ 自动跟随最新收盘市价"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setBenchmarkMode("market");
                setCustomPrice("");
              }}
              className={`py-2 px-3 text-xs font-medium rounded-lg border text-left transition-all ${
                benchmarkMode === "market"
                  ? "bg-blue-50/90 border-blue-500 text-blue-900 ring-2 ring-blue-400/40 font-bold shadow-xs"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <div className="font-semibold text-xs text-blue-950 flex items-center gap-1">
                <span>⚡ 最新收盘市价 (默认)</span>
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                {etfInfo?.current_price ? `当前现价约 ¥${etfInfo.current_price}` : "自动获取当日最新市场价格"}
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setBenchmarkMode("custom");
                if (!customPrice && etfInfo?.current_price) {
                  setCustomPrice(etfInfo.current_price.toString());
                }
              }}
              className={`py-2 px-3 text-xs font-medium rounded-lg border text-left transition-all ${
                benchmarkMode === "custom"
                  ? "bg-amber-50/90 border-amber-500 text-amber-900 ring-2 ring-amber-400/40 font-bold shadow-xs"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <div className="font-semibold text-xs text-amber-950 flex items-center gap-1">
                <span>✏️ 自定义成本/心理价</span>
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                按自有持仓成本或心仪点位铺设网格
              </div>
            </button>
          </div>

          {benchmarkMode === "custom" && (
            <div className="mt-2.5 p-2.5 bg-amber-50/70 border border-amber-300 rounded-lg flex items-center gap-3">
              <span className="text-xs font-medium text-amber-900 shrink-0">自定义基准价 (元):</span>
              <input
                type="number"
                step="0.001"
                min="0.01"
                placeholder={etfInfo?.current_price ? etfInfo.current_price.toString() : "例如 1.250"}
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="w-36 px-2.5 py-1 text-xs font-mono font-bold bg-white border border-amber-400 rounded focus:ring-1 focus:ring-amber-500 focus:outline-none"
              />
              <span className="text-[11px] text-amber-800">
                以该价格为中心向上挂卖单、向下挂买单
              </span>
            </div>
          )}
        </div>

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
              {stepMode === "fixed_eda"
                ? `🏛️ E大原版 ${edaSteps?.small || 5}%/${edaSteps?.medium || 15}%/${edaSteps?.large || 30}%`
                : `★ 🌊 ATR ${Number(atrMultipliers?.small ?? 0.6).toFixed(1)}x/${Number(atrMultipliers?.medium ?? 1.2).toFixed(1)}x/${Number(atrMultipliers?.large ?? 2.5).toFixed(1)}x`}
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
                默认小网 5% / 中网 15% / 大网 30%，跨度宏大、交易频率低，适合长周期守株待兔
              </div>
            </button>
          </div>

          {/* ATR动态自适应模式下默认常驻展开的三轨乘数微调区 */}
          {stepMode === "atr" && (
            <div className="mt-3 p-3 bg-indigo-50/70 border border-indigo-200/90 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between border-b border-indigo-200/70 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-950">
                  <Sliders className="w-3.5 h-3.5 text-indigo-700" />
                  <span>自定义三轨 ATR 波动率乘数</span>
                  <span className="text-[10px] text-indigo-700/80 font-normal">
                    (必须满足: 小网 &lt; 中网 &lt; 大网)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleResetAtrMultipliers}
                  className="inline-flex items-center gap-1 text-[11px] text-indigo-800 hover:text-indigo-950 font-medium px-2 py-0.5 rounded bg-white border border-indigo-300 hover:bg-indigo-100/60 transition-colors shadow-2xs"
                  title="恢复官方默认 0.6x / 1.2x / 2.5x"
                >
                  <RotateCcw className="w-3 h-3 text-indigo-700" />
                  <span>恢复默认</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* 🟢 小网 */}
                <div className="bg-white/90 border border-indigo-200/80 rounded-lg p-2 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px] font-medium text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      小网 (高频做T)
                    </span>
                    <span className="text-[10px] text-gray-400">资金20%·5档</span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => handleAtrMultiplierChange("small", -0.1)}
                      disabled={Number(atrMultipliers?.small) <= 0.2}
                      className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="减小 0.1x"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center justify-center flex-1">
                      <span className="font-bold text-sm text-gray-900 font-mono">
                        {Number(atrMultipliers?.small ?? 0.6).toFixed(1)}
                      </span>
                      <span className="text-xs text-indigo-700 font-semibold ml-0.5">x</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAtrMultiplierChange("small", 0.1)}
                      disabled={Number(atrMultipliers?.small) + 0.1 >= Number(atrMultipliers?.medium)}
                      className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="增加 0.1x"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 🔵 中网 */}
                <div className="bg-white/90 border border-indigo-200/80 rounded-lg p-2 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px] font-medium text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      中网 (波段巡航)
                    </span>
                    <span className="text-[10px] text-gray-400">资金35%·3档</span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => handleAtrMultiplierChange("medium", -0.1)}
                      disabled={Number(atrMultipliers?.medium) - 0.1 <= Number(atrMultipliers?.small)}
                      className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="减小 0.1x"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center justify-center flex-1">
                      <span className="font-bold text-sm text-gray-900 font-mono">
                        {Number(atrMultipliers?.medium ?? 1.2).toFixed(1)}
                      </span>
                      <span className="text-xs text-indigo-700 font-semibold ml-0.5">x</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAtrMultiplierChange("medium", 0.1)}
                      disabled={Number(atrMultipliers?.medium) + 0.1 >= Number(atrMultipliers?.large)}
                      className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="增加 0.1x"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 🟣 大网 */}
                <div className="bg-white/90 border border-indigo-200/80 rounded-lg p-2 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px] font-medium text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      大网 (估值防守)
                    </span>
                    <span className="text-[10px] text-gray-400">资金45%·2档</span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => handleAtrMultiplierChange("large", -0.1)}
                      disabled={Number(atrMultipliers?.large) - 0.1 <= Number(atrMultipliers?.medium)}
                      className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="减小 0.1x"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center justify-center flex-1">
                      <span className="font-bold text-sm text-gray-900 font-mono">
                        {Number(atrMultipliers?.large ?? 2.5).toFixed(1)}
                      </span>
                      <span className="text-xs text-indigo-700 font-semibold ml-0.5">x</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAtrMultiplierChange("large", 0.1)}
                      disabled={Number(atrMultipliers?.large) >= 5.0}
                      className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="增加 0.1x"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 快捷场景预设按钮 */}
              <div className="flex items-center justify-between pt-1 border-t border-indigo-100/80 text-[11px]">
                <span className="text-gray-500">快捷预设:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAtrMultipliers({ small: 0.4, medium: 0.8, large: 1.8 })}
                    className="px-2 py-0.5 rounded bg-white border border-indigo-200 text-indigo-800 hover:bg-indigo-50 transition-colors"
                    title="高频吃碎步"
                  >
                    ⚡ 超高频 (0.4/0.8/1.8)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAtrMultipliers({ small: 0.6, medium: 1.2, large: 2.5 })}
                    className="px-2 py-0.5 rounded bg-white border border-indigo-200 text-indigo-800 hover:bg-indigo-50 transition-colors font-medium"
                    title="官方推荐经典乘数"
                  >
                    ⚖️ 经典平衡 (0.6/1.2/2.5)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAtrMultipliers({ small: 0.8, medium: 1.5, large: 3.2 })}
                    className="px-2 py-0.5 rounded bg-white border border-indigo-200 text-indigo-800 hover:bg-indigo-50 transition-colors"
                    title="宽网避震荡"
                  >
                    🛡️ 宽网防守 (0.8/1.5/3.2)
                  </button>
                </div>
              </div>

              {atrMultiplierError && (
                <div className="flex items-center gap-1 text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded px-2 py-1">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  <span>{atrMultiplierError}</span>
                </div>
              )}
            </div>
          )}

          {/* E大原版模式下展开的步长微调区 */}
          {stepMode === "fixed_eda" && (
            <div className="mt-3 p-3 bg-amber-50/70 border border-amber-200/90 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between border-b border-amber-200/70 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-950">
                  <Sliders className="w-3.5 h-3.5 text-amber-700" />
                  <span>自定义三轨大步长比例</span>
                  <span className="text-[10px] text-amber-700/80 font-normal">
                    (必须满足: 小网 &lt; 中网 &lt; 大网)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleResetEdaSteps}
                  className="inline-flex items-center gap-1 text-[11px] text-amber-800 hover:text-amber-950 font-medium px-2 py-0.5 rounded bg-white border border-amber-300 hover:bg-amber-100/60 transition-colors shadow-2xs"
                  title="恢复官方默认 5% / 15% / 30%"
                >
                  <RotateCcw className="w-3 h-3 text-amber-700" />
                  <span>恢复默认</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* 🟢 小网 */}
                <div className="bg-white/90 border border-amber-200/80 rounded-lg p-2 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px] font-medium text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      小网 (高频做T)
                    </span>
                    <span className="text-[10px] text-gray-400">下限 1%</span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => handleStepChange("small", -1)}
                      disabled={Number(edaSteps?.small) <= 1}
                      className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="减小 1%"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center justify-center flex-1">
                      <input
                        type="number"
                        value={edaSteps?.small ?? 5}
                        onChange={(e) => handleStepInput("small", e.target.value)}
                        className="w-12 text-center font-bold text-sm text-gray-900 border border-gray-300 rounded py-0.5 focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                        min={1}
                        max={50}
                      />
                      <span className="text-xs text-gray-500 font-semibold ml-1">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStepChange("small", 1)}
                      disabled={Number(edaSteps?.small) + 1 >= Number(edaSteps?.medium)}
                      className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="增加 1%"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 🔵 中网 */}
                <div className="bg-white/90 border border-amber-200/80 rounded-lg p-2 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px] font-medium text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      中网 (波段巡航)
                    </span>
                    <span className="text-[10px] text-gray-400">主力中坚</span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => handleStepChange("medium", -1)}
                      disabled={Number(edaSteps?.medium) - 1 <= Number(edaSteps?.small)}
                      className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="减小 1%"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center justify-center flex-1">
                      <input
                        type="number"
                        value={edaSteps?.medium ?? 15}
                        onChange={(e) => handleStepInput("medium", e.target.value)}
                        className="w-12 text-center font-bold text-sm text-gray-900 border border-gray-300 rounded py-0.5 focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                        min={1}
                        max={50}
                      />
                      <span className="text-xs text-gray-500 font-semibold ml-1">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStepChange("medium", 1)}
                      disabled={Number(edaSteps?.medium) + 1 >= Number(edaSteps?.large)}
                      className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="增加 1%"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 🟣 大网 */}
                <div className="bg-white/90 border border-amber-200/80 rounded-lg p-2 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px] font-medium text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      大网 (估值防守)
                    </span>
                    <span className="text-[10px] text-gray-400">上限 50%</span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => handleStepChange("large", -1)}
                      disabled={Number(edaSteps?.large) - 1 <= Number(edaSteps?.medium)}
                      className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="减小 1%"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center justify-center flex-1">
                      <input
                        type="number"
                        value={edaSteps?.large ?? 30}
                        onChange={(e) => handleStepInput("large", e.target.value)}
                        className="w-12 text-center font-bold text-sm text-gray-900 border border-gray-300 rounded py-0.5 focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                        min={1}
                        max={50}
                      />
                      <span className="text-xs text-gray-500 font-semibold ml-1">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStepChange("large", 1)}
                      disabled={Number(edaSteps?.large) >= 50}
                      className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="增加 1%"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 防呆校验错误警示 */}
              {edaStepError && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 p-2 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                  <span className="font-medium">{edaStepError}</span>
                </div>
              )}
            </div>
          )}
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
