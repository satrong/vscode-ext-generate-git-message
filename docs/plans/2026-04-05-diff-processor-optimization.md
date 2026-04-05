# Diff 预处理优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建 diff 预处理模块，解决三个问题：大量文件时硬截断丢失信息、二进制文件 diff 几乎为空、删除文件浪费字符预算。

**Architecture:** 新建 `src/diffProcessor.ts` 模块，接收原始 diff 字符串和文件变更列表，输出包含"文件清单 + 精简 diff"的结构化文本。模块使用纯数据接口（不依赖 VSCode API），便于单元测试。修改 `extension.ts` 集成调用，简化 `aiProvider.ts` 移除旧截断逻辑。

**Tech Stack:** TypeScript, Vitest（测试框架）, Node.js path

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/diffProcessor.ts` | Create | 解析、分类、精简 diff 的核心模块 |
| `src/diffProcessor.test.ts` | Create | diffProcessor 单元测试 |
| `src/extension.ts` | Modify | 集成 diffProcessor，转换 VSCode 类型 |
| `src/aiProvider.ts` | Modify | 移除 MAX_DIFF_LENGTH 截断逻辑 |

---

### Task 1: 搭建 Vitest 测试框架

**Files:**
- Modify: `package.json`（添加依赖和 test 脚本）

- [ ] **Step 1: 安装 vitest**

```bash
pnpm add -D vitest
```

- [ ] **Step 2: 在 `package.json` 中添加 test 脚本**

在 `scripts` 中添加：

```json
"test": "vitest run"
```

- [ ] **Step 3: 创建一个冒烟测试验证框架可用**

创建 `src/diffProcessor.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';

describe('diffProcessor', () => {
    it('smoke test', () => {
        expect(1 + 1).toBe(2);
    });
});
```

- [ ] **Step 4: 运行测试**

```bash
pnpm test
```

Expected: 1 test passed

- [ ] **Step 5: 提交**

```bash
git add package.json pnpm-lock.yaml src/diffProcessor.test.ts
git commit -m "chore: set up vitest test framework"
```

---

### Task 2: 实现 diff chunk 解析器

**Files:**
- Create: `src/diffProcessor.ts`（增量添加）
- Modify: `src/diffProcessor.test.ts`

目标：将原始 diff 字符串按文件拆分为独立的 chunk。

- [ ] **Step 1: 编写 chunk 解析的测试**

追加到 `src/diffProcessor.test.ts`：

```typescript
import { parseDiffChunks } from './diffProcessor';

describe('parseDiffChunks', () => {
    it('应将多文件 diff 拆分为独立 chunk', () => {
        const rawDiff = `diff --git a/file1.ts b/file1.ts
index abc..def 100644
--- a/file1.ts
+++ b/file1.ts
@@ -1,3 +1,3 @@
 aaa
-bbb
+BBB
 ccc

diff --git a/file2.ts b/file2.ts
index 123..456 100644
--- a/file2.ts
+++ b/file2.ts
@@ -1,2 +1,3 @@
 xxx
+yyy
 zzz`;

        const chunks = parseDiffChunks(rawDiff);
        expect(chunks).toHaveLength(2);
        expect(chunks[0].filePath).toBe('file1.ts');
        expect(chunks[0].content).toContain('-bbb');
        expect(chunks[1].filePath).toBe('file2.ts');
        expect(chunks[1].content).toContain('+yyy');
    });

    it('空 diff 应返回空数组', () => {
        expect(parseDiffChunks('')).toHaveLength(0);
        expect(parseDiffChunks('   ')).toHaveLength(0);
    });

    it('单文件 diff 应返回单个 chunk', () => {
        const rawDiff = `diff --git a/solo.ts b/solo.ts
--- a/solo.ts
+++ b/solo.ts
@@ -1 +1 @@
-old
+new`;

        const chunks = parseDiffChunks(rawDiff);
        expect(chunks).toHaveLength(1);
        expect(chunks[0].filePath).toBe('solo.ts');
    });

    it('应正确提取含子目录的文件路径', () => {
        const rawDiff = `diff --git a/src/utils/helper.ts b/src/utils/helper.ts
--- a/src/utils/helper.ts
+++ b/src/utils/helper.ts
@@ -1 +1 @@
-a
+b`;

        const chunks = parseDiffChunks(rawDiff);
        expect(chunks[0].filePath).toBe('src/utils/helper.ts');
    });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm test
```

Expected: FAIL — `parseDiffChunks` 未导出

- [ ] **Step 3: 实现 `parseDiffChunks`**

替换 `src/diffProcessor.ts` 全部内容：

```typescript
export interface DiffChunk {
    filePath: string;
    content: string;
}

export function parseDiffChunks(rawDiff: string): DiffChunk[] {
    const trimmed = rawDiff.trim();
    if (!trimmed) {
        return [];
    }

    // 找到所有 "diff --git" 的起始位置
    const positions: number[] = [];
    let searchFrom = 0;
    while (true) {
        const idx = trimmed.indexOf('diff --git', searchFrom);
        if (idx === -1) break;
        positions.push(idx);
        searchFrom = idx + 1;
    }

    if (positions.length === 0) {
        return [];
    }

    const chunks: DiffChunk[] = [];
    for (let i = 0; i < positions.length; i++) {
        const start = positions[i];
        const end = i + 1 < positions.length ? positions[i + 1] : trimmed.length;
        const content = trimmed.slice(start, end).trim();

        // 从 "diff --git a/path b/path" 提取文件路径
        const match = content.match(/^diff --git a\/(.+?) b\/(.+)/m);
        if (match) {
            chunks.push({
                filePath: match[2],
                content,
            });
        }
    }

    return chunks;
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
pnpm test
```

Expected: 所有测试 PASS

- [ ] **Step 5: 提交**

```bash
git add src/diffProcessor.ts src/diffProcessor.test.ts
git commit -m "feat: implement diff chunk parser"
```

---

### Task 3: 实现文件变更摘要生成

**Files:**
- Modify: `src/diffProcessor.ts`
- Modify: `src/diffProcessor.test.ts`

目标：从文件变更列表生成可读的摘要，让 AI 始终能看到所有变更文件。

- [ ] **Step 1: 定义 FileChange 接口并编写测试**

追加到 `src/diffProcessor.test.ts`：

```typescript
import { buildFileSummary, FileChange } from './diffProcessor';

describe('buildFileSummary', () => {
    it('应生成文件变更摘要', () => {
        const changes: FileChange[] = [
            { path: 'src/auth.ts', status: 'added' },
            { path: 'src/api.ts', status: 'modified' },
            { path: 'src/old.ts', status: 'deleted' },
            { path: 'src/utils.ts', status: 'renamed', oldPath: 'src/helpers.ts' },
        ];

        const summary = buildFileSummary(changes);
        expect(summary).toContain('[新增] src/auth.ts');
        expect(summary).toContain('[修改] src/api.ts');
        expect(summary).toContain('[删除] src/old.ts');
        expect(summary).toContain('[重命名] src/helpers.ts → src/utils.ts');
    });

    it('空列表应返回空字符串', () => {
        expect(buildFileSummary([])).toBe('');
    });

    it('应处理 copied 状态', () => {
        const changes: FileChange[] = [
            { path: 'src/copy.ts', status: 'copied', oldPath: 'src/orig.ts' },
        ];
        const summary = buildFileSummary(changes);
        expect(summary).toContain('[复制] src/orig.ts → src/copy.ts');
    });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm test
```

Expected: FAIL — `buildFileSummary` 和 `FileChange` 未导出

- [ ] **Step 3: 实现 `FileChange` 和 `buildFileSummary`**

在 `src/diffProcessor.ts` 顶部添加：

```typescript
export interface FileChange {
    path: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
    oldPath?: string;
}

const STATUS_LABELS: Record<FileChange['status'], string> = {
    added: '新增',
    modified: '修改',
    deleted: '删除',
    renamed: '重命名',
    copied: '复制',
};

export function buildFileSummary(changes: readonly FileChange[]): string {
    if (changes.length === 0) {
        return '';
    }

    return changes.map(c => {
        const label = STATUS_LABELS[c.status];
        if (c.status === 'renamed' && c.oldPath) {
            return `[${label}] ${c.oldPath} → ${c.path}`;
        }
        if (c.status === 'copied' && c.oldPath) {
            return `[${label}] ${c.oldPath} → ${c.path}`;
        }
        return `[${label}] ${c.path}`;
    }).join('\n');
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
pnpm test
```

Expected: 所有测试 PASS

- [ ] **Step 5: 提交**

```bash
git add src/diffProcessor.ts src/diffProcessor.test.ts
git commit -m "feat: implement file change summary builder"
```

---

### Task 4: 实现 chunk 分类处理（二进制文件 + 删除文件）

**Files:**
- Modify: `src/diffProcessor.ts`
- Modify: `src/diffProcessor.test.ts`

目标：识别二进制文件和纯删除文件的 chunk，生成精简描述。

- [ ] **Step 1: 编写分类处理测试**

追加到 `src/diffProcessor.test.ts`：

```typescript
import { processChunk } from './diffProcessor';

describe('processChunk', () => {
    it('二进制文件应替换为一行说明', () => {
        const chunk: DiffChunk = {
            filePath: 'assets/logo.png',
            content: `diff --git a/assets/logo.png b/assets/logo.png
new file mode 100644
index 0000000..abc1234
Binary files /dev/null and b/assets/logo.png differ`,
        };
        const result = processChunk(chunk, 'added');
        expect(result).toBe('[二进制文件 新增]: assets/logo.png');
    });

    it('二进制文件修改应显示修改状态', () => {
        const chunk: DiffChunk = {
            filePath: 'public/favicon.ico',
            content: `diff --git a/public/favicon.ico b/public/favicon.ico
index abc..def 100644
Binary files a/public/favicon.ico and b/public/favicon.ico differ`,
        };
        const result = processChunk(chunk, 'modified');
        expect(result).toBe('[二进制文件 修改]: public/favicon.ico');
    });

    it('删除文件应替换为一行摘要含行数', () => {
        const chunk: DiffChunk = {
            filePath: 'src/deprecated.ts',
            content: `diff --git a/src/deprecated.ts b/src/deprecated.ts
deleted file mode 100644
index abc..000
--- a/src/deprecated.ts
+++ /dev/null
@@ -1,5 +0,0 @@
-line1
-line2
-line3
-line4
-line5`,
        };
        const result = processChunk(chunk, 'deleted');
        expect(result).toBe('[删除] src/deprecated.ts (共 5 行)');
    });

    it('普通文件应保留完整 diff', () => {
        const content = `diff --git a/src/api.ts b/src/api.ts
index abc..def 100644
--- a/src/api.ts
+++ b/src/api.ts
@@ -1,3 +1,3 @@
 aaa
-bbb
+BBB
 ccc`;
        const chunk: DiffChunk = {
            filePath: 'src/api.ts',
            content,
        };
        const result = processChunk(chunk, 'modified');
        expect(result).toBe(content);
    });
});
```

需要在测试文件顶部添加 `DiffChunk` 的导入（如果还没导入的话）：

```typescript
import { parseDiffChunks, buildFileSummary, FileChange, DiffChunk, processChunk } from './diffProcessor';
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm test
```

Expected: FAIL — `processChunk` 未导出

- [ ] **Step 3: 实现 `processChunk`**

在 `src/diffProcessor.ts` 中添加：

```typescript
export function processChunk(chunk: DiffChunk, status: FileChange['status']): string {
    // 二进制文件检测
    if (chunk.content.includes('Binary files')) {
        const statusLabel = STATUS_LABELS[status];
        return `[二进制文件 ${statusLabel}]: ${chunk.filePath}`;
    }

    // 纯删除文件检测（diff 中有 "deleted file mode" 或 +++ /dev/null）
    if (isDeletionChunk(chunk.content)) {
        const lineCount = countRemovedLines(chunk.content);
        return `[删除] ${chunk.filePath} (共 ${lineCount} 行)`;
    }

    // 普通文件，保留完整 diff
    return chunk.content;
}

function isDeletionChunk(content: string): boolean {
    return content.includes('+++ /dev/null') || content.includes('deleted file mode');
}

function countRemovedLines(content: string): number {
    // 统计以 - 开头的变更行（排除 --- a/path 元数据行）
    let count = 0;
    for (const line of content.split('\n')) {
        if (line.startsWith('-') && !line.startsWith('---')) {
            count++;
        }
    }
    return count;
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
pnpm test
```

Expected: 所有测试 PASS

- [ ] **Step 5: 提交**

```bash
git add src/diffProcessor.ts src/diffProcessor.test.ts
git commit -m "feat: implement chunk classification for binary and deleted files"
```

---

### Task 5: 实现智能截断

**Files:**
- Modify: `src/diffProcessor.ts`
- Modify: `src/diffProcessor.test.ts`

目标：当总 diff 超过字符预算时，优先保证文件清单完整，逐文件填充 diff 内容。

- [ ] **Step 1: 编写截断测试**

追加到 `src/diffProcessor.test.ts`：

```typescript
import { smartTruncate } from './diffProcessor';

describe('smartTruncate', () => {
    it('未超预算应原样返回', () => {
        const chunks = ['chunk1', 'chunk2'];
        const result = smartTruncate(chunks, 1000);
        expect(result.content).toBe('chunk1\n\nchunk2');
        expect(result.truncated).toBe(false);
    });

    it('超预算应截断并标记', () => {
        const chunks = [
            'a'.repeat(6000),
            'b'.repeat(6000),
        ];
        const result = smartTruncate(chunks, 10000);
        expect(result.truncated).toBe(true);
        expect(result.content).toContain('a'.repeat(6000));
        expect(result.content).not.toContain('b'.repeat(6000));
        expect(result.content).toContain('部分文件的详细 diff 已省略');
    });

    it('空 chunks 应返回空', () => {
        const result = smartTruncate([], 1000);
        expect(result.content).toBe('');
        expect(result.truncated).toBe(false);
    });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm test
```

Expected: FAIL — `smartTruncate` 未导出

- [ ] **Step 3: 实现 `smartTruncate`**

在 `src/diffProcessor.ts` 中添加：

```typescript
interface TruncateResult {
    content: string;
    truncated: boolean;
}

export function smartTruncate(chunks: string[], budget: number): TruncateResult {
    if (chunks.length === 0) {
        return { content: '', truncated: false };
    }

    const included: string[] = [];
    let totalLength = 0;
    let truncated = false;

    for (const chunk of chunks) {
        const separator = included.length > 0 ? '\n\n' : '';
        const addedLength = separator.length + chunk.length;

        if (totalLength + addedLength <= budget) {
            included.push(chunk);
            totalLength += addedLength;
        } else {
            truncated = true;
            break;
        }
    }

    let content = included.join('\n\n');
    if (truncated) {
        content += '\n\n... (部分文件的详细 diff 已省略，请根据文件清单生成)';
    }

    return { content, truncated };
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
pnpm test
```

Expected: 所有测试 PASS

- [ ] **Step 5: 提交**

```bash
git add src/diffProcessor.ts src/diffProcessor.test.ts
git commit -m "feat: implement smart truncation with character budget"
```

---

### Task 6: 组装 `processDiff` 主函数

**Files:**
- Modify: `src/diffProcessor.ts`
- Modify: `src/diffProcessor.test.ts`

目标：将前面的函数组装成 `processDiff` 主入口。

- [ ] **Step 1: 编写 processDiff 集成测试**

追加到 `src/diffProcessor.test.ts`：

```typescript
import { processDiff } from './diffProcessor';

describe('processDiff', () => {
    it('应生成包含文件清单和 diff 的结构化输出', () => {
        const rawDiff = `diff --git a/src/auth.ts b/src/auth.ts
new file mode 100644
--- /dev/null
+++ b/src/auth.ts
@@ -0,0 +1,3 @@
+import { Auth } from './lib';
+
+export const auth = new Auth();`;

        const changes: FileChange[] = [
            { path: 'src/auth.ts', status: 'added' },
        ];

        const result = processDiff(rawDiff, changes);

        expect(result).toContain('## 文件变更清单');
        expect(result).toContain('[新增] src/auth.ts');
        expect(result).toContain('## 详细变更');
        expect(result).toContain('+import { Auth }');
    });

    it('二进制文件和删除文件应被精简处理', () => {
        const rawDiff = `diff --git a/assets/logo.png b/assets/logo.png
new file mode 100644
index 0000000..abc1234
Binary files /dev/null and b/assets/logo.png differ

diff --git a/src/old.ts b/src/old.ts
deleted file mode 100644
index abc..000
--- a/src/old.ts
+++ /dev/null
@@ -1,10 +0,0 @@
-line1
-line2
-line3`;

        const changes: FileChange[] = [
            { path: 'assets/logo.png', status: 'added' },
            { path: 'src/old.ts', status: 'deleted' },
        ];

        const result = processDiff(rawDiff, changes);

        expect(result).toContain('[二进制文件 新增]: assets/logo.png');
        expect(result).toContain('[删除] src/old.ts (共 3 行)');
        // 不应包含 "Binary files" 原始文本
        expect(result).not.toContain('Binary files /dev/null');
    });

    it('空 diff 应返回仅含文件清单', () => {
        const changes: FileChange[] = [
            { path: 'README.md', status: 'modified' },
        ];

        const result = processDiff('', changes);

        expect(result).toContain('## 文件变更清单');
        expect(result).toContain('[修改] README.md');
    });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm test
```

Expected: FAIL — `processDiff` 签名不匹配（当前文件中还没有这个主函数）

- [ ] **Step 3: 实现 `processDiff` 主函数**

在 `src/diffProcessor.ts` 中添加：

```typescript
const MAX_DIFF_BUDGET = 10_000;

export function processDiff(rawDiff: string, changes: readonly FileChange[]): string {
    const summary = buildFileSummary(changes);

    if (!rawDiff.trim()) {
        return summary ? `## 文件变更清单\n${summary}` : '';
    }

    // 解析 → 分类处理 → 智能截断
    const chunks = parseDiffChunks(rawDiff);

    // 建立 filePath → status 的映射用于分类
    const statusMap = new Map(changes.map(c => [c.path, c.status]));

    const processed = chunks.map(chunk => {
        const status = statusMap.get(chunk.filePath) ?? 'modified';
        return processChunk(chunk, status);
    });

    const { content: diffContent } = smartTruncate(processed, MAX_DIFF_BUDGET);

    const parts: string[] = [];
    if (summary) {
        parts.push(`## 文件变更清单\n${summary}`);
    }
    if (diffContent) {
        parts.push(`## 详细变更\n${diffContent}`);
    }

    return parts.join('\n\n');
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
pnpm test
```

Expected: 所有测试 PASS

- [ ] **Step 5: 提交**

```bash
git add src/diffProcessor.ts src/diffProcessor.test.ts
git commit -m "feat: assemble processDiff main function"
```

---

### Task 7: 集成到 extension.ts 并清理 aiProvider.ts

**Files:**
- Modify: `src/extension.ts`
- Modify: `src/aiProvider.ts`

目标：将 diffProcessor 集成到主流程，移除旧的截断逻辑。

- [ ] **Step 1: 修改 `src/extension.ts` 集成 processDiff**

在 `extension.ts` 顶部添加导入：

```typescript
import { processDiff, FileChange } from './diffProcessor';
import { Status } from './git';
```

在 `withProgress` 回调内，将：

```typescript
const diff = await repo.diff(true);
if (!diff.trim()) {
    log('警告: 暂存区 diff 为空');
    return;
}
log(`diff 长度: ${diff.length} 字符`);

const message = await generateCommitMessage(config, diff, log);
```

替换为：

```typescript
const rawDiff = await repo.diff(true);
if (!rawDiff.trim()) {
    log('警告: 暂存区 diff 为空');
    return;
}
log(`原始 diff 长度: ${rawDiff.length} 字符`);

const fileChanges = toFileChanges(repo.state.indexChanges);
const diff = processDiff(rawDiff, fileChanges);
log(`处理后 diff 长度: ${diff.length} 字符`);

const message = await generateCommitMessage(config, diff, log);
```

在 `activate` 函数之前添加辅助函数：

```typescript
const STATUS_LABELS: Record<number, FileChange['status']> = {
    [Status.INDEX_MODIFIED]: 'modified',
    [Status.INDEX_ADDED]: 'added',
    [Status.INDEX_DELETED]: 'deleted',
    [Status.INDEX_RENAMED]: 'renamed',
    [Status.INDEX_COPIED]: 'copied',
};

function toFileChanges(indexChanges: readonly import('./git').Change[]): FileChange[] {
    return indexChanges.map(c => {
        const vscode = require('vscode') as typeof import('vscode');
        const path = vscode.workspace.asRelativePath(c.uri);
        const status = STATUS_LABELS[c.status] ?? 'modified';
        const result: FileChange = { path, status };
        if (c.status === Status.INDEX_RENAMED || c.status === Status.INDEX_COPIED) {
            result.oldPath = vscode.workspace.asRelativePath(c.originalUri);
        }
        return result;
    });
}
```

注意：`require('vscode')` 在扩展运行时已缓存，`vscode` 已在文件顶部 import。实际上更简单的写法是直接用顶部已有的 `vscode` 导入，改为：

```typescript
function toFileChanges(indexChanges: readonly import('./git').Change[]): FileChange[] {
    return indexChanges.map(c => {
        const path = vscode.workspace.asRelativePath(c.uri);
        const status = STATUS_LABELS[c.status] ?? 'modified';
        const result: FileChange = { path, status };
        if (c.status === Status.INDEX_RENAMED || c.status === Status.INDEX_COPIED) {
            result.oldPath = vscode.workspace.asRelativePath(c.originalUri);
        }
        return result;
    });
}
```

- [ ] **Step 2: 简化 `src/aiProvider.ts` 移除旧截断逻辑**

将 `aiProvider.ts` 修改为：

```typescript
import { Config } from './config';

const REQUEST_TIMEOUT = 30_000;

export async function generateCommitMessage(config: Config, diff: string, log: (msg: string) => void): Promise<string> {
    const url = `${config.apiBaseUrl.replace(/\/+$/, '')}/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        log(`请求 API: ${url}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                model: config.model,
                ...(config.maxTokens > 0 ? { max_tokens: config.maxTokens } : {}),
                messages: [
                    { role: 'system', content: config.prompt },
                    { role: 'user', content: `以下为修改内容:\n\n${diff}` },
                ],
            }),
            signal: controller.signal,
        });

        log(`API 响应状态: ${response.status}`);

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`API request failed (${response.status}): ${text}`);
        }

        const data = await response.json();
        const message = (data as Record<string, any>)?.choices?.[0]?.message;

        const content = message?.content || message?.reasoning_content;
        if (!content) {
            throw new Error(`API returned empty response. Response: ${JSON.stringify(data)}`);
        }

        return (content as string).replace(/\n*---\s*$/, '').trim();
    } finally {
        clearTimeout(timeoutId);
    }
}
```

变更要点：
- 删除 `MAX_DIFF_LENGTH` 常量
- 删除 `truncatedDiff` 变量和截断逻辑
- 删除 `log` 中关于截断的日志
- `diff` 参数直接使用，不再截断

- [ ] **Step 3: 构建验证**

```bash
pnpm build
```

Expected: 编译成功，无错误

- [ ] **Step 4: 运行测试确认不受影响**

```bash
pnpm test
```

Expected: 所有测试 PASS

- [ ] **Step 5: 提交**

```bash
git add src/extension.ts src/aiProvider.ts
git commit -m "feat: integrate diffProcessor into main flow and clean up truncation"
```

---

## Verification（端到端验证）

构建并安装扩展后，手动测试以下场景：

1. **少量文本文件**：暂存 1-3 个代码文件 → 生成的 commit message 应与优化前质量一致
2. **大量文件**：暂存 10+ 个文件使 diff 超 10,000 字符 → AI 应能感知所有文件名，生成的 message 应覆盖主要变更
3. **二进制文件**：暂存一张图片 → message 应包含 `[二进制文件 ...]` 信息，如 `feat(assets): 添加 logo 图片`
4. **删除文件**：暂存一个被删除的文件 → diff 应被精简为一行摘要，而非完整文件内容
5. **混合场景**：同时暂存文本修改、新增、删除、二进制文件 → message 应覆盖所有类型变更

---

## Self-Review Checklist

- [x] **Spec coverage**: 三个优化方向（截断/二进制/删除）均有对应 Task
- [x] **Placeholder scan**: 所有步骤包含完整代码，无 TBD/TODO
- [x] **Type consistency**: `FileChange`、`DiffChunk`、`processDiff` 签名在所有 Task 中一致
