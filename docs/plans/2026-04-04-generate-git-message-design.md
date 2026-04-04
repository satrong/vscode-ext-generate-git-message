# Generate Git Message - VSCode 插件设计文档

## 概述

在 VSCode 的 Source Control 面板标题栏添加一个按钮，点击后根据 staged 文件的 diff 内容调用 AI 生成 commit message，并自动填入 commit 输入框。

## 技术选型

- **语言**: TypeScript
- **AI API**: OpenAI 兼容 API（支持 OpenAI、DeepSeek、通义千问等）
- **Git 操作**: VSCode 内置 Git 扩展 API
- **HTTP 请求**: Node.js 内置 fetch
- **构建工具**: esbuild（通过 @vscode/vsce 打包）

## 架构方案

使用 VSCode 内置 Git API（`vscode.extensions.getExtension('vscode.git')`），直接操作 Source Control 面板。

## 核心工作流

```
点击按钮 → 获取 staged diff → 调用 AI API → 填入 commit 输入框
```

### 1. 按钮注册

- 注册 Command: `generateCommitMessage.generate`
- 在 `package.json` menus 中配置为 `scm/title` 位置
- 图标使用 Sparkle 图标

### 2. 获取 staged diff

- 通过 Git API 的 `repository.state.indexChanges` 获取 staged 文件列表
- 调用 `repository.diff(true)` 获取 staged diff（参数 `true` 表示 cached/staged）

### 3. 调用 AI API

- 使用 Node.js fetch 向 OpenAI 兼容的 `/chat/completions` 端点发送请求
- 请求体包含 system prompt + diff 内容

### 4. 填入 commit 输入框

- 通过 `repository.inputBox.value = generatedMessage` 写入
- 失败时通过 `vscode.window.showErrorMessage` 提示

## 可配置项

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `generateCommitMessage.apiBaseUrl` | API 基础 URL | `https://api.openai.com/v1` |
| `generateCommitMessage.apiKey` | API Key | 空 |
| `generateCommitMessage.model` | 模型名称 | `gpt-4o-mini` |
| `generateCommitMessage.prompt` | 自定义提示词 | 内置默认提示词 |
| `generateCommitMessage.maxTokens` | 最大 token 数 | `256` |

### 默认提示词

> 根据 git diff 生成简洁的 commit message，使用 conventional commits 格式（如 feat/fix/refactor 等）。仅输出 commit message，不要其他内容。

## 项目结构

```
src/
  extension.ts          # 插件入口，注册命令和配置
  gitApi.ts             # VSCode Git API 封装
  aiProvider.ts         # AI API 调用封装
  config.ts             # 配置读取
package.json            # 插件元数据、命令、菜单、配置声明
tsconfig.json
```

## 错误处理

- 无 staged 文件: `showWarningMessage('没有暂存的文件')`
- API Key 未配置: `showErrorMessage('请先配置 API Key')`
- API 调用失败: `showErrorMessage` 显示错误详情
