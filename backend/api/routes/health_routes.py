"""
健康检查相关路由模块
包含系统健康检查、版本信息等接口
"""

from flask import Blueprint, jsonify
from datetime import datetime

# 创建健康检查蓝图
health_bp = Blueprint('health', __name__)

# 系统版本号
# 导入版本信息
from config import PROJECT_VERSION

VERSION = PROJECT_VERSION

@health_bp.route('/api/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    from flask import current_app
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'service': 'ETF Grid Trading Analysis System',
        'version': VERSION,
        'environment': current_app.config.get('ENV', 'development')
    })

@health_bp.route('/api/version', methods=['GET'])
def get_version():
    """获取系统版本号"""
    return jsonify({
        'success': True,
        'data': {
            'version': VERSION,
            'timestamp': datetime.now().isoformat()
        }
    })


@health_bp.route('/api/system/sync-status', methods=['GET'])
def get_sync_status():
    """获取系统启动增量同步与矩阵刷新状态"""
    from services.data.startup_sync_service import StartupSyncService
    service = StartupSyncService()
    status = service.get_status()
    return jsonify({
        'success': True,
        'data': status
    })
