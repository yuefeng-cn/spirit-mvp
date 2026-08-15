# 目标
一个类 `Claude code` 的 Agent.

## 运行 (MVP)

```bash
cp .env.example .env
# 编辑 .env, 填入 ANTHROPIC_MODEL / ANTHROPIC_API_KEY (可选 ANTHROPIC_BASE_URL)

npm run dev     # tsx 直接运行 src/index.ts
# 或
npm run build && npm start
```

## 工具调用

当前内置一个工具：

- **runBash** — 执行 shell 命令并返回 stdout + stderr。

危险命令会被拦截、不予执行：

- `rm -rf /`
- `sudo`
- `shutdown`
- `reboot`
- `> /dev/`

命令中只要包含上述任意子串即视为危险，返回错误结果而不执行。

