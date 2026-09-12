#!/bin/bash

# ETF网格交易策略设计工具一键启动脚本

echo "🚀 启动ETF网格交易策略设计工具..."
echo "=================================="

# 检查指定端口是否处于监听状态
check_port() {
    local port=$1
    if command -v lsof >/dev/null 2>&1; then
        lsof -i :"$port" -sTCP:LISTEN >/dev/null 2>&1
        return $?
    fi
    if command -v nc >/dev/null 2>&1; then
        nc -z 127.0.0.1 "$port" >/dev/null 2>&1
        return $?
    fi
    return 1
}

BACKEND_PID=""
FRONTEND_PID=""

# 1. 检查后端服务 (端口 5001)
if check_port 5001; then
    echo "✅ 后端服务已在运行 (端口 5001 活跃)"
else
    echo "📦 启动后端服务..."
    uv run python backend/app.py &
    BACKEND_PID=$!
    for i in {1..12}; do
        if check_port 5001; then
            break
        fi
        sleep 0.5
    done
fi

# 2. 检查前端服务 (端口 3000)
if check_port 3000; then
    echo "✅ 前端服务已在运行 (端口 3000 活跃)"
else
    echo "📦 启动前端服务..."
    (cd frontend && npm run dev) &
    FRONTEND_PID=$!
    for i in {1..15}; do
        if check_port 3000; then
            break
        fi
        sleep 0.5
    done
fi

echo ""
echo "🎉 服务启动完成！"
echo "=================="
echo "🌐 前端应用: http://localhost:3000"
echo "🔧 后端API: http://localhost:5001"
echo ""
echo "💡 使用提示："
echo "  - 在浏览器中打开前端地址开始使用"
echo "  - 确保已正确配置 .env 文件中的 TUSHARE_TOKEN"
echo "  - 推荐使用热门ETF代码：510300, 510500, 159915 等"
echo ""
echo "⚠️  按 Ctrl+C 停止服务"
echo ""

cleanup() {
    echo ""
    echo "🛑 正在停止服务..."
    if [ -n "$FRONTEND_PID" ]; then
        kill -TERM "$FRONTEND_PID" 2>/dev/null
    fi
    if [ -n "$BACKEND_PID" ]; then
        kill -TERM "$BACKEND_PID" 2>/dev/null
    fi
    pkill -f "python.*backend/app.py" 2>/dev/null
    pkill -f "vite" 2>/dev/null
    exit 0
}

trap cleanup INT TERM
wait
