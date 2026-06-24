# NewChat

一个普通的本地 Chat 类应用：React + Vite 前端，Express 后端，支持 OpenAI 兼容的大模型接口和流式输出。

## 启动

```bash
pnpm install
pnpm dev
```

开发服务会启动：

- 前端：`http://127.0.0.1:5173`
- 后端：`http://127.0.0.1:8787`

## 配置模型

复制 `.env.example` 为 `.env`，填入：

```bash
LLM_API_KEY=你的 API Key
LLM_MODEL=deepseek-v4-flash
LLM_BASE_URL=https://api.deepseek.com
LLM_THINKING=disabled
```

`LLM_BASE_URL` 使用 OpenAI 兼容的 `/chat/completions` 服务地址。DeepSeek 的 OpenAI 兼容地址是 `https://api.deepseek.com`。页面顶栏可以切换 `deepseek-v4-flash` / `deepseek-v4-pro`，也可以临时切换“思考 开/关”，会覆盖 `.env` 里的默认值。没有真实 key 时，可以设置 `LLM_MOCK=1` 验证本地流式 UI。

## 脚本

```bash
pnpm dev      # 同时启动前端和后端
pnpm run server   # 只启动后端
pnpm build    # TypeScript 检查并构建前端
pnpm preview  # 预览构建产物
```
