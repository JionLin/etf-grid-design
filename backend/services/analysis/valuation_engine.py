"""
估值温度计与百分位数计算引擎
基于经验累积分布函数 (ECDF) 计算 10 年分位数，并输出五档估值温度与网格开网策略联动建议
"""
import logging
from typing import Any, Dict, List, Optional, Tuple
from backend.services.data.cache_service import EnhancedCache
from backend.services.data.csindex_client import CsindexClient
from backend.services.data.tencent_client import TencentFinanceClient

logger = logging.getLogger(__name__)


class ValuationEngine:
    """指数估值温度计与安全边际计算引擎"""

    # 五档估值区间常量定义
    TIERS = [
        {"name": "极寒低估", "max_pct": 20.0, "suggested_base": 0.60,
         "desc": "极高安全边际，输时间不输空间", "advice": "当前估值处于历史大底极寒区域，安全边际极高！建议将初始底仓提高至 55%~60%，并启用 10%~20% 倒金字塔加码加速吸筹。"},
        {"name": "偏冷适中", "max_pct": 40.0, "suggested_base": 0.55,
         "desc": "估值偏低，性价比较高", "advice": "估值处于历史偏低分位，性价比较高，适合按标准复合三轨开网，底仓建议配置 50%~55%。"},
        {"name": "适温合理", "max_pct": 60.0, "suggested_base": 0.50,
         "desc": "估值处于合理中枢波动区间", "advice": "当前估值处于历史合理中枢，波动特征明显，适合标准 50% 底仓 + 50% 流动金多轨巡航，稳健赚取做 T 现金流。"},
        {"name": "偏热高位", "max_pct": 80.0, "suggested_base": 0.35,
         "desc": "估值偏高，注意获利盘回吐", "advice": "当前估值处于偏高分位，注意高位回调风险。建议收缩底仓至 35% 左右，拉大网格步长，严禁盲目追买。"},
        {"name": "沸点高估", "max_pct": 100.0, "suggested_base": 0.25,
         "desc": "泡沫阶段，极易形成长期套牢山顶", "advice": "【高危预警】当前标的处于历史极端泡沫高估值区间！极易遭受长期下挫与深套风险，建议底仓降至 25% 以下或暂缓建仓！"}
    ]

    def __init__(
        self,
        cache: Optional[EnhancedCache] = None,
        csindex_client: Optional[CsindexClient] = None,
        tencent_client: Optional[TencentFinanceClient] = None
    ):
        """
        初始化估值计算引擎 (支持腾讯与中证双在线级联)
        
        Args:
            cache: 增强缓存管理器
            csindex_client: 中证指数官方客户端
            tencent_client: 腾讯财经行情客户端
        """
        self.cache = cache or EnhancedCache()
        self.client = csindex_client or CsindexClient()
        self.tencent_client = tencent_client or TencentFinanceClient()

    @staticmethod
    def calculate_ecdf_percentile(current_val: float, history_series: List[float]) -> float:
        """
        基于经验累积分布函数 (ECDF) 计算百分位
        
        公式: P = (低于或等于当前值的样本数 / 总样本数) * 100
        
        Args:
            current_val: 当前指标值 (如当前 PE)
            history_series: 历史指标时序序列 (如近 10 年日频 PE)
            
        Returns:
            float: 历史百分位数 (0.0 ~ 100.0)
        """
        if not history_series:
            return 50.0

        valid_points = [x for x in history_series if x is not None and x > 0]
        if not valid_points:
            return 50.0

        count_below_or_equal = sum(1 for x in valid_points if x <= current_val)
        percentile = (count_below_or_equal / len(valid_points)) * 100.0
        return round(percentile, 1)

    @classmethod
    def determine_temperature_tier(cls, percentile: float) -> Dict[str, Any]:
        """
        根据估值百分位确定五档温度计等级与建议
        
        Args:
            percentile: 历史百分位 (0.0 ~ 100.0)
            
        Returns:
            Dict 包含 tier, temperature, suggested_base_position, desc, advice, is_fatal_flaw
        """
        p = max(0.0, min(100.0, float(percentile)))
        
        matched_tier = cls.TIERS[-1]
        for t in cls.TIERS:
            if p <= t["max_pct"]:
                matched_tier = t
                break

        is_fatal = p >= 80.0
        fatal_flaw_reason = (
            f"估值分位数处于 {p:.1f}% 极度高估区间，透支未来增长，严禁重仓开网，防范戴维斯双杀！"
            if is_fatal else None
        )

        return {
            "tier": matched_tier["name"],
            "temperature": p,
            "suggested_base_position": matched_tier["suggested_base"],
            "description": matched_tier["desc"],
            "advice": matched_tier["advice"],
            "is_fatal_flaw": is_fatal,
            "fatal_flaw_reason": fatal_flaw_reason
        }

    def evaluate_valuation(self, etf_code: str, custom_pe: Optional[float] = None) -> Dict[str, Any]:
        """
        综合评估指定 ETF 的估值状态 (支持三级缓存与在线中证增量)
        
        Args:
            etf_code: ETF 代码 (如 510300)
            custom_pe: 自定义市盈率输入 (可选)
            
        Returns:
            Dict 包含估值温度计、分位数、建议、数据来源与评级
        """
        # 1. 尝试从缓存或底表提取基准信息
        baseline_info = self.cache.get_valuation_with_fallback(etf_code)
        idx_code = baseline_info.get("index_code")
        source = baseline_info.get("source")

        # 2. 三级级联获取最新快照 (优先腾讯极速源 -> 备用中证REST -> 兜底离线底表)
        latest_online = None
        if idx_code and source != "unknown":
            # 2.1 首选通道：腾讯财经行情接口 (极速, 毫秒级)
            latest_online = self.tencent_client.get_index_valuation(idx_code)
            
            # 2.2 备用通道：中证官网生产 REST 接口 (全覆盖 93 序列或腾讯未命中时)
            if not latest_online:
                latest_online = self.client.get_index_valuation(idx_code)
        
        # 3. 确定最终使用的 PE/PB/股息率与更新日期 (兼容底表 pe_ttm 与缓存 current_pe)
        raw_pe = baseline_info.get("pe_ttm") if baseline_info.get("pe_ttm") is not None else baseline_info.get("current_pe", 0.0)
        raw_pb = baseline_info.get("pb") if baseline_info.get("pb") is not None else baseline_info.get("current_pb", 0.0)
        fallback_pe = float(raw_pe if raw_pe is not None else 0.0)
        fallback_pb = float(raw_pb if raw_pb is not None else 0.0)
        fallback_div = float(baseline_info.get("dividend_yield", 0.0) or 0.0)

        if latest_online:
            current_pe = float(custom_pe if custom_pe is not None else latest_online.get("pe_ttm", fallback_pe))
            dividend_yield = float(latest_online.get("dividend_yield", fallback_div))
            trade_date = str(latest_online.get("trade_date", ""))
            data_source = str(latest_online.get("source", "online_realtime"))
            is_fallback = False
        else:
            current_pe = float(custom_pe if custom_pe is not None else fallback_pe)
            dividend_yield = fallback_div
            trade_date = str(baseline_info.get("trade_date", "2025-05-15")) if source != "unknown" else ""
            data_source = str(baseline_info.get("source", "baseline_offline"))
            is_fallback = bool(baseline_info.get("is_fallback", True))

        # 4. 计算或提取历史百分位
        # 如果底表包含 summary，可基于历史插值计算，或直接取基准分位
        summary = baseline_info.get("summary", {})
        if summary and current_pe > 0:
            # 采用 5 分位锚点动态逼近
            min_v = summary.get("min", 10.0)
            p20_v = summary.get("p20", 15.0)
            p50_v = summary.get("p50", 20.0)
            p80_v = summary.get("p80", 25.0)
            max_v = summary.get("max", 35.0)

            if current_pe <= min_v:
                computed_pct = 2.0
            elif current_pe <= p20_v:
                computed_pct = 2.0 + 18.0 * (current_pe - min_v) / max(0.01, (p20_v - min_v))
            elif current_pe <= p50_v:
                computed_pct = 20.0 + 30.0 * (current_pe - p20_v) / max(0.01, (p50_v - p20_v))
            elif current_pe <= p80_v:
                computed_pct = 50.0 + 30.0 * (current_pe - p50_v) / max(0.01, (p80_v - p50_v))
            elif current_pe <= max_v:
                computed_pct = 80.0 + 18.0 * (current_pe - p80_v) / max(0.01, (max_v - p80_v))
            else:
                computed_pct = 99.0
            pe_percentile = round(computed_pct, 1)
        else:
            pe_percentile = baseline_info.get("pe_percentile", 50.0)

        # 5. 生成五档温度与投顾建议
        tier_info = self.determine_temperature_tier(pe_percentile)

        result = {
            "etf_code": etf_code,
            "index_code": idx_code or etf_code,
            "index_name": baseline_info.get("name") or baseline_info.get("index_name", "相关标的指数"),
            "metric": baseline_info.get("metric", "pe"),
            "current_pe": round(float(current_pe), 2),
            "pe_percentile": pe_percentile,
            "current_pb": round(float(baseline_info.get("pb") or baseline_info.get("current_pb", 0.0)), 2),
            "pb_percentile": baseline_info.get("pb_percentile", 50.0),
            "dividend_yield": round(float(dividend_yield), 2),
            "temperature": tier_info["temperature"],
            "tier": tier_info["tier"],
            "description": tier_info["description"],
            "advice": tier_info["advice"],
            "suggested_base_position": tier_info["suggested_base_position"],
            "is_fatal_flaw": tier_info["is_fatal_flaw"],
            "fatal_flaw_reason": tier_info["fatal_flaw_reason"],
            "is_fallback": is_fallback,
            "source": data_source,
            "trade_date": trade_date
        }

        # 6. 回写交易日缓存
        if not is_fallback:
            self.cache.set_valuation_cache(etf_code, result)

        return result
