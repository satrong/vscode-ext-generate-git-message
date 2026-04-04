import { Config } from './config';

const MAX_DIFF_LENGTH = 10_000;
const REQUEST_TIMEOUT = 30_000;

export async function generateCommitMessage(config: Config, diff: string, log: (msg: string) => void): Promise<string> {
    const truncatedDiff = diff.length > MAX_DIFF_LENGTH
        ? diff.slice(0, MAX_DIFF_LENGTH) + '\n\n... (diff truncated)'
        : diff;

    const url = `${config.apiBaseUrl.replace(/\/+$/, '')}/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        log(`请求 API: ${url}`);
        log(`使用 diff 长度: ${truncatedDiff.length} 字符${diff.length > MAX_DIFF_LENGTH ? ' (已截断)' : ''}`);

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
                    { role: 'user', content: `以下为修改内容:\n\n${truncatedDiff}` },
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

        return (content as string).trim();
    } finally {
        clearTimeout(timeoutId);
    }
}
