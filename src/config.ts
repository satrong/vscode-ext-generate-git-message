import * as vscode from 'vscode';
import defaultPrompt from './prompt.md';

const SECTION = 'generateGitMessage';
const SECRET_KEY = 'apiKey';

export interface Config {
    apiBaseUrl: string;
    apiKey: string;
    model: string;
    prompt: string;
    maxTokens: number;
    extraBody: Record<string, unknown>;
}

function parseExtraBody(raw: string): Record<string, unknown> {
    if (!raw.trim()) return {};
    try {
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

export function getConfig(secrets: vscode.SecretStorage): Config {
    const cfg = vscode.workspace.getConfiguration(SECTION);
    return {
        apiBaseUrl: cfg.get<string>('apiBaseUrl', 'https://api.openai.com/v1'),
        apiKey: '', // 需要通过 getApiKey 异步获取
        model: cfg.get<string>('model', 'gpt-4o-mini'),
        prompt: cfg.get<string>('prompt', '') || defaultPrompt,
        maxTokens: cfg.get<number>('maxTokens', 0),
        extraBody: parseExtraBody(cfg.get<string>('extraBody', '')),
    };
}

/** 优先级: SecretStorage > 环境变量 */
export async function getApiKey(secrets: vscode.SecretStorage): Promise<string> {
    const stored = await secrets.get(SECRET_KEY);
    if (stored) return stored;

    return process.env.GENERATE_GIT_MESSAGE_API_KEY || '';
}

export async function setApiKey(secrets: vscode.SecretStorage, key: string): Promise<void> {
    await secrets.store(SECRET_KEY, key);
}

export async function deleteApiKey(secrets: vscode.SecretStorage): Promise<void> {
    await secrets.delete(SECRET_KEY);
}
