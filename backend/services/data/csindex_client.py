"""
中证指数公司（CSINDEX）官方数据采集客户端
从官网披露管道直接获取指数最新市盈率（总股本 PE-TTM）与股息率
"""
import logging
from typing import Any, Dict, Optional
import io
import requests
import pandas as pd

logger = logging.getLogger(__name__)


class CsindexClient:
    """中证指数公司官方披露数据采集客户端"""

    BASE_INDICATOR_URL = (
        "https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/file/autofile/indicator/{symbol}indicator.xls"
    )

    def __init__(self, timeout: int = 5, session: Optional[requests.Session] = None):
        """
        初始化客户端
        
        Args:
            timeout: 请求超时秒数
            session: requests 会话实例
        """
        self.timeout = timeout
        self.session = session or requests.Session()
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

    def get_index_valuation(self, index_code: str) -> Optional[Dict[str, Any]]:
        """
        获取指定指数的最新官方估值指标
        
        Args:
            index_code: 指数代码，如 '000300'、'000905'、'000852'
            
        Returns:
            Dict 包含:
                - trade_date: 交易日期 (YYYY-MM-DD)
                - index_code: 指数代码
                - pe_ttm: 总股本市盈率
                - pe_float: 自由流通股本市盈率
                - dividend_yield: 总股本股息率 (%)
                - dividend_yield_float: 自由流通股本股息率 (%)
                - source: 'csindex_official'
        """
        clean_code = index_code.upper().replace(".SH", "").replace(".SZ", "").replace(".CSI", "")
        url = self.BASE_INDICATOR_URL.format(symbol=clean_code)

        try:
            resp = self.session.get(url, headers=self.headers, timeout=self.timeout)
            if resp.status_code != 200:
                logger.warning(f"中证指数官方接口返回状态码异常: {resp.status_code} ({url})")
                return None

            # 解析 excel 内容
            df = pd.read_excel(io.BytesIO(resp.content))
            if df.empty:
                logger.warning(f"中证指数官方指标文件内容为空: {clean_code}")
                return None

            # 统一列名提取最新一条记录 (iloc[0])
            latest_row = df.iloc[0]

            # 寻找市盈率1与股息率1列名 (适配可能存在的不同版本列名)
            pe_col = None
            div_col = None
            date_col = None

            for col in df.columns:
                c_str = str(col)
                if "市盈率1" in c_str or "P/E1" in c_str:
                    pe_col = col
                elif "股息率1" in c_str or "D/P1" in c_str:
                    div_col = col
                elif "日期" in c_str or "Date" in c_str:
                    date_col = col

            if not pe_col:
                logger.warning(f"未在中证指标文件中找到市盈率1字段: {df.columns.tolist()}")
                return None

            pe_val = float(latest_row[pe_col])
            div_val = float(latest_row[div_col]) if div_col else 0.0
            date_raw = str(latest_row[date_col]) if date_col else ""
            date_str = date_raw.replace(".0", "").strip()
            if len(date_str) == 8:
                date_formatted = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
            else:
                date_formatted = date_str

            return {
                "trade_date": date_formatted,
                "index_code": clean_code,
                "pe_ttm": round(pe_val, 2),
                "dividend_yield": round(div_val, 2),
                "source": "csindex_official",
            }

        except Exception as e:
            logger.error(f"抓取或解析中证指数估值失败 [{clean_code}]: {str(e)}")
            return None
