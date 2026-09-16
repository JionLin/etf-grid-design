import React, { memo } from "react";
import ETFSelector from "@features/etf/components/ETFSelector";

/**
 * 标的选择与识别区组件
 */
const BasicInstrumentSection = memo(function BasicInstrumentSection({
  etfCode,
  onChange,
  error,
  etfInfo,
  loading,
  inputRef,
}) {
  return (
    <div className="space-y-1">
      <ETFSelector
        value={etfCode}
        onChange={onChange}
        error={error}
        etfInfo={etfInfo}
        loading={loading}
        inputRef={inputRef}
      />
    </div>
  );
});

export default BasicInstrumentSection;
