# Generate Git Message

一个 VSCode 扩展，利用 OpenAI 兼容 API 根据 Git 暂存区的代码变更自动生成规范的 commit message。

## 功能特性

- 一键生成符合 Conventional Commits 规范的中文 commit message
- 支持所有 OpenAI 兼容的 API 端点（OpenAI、DeepSeek、Ollama 等）
- 自定义提示词模板
- 在源代码管理工具栏提供快捷按钮
- 零运行时依赖

## 使用方式

1. 在 VSCode 源代码管理面板中暂存（stage）要提交的文件
2. 点击源代码管理标题栏上的 ✨ 图标，或通过命令面板执行 `生成提交记录`
3. 等待生成完成，commit message 会自动填入输入框

## 配置项

在 VSCode 设置中搜索 `Generate Git Message` 进行配置：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `generateGitMessage.apiBaseUrl` | OpenAI 兼容 API 的基础 URL | `https://api.openai.com/v1` |
| `generateGitMessage.apiKey` | API Key | （空） |
| `generateGitMessage.model` | 模型名称 | `gpt-4o-mini` |
| `generateGitMessage.prompt` | 自定义提示词（为空则使用内置模板） | （空） |
| `generateGitMessage.maxTokens` | 最大生成 token 数（0 表示不限制） | `0` |

## 开发

```bash
pnpm install       # 安装依赖
pnpm build         # 构建
pnpm watch         # 监听模式
pnpm package       # 生产构建（压缩）
pnpm vsix          # 构建并打包为 .vsix 安装包
```

## 许可证

MIT
