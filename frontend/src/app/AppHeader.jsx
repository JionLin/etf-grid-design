import React, { useState, useEffect } from "react";
import { Waypoints, Github, BookOpen } from "lucide-react";
import { getVersion } from "@shared/services/api";
import EdaLiteratureDrawer from "@features/literature/components/EdaLiteratureDrawer";

/**
 * 应用头部组件
 * 负责显示logo、标题、导航和版本信息
 */
export default function AppHeader() {
  const [version, setVersion] = useState("v1.0.0");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo和标题 */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg">
              <Waypoints className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">ETFer.Top</h1>
              <p className="text-sm text-gray-600">
                基于ATR算法的智能网格交易策略设计工具
              </p>
            </div>
          </div>

          {/* 导航链接与文献入口 */}
          <div className="flex items-center gap-3">
            {/* E大实战文献入口 */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-900 bg-gradient-to-r from-amber-100 to-amber-200/80 hover:from-amber-200 hover:to-amber-300 border border-amber-300 shadow-2xs transition-all cursor-pointer"
              title="点击阅读 E大（ETF拯救世界）网格三篇真迹"
            >
              <BookOpen className="w-4 h-4 text-amber-700" />
              <span>📚 E大网格实战文献</span>
            </button>

            <a
              href="https://github.com/jorben/etf-grid-design"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Github className="w-4 h-4" />
              <span className="text-sm">GitHub {version}</span>
            </a>
          </div>
        </div>
      </div>

      {/* E大实战文献阅读抽屉 */}
      <EdaLiteratureDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </header>
  );
}
