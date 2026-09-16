import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LoadingSpinner } from "@shared/components/ui";

const HomePage = lazy(() => import("@pages/HomePage"));
const AnalysisPage = lazy(() => import("@pages/AnalysisPage"));
const GridFitPage = lazy(() => import("@pages/GridFitPage"));

/**
 * 应用路由配置组件
 * 负责管理应用的所有路由匹配（外层已由 App.jsx 提供 Router 上下文）
 */
export default function AppRouter() {
  return (
    <Suspense fallback={<LoadingSpinner message="页面加载中..." />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/analysis/:etfCode" element={<AnalysisPage />} />
        <Route path="/grid-fit" element={<GridFitPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
