import * as vscode from 'vscode';
import type { NextEventResult } from './gcalProvider';

export function statusBarTextFromResult(result: NextEventResult): string {
    if (result.status === 'ongoing' && result.event) {
        return `$(debug-start) 進行中 ${result.event.title} (~${result.event.endTime})`;
    }

    if (result.status === 'next' && result.event) {
        return `$(calendar) 次 ${result.event.startTime} ${result.event.title}`;
    }

    return '$(calendar) 本日の予定終了';
}

export function applyStatusBarState(
    statusBarItem: vscode.StatusBarItem,
    text: string,
    tooltip: string
): void {
    statusBarItem.text = text;
    statusBarItem.tooltip = tooltip;
}
