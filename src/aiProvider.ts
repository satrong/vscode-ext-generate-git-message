import { Config } from './config';

const REQUEST_TIMEOUT = 30_000;

async function chatCompletion(
    config: Config,
    systemPrompt: string,
    userContent: string,
    log: (msg: string) => void
): Promise<string> {
    const url = `${config.apiBaseUrl.replace(/\/+$/, '')}/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(`请求超时 (${REQUEST_TIMEOUT / 1000} s)`), REQUEST_TIMEOUT);

    try {
        log(`请求 API: ${url}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                ...config.extraBody,
                ...(config.maxTokens > 0 ? { max_tokens: config.maxTokens } : {}),
                model: config.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userContent },
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

export async function generateCommitMessage(config: Config, diff: string, log: (msg: string) => void): Promise<string> {
    return chatCompletion(config, config.prompt, `以下为修改内容:\n\n${diff}`, log);
}

export async function translateCommitMessage(
    config: Config,
    message: string,
    log: (msg: string) => void
): Promise<string> {
    const systemPrompt = config.translatePrompt.replace(/\{\{targetLanguage\}\}/g, config.targetLanguage);
    return chatCompletion(config, systemPrompt, `待翻译的 commit message:\n\n${message}`, log);
}
