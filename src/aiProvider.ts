import { Config } from './config';

const MAX_DIFF_LENGTH = 10_000;
const REQUEST_TIMEOUT = 30_000;

export async function generateCommitMessage(config: Config, diff: string): Promise<string> {
    const truncatedDiff = diff.length > MAX_DIFF_LENGTH
        ? diff.slice(0, MAX_DIFF_LENGTH) + '\n\n... (diff truncated)'
        : diff;

    const url = `${config.apiBaseUrl.replace(/\/+$/, '')}/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
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
                    { role: 'user', content: `Here is the git diff:\n\n${truncatedDiff}` },
                ],
            }),
            signal: controller.signal,
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
    } finally {
        clearTimeout(timeoutId);
    }
}
