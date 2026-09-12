## 1. 修复与验证

- [x] 1.1 修改 `frontend/src/shared/utils/url.js` 中 `roundNum` 调用为原生 `Math.round(val * 100) / 100`，并通过脚本验证 `validateAndCompleteParams` 执行无异常
- [x] 1.2 运行前端 `npm run build` 打包构建，并在真实浏览器中验证自定义 ATR 参数跳转后白屏彻底消除且各卡片正常渲染
