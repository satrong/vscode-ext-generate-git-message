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
                cancellable: true,
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
