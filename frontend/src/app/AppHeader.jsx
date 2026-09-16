import React, { lazy, Suspense, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Waypoints, Github, BookOpen, LayoutDashboard, Trophy } from "lucide-react";
import { getVersion } from "@shared/services/api";

const EdaLiteratureDrawer = lazy(() => import("@features/literature/components/EdaLiteratureDrawer"));

/**
 * 应用头部组件
 * 负责全局品牌回退、主导航切换胶囊、E大文献抽屉与版本信息
 */
export default function AppHeader() {
  const [version, setVersion] = useState("v1.0.0");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await getVersion();
        if (response.success && response.data.version) {
          setVersion(`v${response.data.version}`);
        }
      } catch (error) {
        console.error("获取版本号失败:", error);
      }
    };

    fetchVersion();
  }, []);

  const isStrategyActive =
    location.pathname === "/" || location.pathname.startsWith("/analysis");
  const isGridFitActive = location.pathname.startsWith("/grid-fit");

  return (
    <header className="bg-white/95 backdrop-blur-md shadow-xs border-b border-gray-200/80 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-2 sm:gap-4">
          {/* 1. Logo与品牌回退链接 */}
          <Link
            to="/"
            className="flex items-center gap-2.5 sm:gap-3 group shrink-0"
            title="返回首页策略设计器"
          >
            <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl shadow-xs group-hover:shadow-indigo-200 group-hover:scale-105 transition-all">
              <Waypoints className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg sm:text-xl font-black text-gray-900 tracking-tight group-hover:text-indigo-600 transition-colors">
                  ETFer.Top
                </span>
                <span className="hidden xs:inline-block text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/60">
                  QUANT
                </span>
              </div>
              <p className="text-[11px] text-gray-400 hidden md:block">
                基于ATR算法的智能网格交易策略设计工具
              </p>
            </div>
          </Link>

          {/* 2. 全局主导航切换胶囊 */}
          <nav className="flex items-center bg-gray-100/90 p-1 rounded-xl border border-gray-200/60 text-xs shadow-2xs shrink-0">
            <Link
              to="/"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                isStrategyActive
                  ? "bg-white text-indigo-600 font-bold shadow-xs"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-indigo-500" />
              <span>策略工作台</span>
            </Link>

            <Link
              to="/grid-fit"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                isGridFitActive
                  ? "bg-white text-indigo-600 font-bold shadow-xs"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span>网格适合度榜</span>
            </Link>
          </nav>

          {/* 3. 辅助功能区：E大文献抽屉与 GitHub 链接 */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* E大实战文献阅读入口 */}
            <button
              type="button"
              onClick={() => {
                setDrawerMounted(true);
                setIsDrawerOpen(true);
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold text-amber-900 bg-gradient-to-r from-amber-100 to-amber-200/80 hover:from-amber-200 hover:to-amber-300 border border-amber-300/80 shadow-2xs transition-all cursor-pointer"
              title="点击阅读 E大（ETF拯救世界）网格三篇真迹"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-700" />
              <span className="hidden sm:inline">📚 E大网格文献</span>
              <span className="sm:hidden">文献</span>
            </button>

            {/* GitHub 入口 */}
            <a
              href="https://github.com/jorben/etf-grid-design"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-xs font-mono"
              title="查看开源仓库"
            >
              <Github className="w-4 h-4" />
              <span className="hidden lg:inline">{version}</span>
            </a>
          </div>
        </div>
      </div>

      {/* E大实战文献阅读抽屉 */}
      {drawerMounted && (
        <Suspense fallback={null}>
          <EdaLiteratureDrawer
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
          />
        </Suspense>
      )}
    </header>
  );
}
