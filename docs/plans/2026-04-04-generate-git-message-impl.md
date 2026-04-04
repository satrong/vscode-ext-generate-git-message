# Generate Git Message 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 开发一个 VSCode 插件，在 Source Control 面板标题栏添加按钮，点击后根据 staged 文件 diff 调用 AI 生成 commit message 并自动填入输入框。

**Architecture:** 使用 VSCode 内置 Git 扩展 API（`vscode.git`）获取 staged diff 和操作 commit 输入框，通过 OpenAI 兼容 API（`/chat/completions`）调用 AI 模型，所有配置通过 VSCode Settings 管理。

**Tech Stack:** TypeScript, VSCode Extension API, Node.js fetch, esbuild, @vscode/vsce

---

## Task 1: 项目脚手架初始化

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.vscodeignore`
- Create: `.gitignore`

**Step 1: 初始化 npm 项目并安装依赖**

```bash
cd /Users/satrong/code/dev/vscode-ext-generate-git-message
npm init -y
npm install --save-dev typescript @types/vscode esbuild
```

**Step 2: 创建 `package.json`**

用以下内容完全替换 `package.json`：

```json
{
  "name": "generate-git-message",
  "displayName": "Generate Git Message",
  "description": "根据 staged 文件生成 AI commit message",
  "version": "0.0.1",
  "publisher": "local",
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": [
    "SCM Providers"
  ],
  "activationEvents": [
    "onCommand:generateGitMessage.generate"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "generateGitMessage.generate",
        "title": "Generate Commit Message",
        "icon": "$(sparkle)"
      }
    ],
    "menus": {
      "scm/title": [
        {
          "command": "generateGitMessage.generate",
          "when": "scmProvider == git",
          "group": "navigation"
        }
      ]
    },
    "configuration": {
      "title": "Generate Git Message",
      "properties": {
        "generateGitMessage.apiBaseUrl": {
          "type": "string",
          "default": "https://api.openai.com/v1",
          "description": "OpenAI 兼容 API 的基础 URL"
        },
        "generateGitMessage.apiKey": {
          "type": "string",
          "default": "",
          "description": "API Key"
        },
        "generateGitMessage.model": {
          "type": "string",
          "default": "gpt-4o-mini",
          "description": "模型名称"
        },
        "generateGitMessage.prompt": {
          "type": "string",
          "default": "根据 git diff 生成简洁的 commit message，使用 conventional commits 格式（如 feat/fix/refactor 等）。仅输出 commit message，不要其他内容。",
          "description": "自定义提示词"
        },
        "generateGitMessage.maxTokens": {
          "type": "number",
          "default": 256,
          "description": "最大生成 token 数"
        }
      }
    }
  },
  "scripts": {
    "build": "esbuild src/extension.ts --bundle --outfile=dist/extension.js --external:vscode --format=cjs --platform=node",
    "watch": "esbuild src/extension.ts --bundle --outfile=dist/extension.js --external:vscode --format=cjs --platform=node --watch",
    "package": "npm run build -- --minify"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "esbuild": "^0.20.0",
    "typescript": "^5.4.0"
  }
}
```

**Step 3: 创建 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**Step 4: 创建 `.vscodeignore`**

```
.vscode/**
src/**
node_modules/**
tsconfig.json
.gitignore
docs/**
```

**Step 5: 创建 `.gitignore`**

```
node_modules/
dist/
*.vsix
```

**Step 6: 安装依赖**

```bash
npm install
```

**Step 7: 初始化 git 并提交**

```bash
git init
git add package.json tsconfig.json .vscodeignore .gitignore package-lock.json
git commit -m "chore: initialize project scaffold"
```

---

## Task 2: Git API 类型定义和封装

**Files:**
- Create: `src/git.d.ts`
- Create: `src/gitApi.ts`

**Step 1: 创建 Git API 类型定义 `src/git.d.ts`**

从 VSCode 源码复制关键类型定义，供 TypeScript 编译使用：

```typescript
import { Uri, Event, Disposable, ProviderResult, Command, CancellationToken } from 'vscode';

export interface InputBox {
    value: string;
}

export interface Change {
    readonly uri: Uri;
    readonly originalUri: Uri;
    readonly renameUri: Uri | undefined;
    readonly status: Status;
}

export const enum Status {
    INDEX_MODIFIED,
    INDEX_ADDED,
    INDEX_DELETED,
    INDEX_RENAMED,
    INDEX_COPIED,
    MODIFIED,
    DELETED,
    UNTRACKED,
    IGNORED,
}

export interface RepositoryState {
    readonly HEAD: Branch | undefined;
    readonly indexChanges: Change[];
    readonly workingTreeChanges: Change[];
    readonly onDidChange: Event<void>;
}

export interface Repository {
    readonly rootUri: Uri;
    readonly inputBox: InputBox;
    readonly state: RepositoryState;
    diff(cached?: boolean): Promise<string>;
}

export interface API {
    readonly state: 'uninitialized' | 'initialized';
    readonly repositories: Repository[];
    readonly onDidOpenRepository: Event<Repository>;
    readonly onDidCloseRepository: Event<Repository>;
}

export interface GitExtension {
    readonly enabled: boolean;
    readonly onDidChangeEnablement: Event<boolean>;
    getAPI(version: 1): API;
}
```

**Step 2: 创建 Git API 封装 `src/gitApi.ts`**

```typescript
import * as vscode from 'vscode';
import { GitExtension, API, Repository } from './git';

export async function getGitAPI(): Promise<API | undefined> {
    const extension = vscode.extensions.getExtension<GitExtension>('vscode.git');
    if (!extension) {
        return undefined;
    }
    const gitExtension = extension.isActive ? extension.exports : await extension.activate();
    return gitExtension.getAPI(1);
}

export function getRepository(api: API): Repository | undefined {
    return api.repositories[0];
}
```

**Step 3: 提交**

```bash
git add src/git.d.ts src/gitApi.ts
git commit -m "feat: add Git API type definitions and wrapper"
```

---

## Task 3: 配置读取模块

**Files:**
- Create: `src/config.ts`

**Step 1: 创建 `src/config.ts`**

```typescript
import * as vscode from 'vscode';

const SECTION = 'generateGitMessage';

export interface Config {
    apiBaseUrl: string;
    apiKey: string;
    model: string;
    prompt: string;
    maxTokens: number;
}

export function getConfig(): Config {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    return {
        apiBaseUrl: cfg.get<string>('apiBaseUrl', 'https://api.openai.com/v1'),
        apiKey: cfg.get<string>('apiKey', ''),
        model: cfg.get<string>('model', 'gpt-4o-mini'),
        prompt: cfg.get<string>('prompt', '根据 git diff 生成简洁的 commit message，使用 conventional commits 格式（如 feat/fix/refactor 等）。仅输出 commit message，不要其他内容。'),
        maxTokens: cfg.get<number>('maxTokens', 256),
    };
}
```

**Step 2: 提交**

```bash
git add src/config.ts
git commit -m "feat: add configuration reader module"
```

---

## Task 4: AI API 调用封装

**Files:**
- Create: `src/aiProvider.ts`

**Step 1: 创建 `src/aiProvider.ts`**

```typescript
import { Config } from './config';

export async function generateCommitMessage(config: Config, diff: string): Promise<string> {
    const url = `${config.apiBaseUrl.replace(/\/+$/, '')}/chat/completions`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
            model: config.model,
            max_tokens: config.maxTokens,
            messages: [
                { role: 'system', content: config.prompt },
                { role: 'user', content: `Here is the git diff:\n\n${diff}` },
            ],
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API request failed (${response.status}): ${text}`);
    }

    const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
    };

    if (!data.choices?.[0]?.message?.content) {
        throw new Error('API returned empty response');
    }

    return data.choices[0].message.content.trim();
}
```

**Step 2: 提交**

```bash
git add src/aiProvider.ts
git commit -m "feat: add AI API provider with OpenAI compatible endpoint"
```

---

## Task 5: 插件入口和命令注册

**Files:**
- Create: `src/extension.ts`

**Step 1: 创建 `src/extension.ts`**

```typescript
import * as vscode from 'vscode';
import { getGitAPI, getRepository } from './gitApi';
import { getConfig } from './config';
import { generateCommitMessage } from './aiProvider';

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('generateGitMessage.generate', async () => {
        const config = getConfig();

        if (!config.apiKey) {
            vscode.window.showErrorMessage('请先在设置中配置 generateGitMessage.apiKey');
            return;
        }

        const gitApi = await getGitAPI();
        if (!gitApi) {
            vscode.window.showErrorMessage('无法获取 Git 扩展 API');
            return;
        }

        const repo = getRepository(gitApi);
        if (!repo) {
            vscode.window.showErrorMessage('未找到 Git 仓库');
            return;
        }

        if (repo.state.indexChanges.length === 0) {
            vscode.window.showWarningMessage('没有暂存的文件，请先 stage 要提交的更改');
            return;
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: '正在生成 commit message...',
                cancellable: false,
            },
            async () => {
                try {
                    const diff = await repo.diff(true);
                    if (!diff.trim()) {
                        vscode.window.showWarningMessage('暂存区 diff 为空');
                        return;
                    }
                    const message = await generateCommitMessage(config, diff);
                    repo.inputBox.value = message;
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    vscode.window.showErrorMessage(`生成失败: ${msg}`);
                }
            }
        );
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
```

**Step 2: 构建验证**

```bash
npm run build
```

Expected: 构建成功，`dist/extension.js` 生成

**Step 3: 提交**

```bash
git add src/extension.ts
git commit -m "feat: add extension entry point with generate command"
```

---

## Task 6: 本地测试验证

**Step 1: 构建插件**

```bash
npm run build
```

**Step 2: 在 VSCode 中调试**

1. 在项目根目录按 F5 启动 Extension Development Host
2. 在新窗口中打开一个 git 仓库
3. 创建一些修改并 stage 文件
4. 在 Source Control 面板标题栏点击 sparkle 按钮
5. 验证：
   - 无 staged 文件时显示 warning
   - API Key 未配置时显示 error
   - 有 staged 文件且配置正确后，commit 输入框被填入生成的 message

**Step 3: 最终提交**

如有修复，提交所有改动。
