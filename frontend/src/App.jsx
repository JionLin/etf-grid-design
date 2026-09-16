import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import AppRouter from "./app/AppRouter";
import AppLayout from "./app/AppLayout";
import "./App.css";

/**
 * 主应用组件
 * 负责提供全局路由上下文、SEO Helmet 和通用应用布局
 */
function App() {
  return (
    <HelmetProvider>
      <Router>
        <AppLayout>
          <AppRouter />
        </AppLayout>
      </Router>
    </HelmetProvider>
  );
}

export default App;
