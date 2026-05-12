import * as vscode from 'vscode';
import { GitExtension, API, Repository } from './git';

export async function getGitAPI(): Promise<API | undefined> {
    const extension = vscode.extensions.getExtension<GitExtension>('vscode.git');
    if (!extension) {
        return undefined;
    }
    const gitExtension = extension.isActive ? extension.exports : await extension.activate();
    return gitExtension.getAPI(1);
}

export async function getRepository(api: API): Promise<Repository | undefined> {
    if (api.repositories.length === 0) {
        return undefined;
    }
    if (api.repositories.length === 1) {
        return api.repositories[0];
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        const wsFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
        if (wsFolder) {
            const found = api.repositories.find(
                r => r.rootUri.toString() === wsFolder.uri.toString()
            );
            if (found) { return found; }
        }
    }

    const reposWithStaged = api.repositories.filter(
        r => r.state.indexChanges.length > 0
    );
    if (reposWithStaged.length === 1) {
        return reposWithStaged[0];
    }

    const items = api.repositories.map(r => {
        const label = vscode.workspace.asRelativePath(r.rootUri);
        const staged = r.state.indexChanges.length;
        return {
            label,
            description: staged > 0 ? `${staged} staged` : undefined,
            repository: r,
        };
    });

    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: '选择要生成 commit message 的仓库',
    });

    return picked?.repository;
}
