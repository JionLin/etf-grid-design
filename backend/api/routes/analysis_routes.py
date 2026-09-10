"""
分析相关路由模块
包含ETF网格交易策略分析接口
"""

from flask import Blueprint, request, jsonify
import traceback
from services.analysis.etf_analysis_service import ETFAnalysisService

# 创建分析蓝图
analysis_bp = Blueprint('analysis', __name__)
etf_service = ETFAnalysisService()

@analysis_bp.route('/api/analyze', methods=['POST'])
def analyze_etf_strategy():
    """ETF网格交易策略分析"""
    try:
        # 获取请求参数
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': '请求参数不能为空'
            }), 400
        
        # 验证必需参数
        required_fields = ['etfCode', 'totalCapital', 'gridType', 'riskPreference']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'缺少必需参数: {field}'
                }), 400
        
        # 参数验证
        etf_code = data['etfCode'].strip()
        if not etf_code or len(etf_code) != 6 or not etf_code.isdigit():
            return jsonify({
                'success': False,
                'error': 'ETF代码格式错误，请输入6位数字'
            }), 400
        
        total_capital = float(data['totalCapital'])
        if total_capital < 10000 or total_capital > 1000000:
            return jsonify({
                'success': False,
                'error': '投资金额应在1万-100万之间'
            }), 400
        
        grid_type = data['gridType']
        if grid_type not in ['等差', '等比']:
            return jsonify({
                'success': False,
                'error': '网格类型只能是"等差"或"等比"'
            }), 400
        
        risk_preference = data['riskPreference']
        if risk_preference not in ['低频', '均衡', '高频']:
            return jsonify({
                'success': False,
                'error': '频率偏好只能是"低频"、"均衡"或"高频"'
            }), 400
        
        # 获取调节系数（可选参数，默认1.0）
        adjustment_coefficient = float(data.get('adjustmentCoefficient', 1.0))
        if adjustment_coefficient < 0.0 or adjustment_coefficient > 2.0:
            return jsonify({
                'success': False,
                'error': '调节系数应在0.0-2.0之间'
            }), 400
        
        # 获取分析周期天数（可选参数，默认180天，支持90/180/365）
        analysis_days = int(data.get('analysisDays', 180))
        if analysis_days not in [90, 180, 365]:
            analysis_days = 180

        # 获取逐格加码比例（可选参数，默认0.0，范围0.0-0.20）
        scaling_ratio = float(data.get('scalingRatio', data.get('scaling_ratio', 0.0)))
        if scaling_ratio < 0.0 or scaling_ratio > 0.50:
            scaling_ratio = 0.0

        # 获取步长生成模式（可选参数，默认'atr'，支持'atr'或'fixed_eda'）
        step_mode = str(data.get('stepMode', data.get('step_mode', 'atr')))
        if step_mode not in ['atr', 'fixed_eda']:
            step_mode = 'atr'
        
        from flask import current_app
        current_app.logger.info(f"开始分析ETF策略: {etf_code}, 资金{total_capital}, "
                   f"{grid_type}网格, {risk_preference}, 加码{scaling_ratio}, 步长模式{step_mode}, 周期{analysis_days}天")
        
        # 执行分析
        analysis_result = etf_service.analyze_etf_strategy(
            etf_code=etf_code,
            total_capital=total_capital,
            grid_type=grid_type,
            risk_preference=risk_preference,
            adjustment_coefficient=adjustment_coefficient,
            analysis_days=analysis_days,
            scaling_ratio=scaling_ratio,
            step_mode=step_mode,
        )
        
        current_app.logger.info(f"ETF策略分析完成: {etf_code}, "
                   f"适宜度评分{analysis_result['suitability_evaluation']['total_score']}")
        
        return jsonify({
            'success': True,
            'data': analysis_result
        })
        
    except ValueError as e:
        from flask import current_app
        current_app.logger.error(f"参数验证失败: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400
    except Exception as e:
        from flask import current_app
        current_app.logger.error(f"ETF策略分析失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': '分析失败，请稍后重试或检查ETF代码是否正确'
        }), 500

@analysis_bp.route('/api/backtest', methods=['POST'])
def run_backtest():
    """网格策略真实历史回测"""
    try:
        data = request.get_json() or {}
        etf_code = data.get('etfCode')
        if not etf_code:
            return jsonify({'success': False, 'error': 'ETF代码不能为空'}), 400

        total_capital = float(data.get('totalCapital', data.get('total_capital', 100000)))
        backtest_days = int(data.get('backtestDays', data.get('backtest_days', 180)))
        adjustment_coefficient = float(data.get('adjustmentCoefficient', 1.0))
        scaling_ratio = float(data.get('scalingRatio', data.get('scaling_ratio', 0.0)))
        reinvest_mode = str(data.get('reinvestMode', data.get('reinvest_mode', 'cash')))
        step_mode = str(data.get('stepMode', data.get('step_mode', 'atr')))
        if step_mode not in ['atr', 'fixed_eda']:
            step_mode = 'atr'

        result = etf_service.run_strategy_backtest(
            etf_code=etf_code,
            total_capital=total_capital,
            backtest_days=backtest_days,
            adjustment_coefficient=adjustment_coefficient,
            scaling_ratio=scaling_ratio,
            reinvest_mode=reinvest_mode,
            step_mode=step_mode,
        )

        return jsonify({'success': True, 'data': result})
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        from flask import current_app
        current_app.logger.error(f"策略回测失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'success': False, 'error': f"回测计算异常: {str(e)}"}), 500


@analysis_bp.route('/api/literature/eda-grid', methods=['GET'])
def get_eda_literature():
    """获取 E大网格实战三篇经典文献"""
    try:
        import os
        possible_paths = [
            os.path.join(os.path.dirname(__file__), '..', '..', '..', 'E大', '网格3篇.md'),
            os.path.join(os.getcwd(), 'E大', '网格3篇.md'),
            '/Users/johnny/Desktop/github/etf-grid-design/E大/网格3篇.md',
        ]
        file_path = None
        for p in possible_paths:
            if os.path.exists(p):
                file_path = p
                break

        if not file_path:
            return jsonify({'success': False, 'error': '未找到文献文件'}), 404

        with open(file_path, 'r', encoding='utf-8') as f:
            full_text = f.read()

        # 分割三篇
        parts = full_text.split('# 网格')
        articles = []
        for part in parts:
            part = part.strip()
            if not part:
                continue
            lines = part.split('\n')
            title = lines[0].strip()
            content = '\n'.join(lines[1:]).strip()
            articles.append({
                'id': len(articles) + 1,
                'title': f'网格{title}',
                'content': content,
            })

        return jsonify({
            'success': True,
            'data': {
                'title': 'E大（ETF拯救世界）网格策略全集',
                'author': 'ETF拯救世界',
                'description': '历经十余年实证检验的经典波段与情绪收割系统：1.0基础与压力测试、2.0留利润/逐格加码/一网打尽',
                'articles': articles,
                'total_articles': len(articles),
            }
        })
    except Exception as e:
        from flask import current_app
        current_app.logger.error(f"读取文献失败: {str(e)}")
        return jsonify({'success': False, 'error': f"读取文献失败: {str(e)}"}), 500

