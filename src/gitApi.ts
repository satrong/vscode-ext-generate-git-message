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

export function getRepository(api: API): Repository | undefined {
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
    return api.repositories[0];
}
