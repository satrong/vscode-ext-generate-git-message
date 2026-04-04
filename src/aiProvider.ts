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
