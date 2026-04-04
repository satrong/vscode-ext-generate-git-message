import * as vscode from 'vscode';
import defaultPrompt from './prompt.md';

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
        prompt: cfg.get<string>('prompt', '') || defaultPrompt,
        maxTokens: cfg.get<number>('maxTokens', 1024),
    };
}
