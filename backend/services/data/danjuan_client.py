"""
雪球 / 蛋卷基金（Danjuan）指数估值与历史时序数据采集客户端
提供全市场主流指数最新市盈率、市净率、股息率及 5年/10年 历史周频时序数据
"""
import logging
from typing import Any, Dict, List, Optional
import requests

logger = logging.getLogger(__name__)


class DanjuanClient:
    """雪球/蛋卷官方指数估值数据采集客户端"""

    DJ_ALL_URL = "https://danjuanapp.com/djapi/index_eva/dj"
    PE_HISTORY_URL = "https://danjuanfunds.com/djapi/index_eva/pe_history/{index_code}"
    PB_HISTORY_URL = "https://danjuanfunds.com/djapi/index_eva/pb_history/{index_code}"
    DETAIL_URL = "https://danjuanfunds.com/djapi/index_eva/detail/{index_code}"

    def __init__(self, timeout: int = 5, session: Optional[requests.Session] = None):
        """
        初始化客户端
        
        Args:
            timeout: 请求超时时间（秒）
            session: requests 会话实例
        """
        self.timeout = timeout
        self.session = session or requests.Session()
        # 隔离系统可能失效的代理环境变量，保证直连稳定性
        self.session.trust_env = False
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json, text/plain, */*",
            "Referer": "https://danjuanfunds.com/"
        }

    @staticmethod
    def normalize_symbol(code: str) -> str:
        """统一转换为带市场前缀的大写指数代码，如 000300 -> SH000300, 399006 -> SZ399006"""
        raw = code.upper().replace(".SH", "").replace(".SZ", "").replace(".CSI", "").strip()
        if raw.startswith("SH") or raw.startswith("SZ") or raw.startswith("CSI") or raw.startswith("HK"):
            return raw
        if raw.startswith("000") or raw.startswith("001") or raw.startswith("51") or raw.startswith("58"):
            return f"SH{raw}"
        if raw.startswith("399") or raw.startswith("15"):
            return f"SZ{raw}"
        if raw.startswith("93") or raw.startswith("H3"):
            return f"CSI{raw}"
        return f"SH{raw}"

    def get_all_index_valuations(self) -> Dict[str, Dict[str, Any]]:
        """
        获取全量指数最新估值快照列表
        
        Returns:
            Dict[str, Dict]: 键为纯代码与前缀代码，值为包含 pe, pb, 股息率等字段的信息字典
        """
        try:
            resp = self.session.get(self.DJ_ALL_URL, headers=self.headers, timeout=self.timeout)
            if resp.status_code != 200:
                logger.warning(f"蛋卷全量估值接口返回非200状态码: {resp.status_code}")
                return {}
            payload = resp.json()
            items = payload.get("data", {}).get("items", [])
            result = {}
            for item in items:
                idx_code = item.get("index_code", "").upper()
                clean_code = idx_code.replace("SH", "").replace("SZ", "").replace("CSI", "")
                
                info = {
                    "index_code": idx_code,
                    "clean_code": clean_code,
                    "name": item.get("name", ""),
                    "pe": float(item.get("pe", 0.0) or 0.0),
                    "pb": float(item.get("pb", 0.0) or 0.0),
                    "pe_percentile": round(float(item.get("pe_percentile", 0.0) or 0.0) * 100, 1),
                    "pb_percentile": round(float(item.get("pb_percentile", 0.0) or 0.0) * 100, 1),
                    "roe": float(item.get("roe", 0.0) or 0.0),
                    "dividend_yield": round(float(item.get("yeild", 0.0) or 0.0) * 100, 2),
                    "pb_flag": bool(item.get("pb_flag", False)),
                    "eva_type": item.get("eva_type", "mid"),
                    "date": item.get("date", ""),
                    "source": "danjuan_online"
                }
                result[idx_code] = info
                if clean_code:
                    result[clean_code] = info
            return result
        except Exception as e:
            logger.warning(f"获取蛋卷全量指数估值失败: {e}")
            return {}

    def get_index_pe_history(self, index_code: str, day: str = "all") -> List[Dict[str, Any]]:
        """
        获取指定指数的历史 PE 序列
        
        Args:
            index_code: 指数代码，如 'SH000300' 或 '000300'
            day: 时间跨度，'5y' (5年约258周) 或 'all' (10年约515周)
            
        Returns:
            List[Dict]: [{'pe': 13.47, 'ts': 1631462400000}, ...]
        """
        symbol = self.normalize_symbol(index_code)
        url = self.PE_HISTORY_URL.format(index_code=symbol)
        try:
            resp = self.session.get(url, params={"day": day}, headers=self.headers, timeout=self.timeout)
            if resp.status_code != 200:
                return []
            data = resp.json().get("data", {})
            return data.get("index_eva_pe_growths", [])
        except Exception as e:
            logger.warning(f"获取指数 {symbol} PE 历史序列失败: {e}")
            return []

    def get_index_pb_history(self, index_code: str, day: str = "all") -> List[Dict[str, Any]]:
        """
        获取指定指数的历史 PB 序列
        
        Args:
            index_code: 指数代码，如 'SH000300' 或 '000300'
            day: 时间跨度，'5y' 或 'all'
            
        Returns:
            List[Dict]: [{'pb': 1.67, 'ts': 1631462400000}, ...]
        """
        symbol = self.normalize_symbol(index_code)
        url = self.PB_HISTORY_URL.format(index_code=symbol)
        try:
            resp = self.session.get(url, params={"day": day}, headers=self.headers, timeout=self.timeout)
            if resp.status_code != 200:
                return []
            data = resp.json().get("data", {})
            return data.get("index_eva_pb_growths", [])
        except Exception as e:
            logger.warning(f"获取指数 {symbol} PB 历史序列失败: {e}")
            return []
