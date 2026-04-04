import * as vscode from 'vscode';
import { getGitAPI, getRepository } from './gitApi';
import { getConfig, getApiKey, setApiKey, deleteApiKey } from './config';
import { generateCommitMessage } from './aiProvider';
import { initOutputChannel, log, showOutput } from './logger';

export function activate(context: vscode.ExtensionContext) {
    initOutputChannel(context);

    const generateCmd = vscode.commands.registerCommand('generateGitMessage.generate', async () => {
        log('=== 开始生成 commit message ===');
        showOutput();

        const config = getConfig(context.secrets);
        config.apiKey = await getApiKey(context.secrets);
        log(`配置: apiBaseUrl=${config.apiBaseUrl}, model=${config.model}, maxTokens=${config.maxTokens}`);

        if (!config.apiKey) {
            log('错误: 未配置 apiKey');
            vscode.window.showErrorMessage('请先配置 API Key：运行命令 "Generate Git Message: 设置 API Key"');
            return;
        }

        const gitApi = await getGitAPI();
        if (!gitApi) {
            log('错误: 无法获取 Git 扩展 API');
            vscode.window.showErrorMessage('无法获取 Git 扩展 API');
            return;
        }

        const repo = getRepository(gitApi);
        if (!repo) {
            log('错误: 未找到 Git 仓库');
            vscode.window.showErrorMessage('未找到 Git 仓库');
            return;
        }

        if (repo.state.indexChanges.length === 0) {
            log('警告: 没有暂存的文件');
            vscode.window.showWarningMessage('没有暂存的文件，请先 stage 要提交的更改');
            return;
        }

        log(`暂存文件数: ${repo.state.indexChanges.length}`);

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.SourceControl,
                title: '正在生成 commit message...',
            },
            async () => {
                try {
                    const diff = await repo.diff(true);
                    if (!diff.trim()) {
                        log('警告: 暂存区 diff 为空');
                        return;
                    }
                    log(`diff 长度: ${diff.length} 字符`);

                    const message = await generateCommitMessage(config, diff, log);
                    log(`生成成功: ${message}`);
                    repo.inputBox.value = message;
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    log(`生成失败: ${msg}`);
                }
            }
        );
    });

    const setKeyCmd = vscode.commands.registerCommand('generateGitMessage.setApiKey', async () => {
        const input = await vscode.window.showInputBox({
            prompt: '输入 API Key（将安全存储在系统密钥链中）',
            password: true,
            ignoreFocusOut: true,
        });
        if (input !== undefined) {
            await setApiKey(context.secrets, input);
            vscode.window.showInformationMessage('API Key 已安全保存');
        }
    });

    const deleteKeyCmd = vscode.commands.registerCommand('generateGitMessage.deleteApiKey', async () => {
        const current = await getApiKey(context.secrets);
        if (!current) {
            vscode.window.showInformationMessage('当前未存储 API Key');
            return;
        }
        const confirm = await vscode.window.showWarningMessage(
            '确定要删除已存储的 API Key 吗？',
            { modal: true },
            '删除'
        );
        if (confirm === '删除') {
            await deleteApiKey(context.secrets);
            vscode.window.showInformationMessage('API Key 已删除');
        }
    });

    context.subscriptions.push(generateCmd, setKeyCmd, deleteKeyCmd);
}

export function deactivate() {}
