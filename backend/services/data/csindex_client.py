"""
中证指数公司（CSINDEX）官方数据采集客户端
通过中证指数官网核心 REST API (indexCsiDsPe) 实时获取指数最新市盈率与交易日期
"""
import logging
from typing import Any, Dict, Optional
from datetime import datetime, timedelta
import requests

logger = logging.getLogger(__name__)


class CsindexClient:
    """中证指数公司官方生产 REST 数据采集客户端"""

    BASE_REST_URL = "https://www.csindex.com.cn/csindex-home/perf/indexCsiDsPe"

    def __init__(self, timeout: int = 5, session: Optional[requests.Session] = None):
        """
        初始化客户端
        
        Args:
            timeout: 请求超时秒数
            session: requests 会话实例
        """
        self.timeout = timeout
        self.session = session or requests.Session()
        # 隔离系统失效代理，保证直连高可用
        self.session.trust_env = False
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.csindex.com.cn/",
            "Accept": "application/json, text/plain, */*"
        }

    def get_index_valuation(self, index_code: str) -> Optional[Dict[str, Any]]:
        """
        获取指定指数的最新官方估值指标 (通过生产 REST 接口)
        
        Args:
            index_code: 指数代码，如 '000300'、'399989'、'931151'
            
        Returns:
            Dict 包含:
                - trade_date: 交易日期 (YYYY-MM-DD)
                - index_code: 指数代码
                - pe_ttm: 官方滚动市盈率
                - source: 'csindex_official_rest'
        """
        clean_code = index_code.upper().replace(".SH", "").replace(".SZ", "").replace(".CSI", "").strip()
        if not clean_code or not clean_code.isdigit() or len(clean_code) != 6:
            logger.debug(f"非标准中证指数代码格式: {index_code}")
            return None

        # 默认拉取近 30 天时序，取最新一条记录
        today = datetime.now()
        start_date = (today - timedelta(days=30)).strftime("%Y%m%d")
        end_date = today.strftime("%Y%m%d")

        params = {
            "indexCode": clean_code,
            "startDate": start_date,
            "endDate": end_date
        }

        try:
            resp = self.session.get(
                self.BASE_REST_URL,
                params=params,
                headers=self.headers,
                timeout=self.timeout
            )
            if resp.status_code != 200:
                logger.warning(f"中证指数官方 REST 接口返回状态码异常: {resp.status_code} ({clean_code})")
                return None

            data_json = resp.json()
            if str(data_json.get("code")) != "200" or not data_json.get("data"):
                logger.debug(f"中证指数官方 REST 接口未返回有效数据: {clean_code}, msg={data_json.get('msg')}")
                return None

            items = data_json["data"]
            if not isinstance(items, list) or len(items) == 0:
                logger.warning(f"中证指数官方指标时序列表为空: {clean_code}")
                return None

            # 获取最新交易日记录 (最后一条)
            latest_row = items[-1]
            raw_pe = latest_row.get("peg")
            raw_date = str(latest_row.get("tradeDate", "")).strip()

            if raw_pe is None:
                logger.warning(f"中证官方指标缺少 peg 字段: {latest_row}")
                return None

            pe_val = float(raw_pe)
            if pe_val <= 0:
                return None

            if len(raw_date) == 8:
                date_formatted = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
            else:
                date_formatted = raw_date

            return {
                "trade_date": date_formatted,
                "index_code": clean_code,
                "pe_ttm": round(pe_val, 2),
                "source": "csindex_official_rest"
            }

        except Exception as e:
            logger.warning(f"抓取或解析中证指数官网 REST 估值失败 [{clean_code}]: {str(e)}")
            return None
