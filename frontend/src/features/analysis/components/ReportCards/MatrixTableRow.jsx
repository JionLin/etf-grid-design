import React from "react";
import PropTypes from "prop-types";

function ReturnBadge({ periodObj, yieldDisplayMode }) {
  if (
    !periodObj ||
    !periodObj.is_valid ||
    (periodObj.annual_return === null && periodObj.total_return === null)
  ) {
    return (
      <span
        className="text-gray-300 font-mono text-xs"
        title={periodObj?.reason || "上市不足"}
      >
        -
      </span>
    );
  }

  const isTotal = yieldDisplayMode === "total";
  const mainVal = isTotal ? periodObj.total_return : periodObj.annual_return;
  const subVal = isTotal ? periodObj.annual_return : periodObj.total_return;
  const isPositive = (mainVal ?? 0) >= 0;

  return (
    <div className="flex flex-col items-end">
      <span
        className={`font-mono font-bold text-xs ${
          isPositive ? "text-red-600" : "text-emerald-600"
        }`}
      >
        {mainVal !== null && mainVal !== undefined
          ? isPositive
            ? `+${mainVal}%`
            : `${mainVal}%`
          : "-"}
      </span>
      <div className="flex items-center gap-1 text-[10px] text-gray-400 font-mono">
        <span>
          {isTotal ? "年化" : "累计"}{" "}
          {subVal !== null && subVal !== undefined
            ? subVal >= 0
              ? `+${subVal}%`
              : `${subVal}%`
            : "-"}
        </span>
        {periodObj.max_drawdown !== null && (
          <span>· 回撤 -{periodObj.max_drawdown}%</span>
        )}
      </div>
    </div>
  );
}

ReturnBadge.propTypes = {
  periodObj: PropTypes.object,
  yieldDisplayMode: PropTypes.string.isRequired,
};

const MatrixTableRow = React.memo(function MatrixTableRow({
  item,
  rowNum,
  yieldDisplayMode,
  onApply,
}) {
  const p = item.periods || {};
  const freeShares5y = p["5y"]?.free_shares;

  return (
    <tr className="hover:bg-indigo-50/30 transition-colors">
      <td className="py-2 px-3 text-center text-gray-400 font-sans text-[11px]">
        {rowNum}
      </td>
      <td className="py-2 px-3 font-bold text-indigo-600 font-mono">
        {item.etf_code}
      </td>
      <td
        className="py-2 px-3 font-sans font-medium text-gray-900 truncate max-w-[140px]"
        title={item.etf_name}
      >
        {item.etf_name}
      </td>
      <td className="py-2 px-3 font-sans">
        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px]">
          {item.sector || "未入池"}
        </span>
      </td>
      <td className="py-2 px-3">
        <ReturnBadge periodObj={p["90d"]} yieldDisplayMode={yieldDisplayMode} />
      </td>
      <td className="py-2 px-3">
        <ReturnBadge periodObj={p["180d"]} yieldDisplayMode={yieldDisplayMode} />
      </td>
      <td className="py-2 px-3">
        <ReturnBadge periodObj={p["1y"]} yieldDisplayMode={yieldDisplayMode} />
      </td>
      <td className="py-2 px-3">
        <ReturnBadge periodObj={p["2y"]} yieldDisplayMode={yieldDisplayMode} />
      </td>
      <td className="py-2 px-3">
        <ReturnBadge periodObj={p["3y"]} yieldDisplayMode={yieldDisplayMode} />
      </td>
      <td className="py-2 px-3 bg-indigo-50/20 text-right">
        <div className="flex flex-col items-end">
          <ReturnBadge periodObj={p["5y"]} yieldDisplayMode={yieldDisplayMode} />
          {freeShares5y > 0 && (
            <span className="text-[10px] text-amber-700 font-medium">
              🪙 留存 {freeShares5y.toLocaleString()} 股
            </span>
          )}
        </div>
      </td>
      <td className="py-2 px-3 text-center font-sans">
        <button
          onClick={(e) => onApply(item, e)}
          className="px-2.5 py-1 bg-white border border-indigo-200 hover:border-indigo-400 text-indigo-600 hover:bg-indigo-50 rounded text-[11px] font-medium transition-all shadow-2xs"
          title="将此标的代码与网格配置回填至首页策略设计器"
        >
          应用策略
        </button>
      </td>
    </tr>
  );
});

MatrixTableRow.propTypes = {
  item: PropTypes.shape({
    etf_code: PropTypes.string.isRequired,
    etf_name: PropTypes.string,
    sector: PropTypes.string,
    periods: PropTypes.object,
  }).isRequired,
  rowNum: PropTypes.number.isRequired,
  yieldDisplayMode: PropTypes.string.isRequired,
  onApply: PropTypes.func.isRequired,
};

export default MatrixTableRow;
