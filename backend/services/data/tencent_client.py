"""
腾讯财经行情数据采集客户端
从腾讯行情接口 (qt.gtimg.cn) 秒级提取深沪指数的实时市盈率与最新交易日期
"""
import logging
from typing import Any, Dict, Optional
import requests

logger = logging.getLogger(__name__)


class TencentFinanceClient:
    """腾讯财经行情客户端"""

    BASE_URL = "http://qt.gtimg.cn/q={symbol}"

    def __init__(self, timeout: int = 4, session: Optional[requests.Session] = None):
        """
        初始化腾讯财经客户端
        
        Args:
            timeout: 请求超时秒数
            session: requests 会话实例
        """
        self.timeout = timeout
        self.session = session or requests.Session()
        # 显式隔离失效系统代理，确保网络直连高可用
        self.session.trust_env = False
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

    @staticmethod
    def get_tencent_symbol(index_code: str) -> Optional[str]:
        """
        将指数代码转换为腾讯行情代码格式 (如 000300 -> sh000300, 399989 -> sz399989)
        
        Args:
            index_code: 原始指数代码
            
        Returns:
            Optional[str]: 腾讯行情代码，若不支持则返回 None
        """
        clean = index_code.upper().replace(".SH", "").replace(".SZ", "").replace(".CSI", "").strip()
        if len(clean) != 6 or not clean.isdigit():
            return None

        # 上证系列代码
        if clean.startswith("000") or clean.startswith("000688"):
            return f"sh{clean}"
        # 深证与巨潮系列代码
        elif clean.startswith("399"):
            return f"sz{clean}"
        
        # 腾讯接口对 93 序列暂未提供统一行情变量，返回 None 触发下一级降级
        return None

    def get_index_valuation(self, index_code: str) -> Optional[Dict[str, Any]]:
        """
        获取指定指数的腾讯实时估值指标
        
        Args:
            index_code: 指数代码，如 '399989'、'000300'
            
        Returns:
            Dict 包含 trade_date, index_code, pe_ttm, source 等；若获取失败返回 None
        """
        symbol = self.get_tencent_symbol(index_code)
        if not symbol:
            logger.debug(f"腾讯行情不支持该指数代码前缀: {index_code}")
            return None

        url = self.BASE_URL.format(symbol=symbol)

        try:
            resp = self.session.get(url, headers=self.headers, timeout=self.timeout)
            if resp.status_code != 200:
                logger.warning(f"腾讯行情接口返回状态码异常: {resp.status_code} ({url})")
                return None

            resp.encoding = "gbk"
            text = resp.text.strip()
            if not text or "v_pv_none_match" in text or "=" not in text:
                logger.debug(f"腾讯行情未命中该标的: {symbol}")
                return None

            # 解析返回值：v_sz399989="51~中证医疗~399989~6466.52~..."
            _, val_str = text.split("=", 1)
            fields = val_str.strip('"; \n').split("~")
            if len(fields) < 40:
                logger.warning(f"腾讯行情返回字段不足: {len(fields)} ({symbol})")
                return None

            # 字段 30 为时间戳 (形如 20260911161406)
            raw_time = fields[30].strip()
            if len(raw_time) >= 8:
                trade_date = f"{raw_time[:4]}-{raw_time[4:6]}-{raw_time[6:8]}"
            else:
                trade_date = ""

            # 字段 39 为市盈率
            raw_pe = fields[39].strip()
            if not raw_pe or raw_pe in ["-", "0", "0.00"]:
                logger.debug(f"腾讯行情市盈率字段为空或无效: {raw_pe} ({symbol})")
                return None

            pe_val = float(raw_pe)
            if pe_val <= 0:
                return None

            return {
                "trade_date": trade_date,
                "index_code": index_code,
                "pe_ttm": round(pe_val, 2),
                "source": "tencent_realtime"
            }

        except Exception as e:
            logger.warning(f"从腾讯行情拉取估值失败 [{index_code}]: {str(e)}")
            return None
