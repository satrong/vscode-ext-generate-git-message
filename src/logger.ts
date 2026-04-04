import * as vscode from 'vscode';

let channel: vscode.OutputChannel;

export function initOutputChannel(context: vscode.ExtensionContext): void {
    channel = vscode.window.createOutputChannel('Generate Git Message');
    context.subscriptions.push(channel);
}

export function log(message: string): void {
    if (!channel) { return; }
    const timestamp = new Date().toLocaleTimeString();
    channel.appendLine(`[${timestamp}] ${message}`);
}

export function showOutput(): void {
    if (!channel) { return; }
    channel.show(true);
}
