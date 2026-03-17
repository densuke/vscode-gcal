import * as vscode from 'vscode';
import {
    findCurrentOrNextEvent,
    isFutureEvent,
    isOngoingEvent,
    parseGcalEvents,
    runGcalTodayEvents,
    type CalendarEvent,
} from './gcalProvider';
import { applyStatusBarState, statusBarTextFromResult } from './statusBar';

let latestEvents: CalendarEvent[] = [];
let lastUpdatedAt: Date | null = null;
let hasShownMissingGcalWarning = false;

function isMissingGcalError(message: string): boolean {
    return message.includes('gcal コマンドが見つかりません');
}

async function notifyMissingGcal(context: vscode.ExtensionContext): Promise<void> {
    if (hasShownMissingGcalWarning) {
        return;
    }

    hasShownMissingGcalWarning = true;
    const selection = await vscode.window.showWarningMessage(
        'gcal が見つかりません。cargo install --git https://github.com/densuke/gcal.git でインストールしてください。',
        'README を開く',
        'コマンドをコピー'
    );

    try {
        if (selection === 'README を開く') {
            const readmeUri = vscode.Uri.joinPath(context.extensionUri, 'README.md');
            await vscode.commands.executeCommand('markdown.showPreviewToSide', readmeUri);
            return;
        }

        if (selection === 'コマンドをコピー') {
            await vscode.env.clipboard.writeText('cargo install --git https://github.com/densuke/gcal.git');
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        void vscode.window.showErrorMessage(`gcal の案内表示に失敗しました: ${message}`);
    }
}

function buildQuickPickItems(events: CalendarEvent[], now: Date): vscode.QuickPickItem[] {
    if (events.length === 0) {
        return [{ label: '本日の予定はありません' }];
    }

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const ongoing = events.filter((event) => isOngoingEvent(event, nowMinutes));
    const future = events.filter((event) => isFutureEvent(event, nowMinutes));
    const past = events.filter((event) => !isOngoingEvent(event, nowMinutes) && !isFutureEvent(event, nowMinutes));

    const items: vscode.QuickPickItem[] = [];

    if (past.length > 0) {
        items.push({ label: '過去', kind: vscode.QuickPickItemKind.Separator });
        items.push(
            ...past.map((event) => ({
                label: `${event.startTime}-${event.endTime}`,
                description: event.title,
            }))
        );
    }

    if (ongoing.length > 0) {
        items.push({ label: '進行中', kind: vscode.QuickPickItemKind.Separator });
        items.push(
            ...ongoing.map((event) => ({
                label: `$(debug-start) ${event.startTime}-${event.endTime}`,
                description: event.title,
            }))
        );
    }

    if (future.length > 0) {
        items.push({ label: '今後', kind: vscode.QuickPickItemKind.Separator });
        items.push(
            ...future.map((event) => ({
                label: `${event.startTime}-${event.endTime}`,
                description: event.title,
            }))
        );
    }

    return items;
}

async function refreshStatusBar(
    context: vscode.ExtensionContext,
    statusBarItem: vscode.StatusBarItem
): Promise<void> {
    applyStatusBarState(statusBarItem, '$(loading~spin) gcal 取得中...', 'gcal から予定を取得中');

    try {
        const output = await runGcalTodayEvents();
        const events = parseGcalEvents(output);
        latestEvents = events;
        lastUpdatedAt = new Date();

        const result = findCurrentOrNextEvent(events, new Date());
        const text = statusBarTextFromResult(result);
        const tooltipLines = [
            'クリックで本日の予定一覧を表示',
            lastUpdatedAt ? `最終更新: ${lastUpdatedAt.toLocaleTimeString()}` : '',
        ].filter(Boolean);

        applyStatusBarState(statusBarItem, text, tooltipLines.join('\n'));
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        applyStatusBarState(statusBarItem, '$(warning) gcal エラー', `gcal 取得失敗: ${message}`);

        if (isMissingGcalError(message)) {
            void notifyMissingGcal(context);
        }
    }
}

function readRefreshIntervalMs(): number {
    const config = vscode.workspace.getConfiguration('gcalStatusbar');
    const intervalSec = config.get<number>('refreshIntervalSec', 300);
    const normalized = Number.isFinite(intervalSec) && intervalSec >= 30 ? intervalSec : 300;
    return normalized * 1000;
}

export function activate(context: vscode.ExtensionContext): void {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'gcalStatusbar.showEvents';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    const showEventsCommand = vscode.commands.registerCommand('gcalStatusbar.showEvents', async () => {
        const items = buildQuickPickItems(latestEvents, new Date());
        await vscode.window.showQuickPick(items, {
            title: '今日の予定',
            placeHolder: '予定を確認',
            ignoreFocusOut: true,
        });
    });

    const refreshCommand = vscode.commands.registerCommand('gcalStatusbar.refresh', async () => {
        await refreshStatusBar(context, statusBarItem);
    });

    context.subscriptions.push(showEventsCommand, refreshCommand);

    void refreshStatusBar(context, statusBarItem);

    let timer = setInterval(() => {
        void refreshStatusBar(context, statusBarItem);
    }, readRefreshIntervalMs());

    const configChanged = vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
        if (!event.affectsConfiguration('gcalStatusbar.refreshIntervalSec')) {
            return;
        }

        clearInterval(timer);
        timer = setInterval(() => {
            void refreshStatusBar(context, statusBarItem);
        }, readRefreshIntervalMs());
    });

    context.subscriptions.push(configChanged);
    context.subscriptions.push({
        dispose: () => {
            clearInterval(timer);
        },
    });
}

export function deactivate(): void { }
