"""
测试 10 年官方 PE 历史基准底表文件完整性
"""
import os
import json
import pytest

def test_csindex_pe_history_file_exists_and_valid():
    file_path = os.path.join(os.path.dirname(__file__), '../../data/csindex_pe_history_10y.json')
    assert os.path.exists(file_path), "基准底表文件不存在"
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    assert 'version' in data
    assert 'indices' in data
    assert 'etf_mapping' in data
    
    indices = data['indices']
    assert len(indices) >= 15, "核心指数数量应充足"
    
    # 验证关键宽基与行业指数存在
    for code in ['000300', '000905', '000016', '399006', '000688', '399975', '931087']:
        assert code in indices, f"关键指数 {code} 必须存在"
        idx_info = indices[code]
        assert 'pe_ttm' in idx_info
        assert 'pe_percentile' in idx_info
        assert 'tier' in idx_info
        assert 'advice' in idx_info
        assert 0 <= idx_info['pe_percentile'] <= 100
        
    # 验证核心 ETF 代码能映射到指数
    mapping = data['etf_mapping']
    for etf in ['510300', '510500', '510050', '159915', '588000', '512880', '515080']:
        assert etf in mapping, f"ETF {etf} 映射必须存在"
