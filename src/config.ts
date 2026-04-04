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
