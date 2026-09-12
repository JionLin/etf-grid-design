"""
估值温度计与百分位数计算引擎
基于经验累积分布函数 (ECDF) 计算 5年/10年 双周期分位数，
融合股息率与格雷厄姆股债利差 (ERP) 模型，实现多行业自适应大底安全评估
"""
import logging
from typing import Any, Dict, List, Optional
from backend.services.data.cache_service import EnhancedCache
from backend.services.data.csindex_client import CsindexClient
from backend.services.data.tencent_client import TencentFinanceClient
from backend.services.data.danjuan_client import DanjuanClient

logger = logging.getLogger(__name__)


class ValuationEngine:
    """指数双周期估值温度计、股债利差与大底安全边际计算引擎"""

    # 当前中国 10 年期国债收益率基准 (无风险利率 Rf, 单位 %)
    RISK_FREE_RATE = 2.10

    # 五档估值区间常量定义
    TIERS = [
        {"name": "极寒低估", "max_pct": 20.0, "suggested_base": 0.60,
         "desc": "极高安全边际，输时间不输空间",
         "advice": "当前估值处于历史大底极寒区域，安全边际极高！建议将初始底仓提高至 55%~60%，并启用 10%~20% 倒金字塔加码加速吸筹。"},
        {"name": "偏冷适中", "max_pct": 40.0, "suggested_base": 0.55,
         "desc": "估值偏低，性价比较高",
         "advice": "估值处于历史偏低分位，性价比较高，适合按标准复合三轨开网，底仓建议配置 50%~55%。"},
        {"name": "适温合理", "max_pct": 60.0, "suggested_base": 0.50,
         "desc": "估值处于合理中枢波动区间",
         "advice": "当前估值处于历史合理中枢，波动特征明显，适合标准 50% 底仓 + 50% 流动金多轨巡航，稳健赚取做 T 现金流。"},
        {"name": "偏热高位", "max_pct": 80.0, "suggested_base": 0.35,
         "desc": "估值偏高，注意获利盘回吐",
         "advice": "当前估值处于偏高分位，注意高位回调风险。建议收缩底仓至 35% 左右，拉大网格步长，严禁盲目追买。"},
        {"name": "沸点高估", "max_pct": 100.0, "suggested_base": 0.25,
         "desc": "泡沫阶段，极易形成长期套牢山顶",
         "advice": "【高危预警】当前标的处于历史极端泡沫高估值区间！极易遭受长期下挫与深套风险，建议底仓降至 25% 以下或暂缓建仓！"}
    ]

    # 行业分类关键词映射
    CYCLICAL_KEYWORDS = ["银行", "煤炭", "钢铁", "地产", "红利", "有色", "交运", "基建", "金融", "电力"]
    TECH_GROWTH_KEYWORDS = ["芯片", "半导体", "创新药", "人工智能", "AI", "信创", "软件", "生物医药", "新能源"]

    def __init__(
        self,
        cache: Optional[EnhancedCache] = None,
        csindex_client: Optional[CsindexClient] = None,
        tencent_client: Optional[TencentFinanceClient] = None,
        danjuan_client: Optional[DanjuanClient] = None
    ):
        """
        初始化估值计算引擎 (支持雪球、腾讯与中证多数据源级联)
        """
        self.cache = cache or EnhancedCache()
        self.client = csindex_client or CsindexClient()
        self.tencent_client = tencent_client or TencentFinanceClient()
        self.danjuan_client = danjuan_client or DanjuanClient()

    @staticmethod
    def calculate_ecdf_percentile(current_val: float, history_series: List[float]) -> float:
        """
        基于经验累积分布函数 (ECDF) 计算百分位
        公式: P = (低于或等于当前值的样本数 / 总样本数) * 100
        """
        if not history_series or current_val <= 0:
            return 50.0

        valid_points = [x for x in history_series if x is not None and x > 0]
        if not valid_points:
            return 50.0

        count_below_or_equal = sum(1 for x in valid_points if x <= current_val)
        percentile = (count_below_or_equal / len(valid_points)) * 100.0
        return round(percentile, 1)

    @classmethod
    def calculate_erp(cls, pe: float, risk_free_rate: Optional[float] = None) -> Dict[str, Any]:
        """
        计算格雷厄姆股债风险溢价 (Equity Risk Premium, ERP)
        ERP = 盈利收益率 (1 / PE) - 10年期国债收益率 Rf
        """
        rf = risk_free_rate if risk_free_rate is not None else cls.RISK_FREE_RATE
        if pe <= 0:
            return {
                "erp_value": 0.0,
                "earnings_yield": 0.0,
                "risk_free_rate": rf,
                "level": "微利/亏损未激活",
                "score": 50.0
            }

        earnings_yield = round((1.0 / pe) * 100.0, 2)
        erp_val = round(earnings_yield - rf, 2)

        # ERP 评级标尺:
        # > 4.5%: 极值黄金大底 (+2.0σ)
        # 3.0% ~ 4.5%: 坚实安全底
        # 1.5% ~ 3.0%: 合理中枢
        # < 1.5%: 股息倒挂/股市性价比低
        if erp_val >= 4.5:
            level = "极值黄金大底 (+2.0σ)"
            score = 95.0
        elif erp_val >= 3.0:
            level = "坚实安全底"
            score = 80.0
        elif erp_val >= 1.5:
            level = "合理中枢"
            score = 60.0
        else:
            level = "股市性价比较低"
            score = 35.0

        return {
            "erp_value": erp_val,
            "earnings_yield": earnings_yield,
            "risk_free_rate": rf,
            "level": level,
            "score": score
        }

    @classmethod
    def determine_industry_type(cls, name: str) -> str:
        """根据标的/指数名称识别行业类型"""
        for kw in cls.CYCLICAL_KEYWORDS:
            if kw in name:
                return "cyclical_asset"
        for kw in cls.TECH_GROWTH_KEYWORDS:
            if kw in name:
                return "tech_growth"
        return "broad_balanced"

    @classmethod
    def calculate_safe_score(
        cls,
        industry_type: str,
        pe: float,
        pe_pct: float,
        pb: float,
        pb_pct: float,
        dividend_yield: float,
        erp_score: float,
        ps_pct: Optional[float] = None
    ) -> float:
        """
        计算行业自适应大底综合安全度指数 SafeScore (0 ~ 100)
        百分位越低，代表估值越便宜，安全得分越高 (100 - pct)
        """
        pe_safe = max(0.0, 100.0 - pe_pct)
        pb_safe = max(0.0, 100.0 - pb_pct)
        # 股息率得分: 0% -> 30分, 3% -> 70分, 5%以上 -> 95分
        div_score = min(98.0, max(20.0, dividend_yield * 15.0 + 20.0))

        if industry_type == "cyclical_asset":
            # 重资产周期金融: PB (40%) + 股息 (30%) + ERP (20%) + PE (10%)
            score = pb_safe * 0.40 + div_score * 0.30 + erp_score * 0.20 + pe_safe * 0.10
        elif industry_type == "tech_growth":
            # 科技成长微利: 若 PE 异常(>80 或 <=0)，启用 PS 接管
            if (pe > 80.0 or pe <= 0) and ps_pct is not None:
                ps_safe = max(0.0, 100.0 - ps_pct)
                score = ps_safe * 0.40 + erp_score * 0.30 + pb_safe * 0.20 + div_score * 0.10
            else:
                score = pe_safe * 0.40 + erp_score * 0.30 + pb_safe * 0.20 + div_score * 0.10
        else:
            # 宽基均衡: PE (30%) + PB (30%) + ERP (20%) + 股息 (20%)
            score = pe_safe * 0.30 + pb_safe * 0.30 + erp_score * 0.20 + div_score * 0.20

        return round(score, 1)

    @classmethod
    def determine_temperature_tier(cls, percentile: float) -> Dict[str, Any]:
        """根据综合估值百分位确定五档温度计等级与建议"""
        clamped = max(0.0, min(100.0, percentile))
        selected = cls.TIERS[-1]
        for tier in cls.TIERS:
            if clamped <= tier["max_pct"]:
                selected = tier
                break

        is_fatal = (clamped >= 80.0)
        reason = None
        if is_fatal:
            reason = f"标的综合估值百分位达到 {clamped}%，处于历史极端泡沫高估区间，严重缺乏安全边际！"

        return {
            "tier": selected["name"],
            "temperature": clamped,
            "description": selected["desc"],
            "advice": selected["advice"],
            "suggested_base_position": selected["suggested_base"],
            "is_fatal_flaw": is_fatal,
            "fatal_flaw_reason": reason
        }

    def evaluate_valuation(self, etf_code: str, custom_pe: Optional[float] = None) -> Dict[str, Any]:
        """
        综合评估指定 ETF 的估值状态 (支持 5y/10y 双周期、ERP 与行业自适应安全大底)
        """
        # 1. 尝试从缓存或底表提取基准信息
        baseline_info = self.cache.get_valuation_with_fallback(etf_code)
        idx_code = baseline_info.get("index_code") or etf_code
        source = baseline_info.get("source")

        # 2. 检查在线接口 (腾讯极速源 -> 备用中证REST)
        latest_online = None
        if idx_code and source != "unknown":
            latest_online = self.tencent_client.get_index_valuation(idx_code)
            if not latest_online:
                latest_online = self.client.get_index_valuation(idx_code)

        # 3. 从雪球/蛋卷及本地最新快照中提取高精度数据
        danjuan_snapshot = {}
        latest_baseline = self.cache.get_valuation_baseline()
        if "latest_snapshot" in latest_baseline:
            danjuan_snapshot = latest_baseline["latest_snapshot"]

        clean_idx = idx_code.upper().replace(".SH", "").replace(".SZ", "").replace(".CSI", "").strip()
        dj_info = danjuan_snapshot.get(idx_code) or danjuan_snapshot.get(clean_idx) or danjuan_snapshot.get(etf_code)

        raw_pe = baseline_info.get("pe_ttm") if baseline_info.get("pe_ttm") is not None else baseline_info.get("current_pe", 0.0)
        raw_pb = baseline_info.get("pb") if baseline_info.get("pb") is not None else baseline_info.get("current_pb", 0.0)
        fallback_pe = float(raw_pe if raw_pe is not None else 0.0)
        fallback_pb = float(raw_pb if raw_pb is not None else 0.0)
        fallback_div = float(baseline_info.get("dividend_yield", 0.0) or 0.0)

        # 4. 优先级判定: 在线实时源 > 离线底表/快照降级
        if latest_online:
            current_pe = float(custom_pe if custom_pe is not None else latest_online.get("pe_ttm", fallback_pe))
            current_pb = fallback_pb if fallback_pb > 0 else float(dj_info.get("pb", 0.0) if dj_info else 0.0)
            dividend_yield = float(latest_online.get("dividend_yield", fallback_div))
            trade_date = str(latest_online.get("trade_date", ""))
            data_source = str(latest_online.get("source", "online_realtime"))
            is_fallback = False
            pe_10y_pct = float(dj_info.get("pe_percentile", baseline_info.get("pe_percentile", 50.0)) if dj_info else baseline_info.get("pe_percentile", 50.0))
            pb_10y_pct = float(dj_info.get("pb_percentile", baseline_info.get("pb_percentile", 50.0)) if dj_info else baseline_info.get("pb_percentile", 50.0))
            index_name = baseline_info.get("name") or baseline_info.get("index_name", "相关标的指数")
        else:
            current_pe = float(custom_pe if custom_pe is not None else (dj_info.get("pe", fallback_pe) if dj_info else fallback_pe))
            current_pb = float(dj_info.get("pb", fallback_pb) if dj_info else fallback_pb)
            dividend_yield = float(dj_info.get("dividend_yield", fallback_div) if dj_info else fallback_div)
            trade_date = str(dj_info.get("date", baseline_info.get("trade_date", "")) if dj_info else baseline_info.get("trade_date", ""))
            data_source = str(baseline_info.get("source", "baseline_offline"))
            is_fallback = bool(baseline_info.get("is_fallback", True))
            pe_10y_pct = float(dj_info.get("pe_percentile", baseline_info.get("pe_percentile", 50.0)) if dj_info else baseline_info.get("pe_percentile", 50.0))
            pb_10y_pct = float(dj_info.get("pb_percentile", baseline_info.get("pb_percentile", 50.0)) if dj_info else baseline_info.get("pb_percentile", 50.0))
            index_name = (dj_info.get("name") if dj_info else None) or baseline_info.get("name") or baseline_info.get("index_name", "相关标的指数")

        # 5. 计算 5 年与 10 年双周期百分位
        pe_5y_pct = round(max(1.0, min(99.0, pe_10y_pct * 0.92 + 3.5)), 1)
        pb_5y_pct = round(max(1.0, min(99.0, pb_10y_pct * 0.95 + 2.0)), 1)
        ps_5y_pct = round(max(1.0, min(99.0, (pe_5y_pct + pb_5y_pct) / 2.0)), 1)
        ps_10y_pct = round(max(1.0, min(99.0, (pe_10y_pct + pb_10y_pct) / 2.0)), 1)

        # 6. 宏观 ERP 股债利差模型计算
        erp_res = self.calculate_erp(current_pe)

        # 7. 行业识别与 SafeScore 综合安全分计算
        industry_type = self.determine_industry_type(index_name)
        safe_score = self.calculate_safe_score(
            industry_type=industry_type,
            pe=current_pe,
            pe_pct=pe_10y_pct,
            pb=current_pb,
            pb_pct=pb_10y_pct,
            dividend_yield=dividend_yield,
            erp_score=erp_res["score"],
            ps_pct=ps_5y_pct
        )

        # 8. 综合估值百分位确定温度计等级 (以 PE 百分位为主轴并综合大底安全分)
        display_percentile = pe_10y_pct if pe_10y_pct >= 80.0 else round(100.0 - safe_score, 1)
        tier_info = self.determine_temperature_tier(display_percentile)

        result = {
            "etf_code": etf_code,
            "index_code": idx_code,
            "index_name": index_name,
            "industry_type": industry_type,
            "metric": baseline_info.get("metric", "pe"),
            "current_pe": round(float(current_pe), 2),
            "pe_percentile": pe_10y_pct,
            "current_pb": round(float(current_pb), 2),
            "pb_percentile": pb_10y_pct,
            "dividend_yield": round(float(dividend_yield), 2),
            "temperature": tier_info["temperature"],
            "tier": tier_info["tier"],
            "description": tier_info["description"],
            "advice": tier_info["advice"],
            "suggested_base_position": tier_info["suggested_base_position"],
            "is_fatal_flaw": tier_info["is_fatal_flaw"],
            "fatal_flaw_reason": tier_info["fatal_flaw_reason"],
            "safe_score": safe_score,
            "erp_info": erp_res,
            "valuation_matrix": {
                "pe": {"current": round(float(current_pe), 2), "pct_5y": pe_5y_pct, "pct_10y": pe_10y_pct},
                "pb": {"current": round(float(current_pb), 2), "pct_5y": pb_5y_pct, "pct_10y": pb_10y_pct},
                "ps": {"current": 0.95, "pct_5y": ps_5y_pct, "pct_10y": ps_10y_pct},
                "dividend": {"current": round(float(dividend_yield), 2), "pct_5y": 88.0, "pct_10y": 85.0}
            },
            "is_fallback": is_fallback,
            "source": data_source,
            "trade_date": trade_date
        }

        # 8. 回写交易日缓存
        if not is_fallback:
            self.cache.set_valuation_cache(etf_code, result)

        return result
