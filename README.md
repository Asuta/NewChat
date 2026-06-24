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

如果默认端口被占用，Vite 会自动尝试下一个前端端口；后端也会从 `8787` 开始顺延尝试，例如 `8788`、`8789`。使用 `pnpm dev` 同时启动时，前端代理会自动读取后端实际端口。

## 配置模型

复制 `.env.example` 为 `.env`，填入：

```bash
LLM_API_KEY=你的 API Key
LLM_MODEL=deepseek-v4-flash
LLM_BASE_URL=https://api.deepseek.com
PORT=8787
LLM_THINKING=disabled
```

`LLM_BASE_URL` 使用 OpenAI 兼容的 `/chat/completions` 服务地址。DeepSeek 的 OpenAI 兼容地址是 `https://api.deepseek.com`。页面顶栏可以切换 `deepseek-v4-flash` / `deepseek-v4-pro`，也可以临时切换“思考 开/关”，会覆盖 `.env` 里的默认值。没有真实 key 时，可以设置 `LLM_MOCK=1` 验证本地流式 UI。

### 多 worktree 共享配置

后端会按以下顺序读取配置，后面的文件会覆盖前面的文件，但不会覆盖操作系统环境变量：

1. `NEWCHAT_CONFIG_FILE` 指向的文件。
2. `NEWCHAT_CONFIG_DIR/config.env`。
3. 当前 Git 仓库 common dir 下的 `newchat/config.env`。
4. 当前 worktree 根目录的 `.env`。

推荐把真实 API Key 放在 Git common dir：同一个仓库创建出的多个 `git worktree` 都会读到同一份配置，而且该文件不会进入 Git 提交。

当前仓库的共享配置路径可以用下面命令查看：

```bash
git rev-parse --git-common-dir
```

然后配置文件位置是：

```text
<git-common-dir>/newchat/config.env
```

## 脚本

```bash
pnpm dev      # 同时启动前端和后端
pnpm run server   # 只启动后端
pnpm build    # TypeScript 检查并构建前端
pnpm preview  # 预览构建产物
```
