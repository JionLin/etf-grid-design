import React from 'react';
import { Helmet } from 'react-helmet-async';

/**
 * Cloudflare Analytics 组件
 * 
 * @description 负责注入 Cloudflare Web Analytics 脚本，提供网站访问统计功能
 * 使用 defer 属性确保脚本加载不阻塞页面渲染，提升性能
 * 
 * @example
 * // 在应用根组件中使用
 * <CloudflareAnalytics />
 * 
 * @returns {JSX.Element} 包含分析脚本的 Helmet 组件
 */
export default function CloudflareAnalytics() {
  // 本地开发或非生产环境直接不挂载分析脚本，避免 CORS 拦截与控制台报警
  if (
    !import.meta.env.PROD ||
    typeof window === 'undefined' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) {
    return null;
  }

  return (
    <Helmet>
      {/* Cloudflare Web Analytics 脚本 */}
      <script 
        defer 
        src='https://static.cloudflareinsights.com/beacon.min.js' 
        data-cf-beacon='{"token": "39cbec003f7e47c4a4a7cfe7c4c37530"}'
      />
    </Helmet>
  );
}