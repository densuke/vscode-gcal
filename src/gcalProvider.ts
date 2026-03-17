import { execFile } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';

export type CalendarEvent = {
    startTime: string;
    endTime: string;
    title: string;
    startMinutes: number;
    endMinutes: number;
};

export type NextEventResult = {
    event: CalendarEvent | null;
    status: 'ongoing' | 'next' | 'none';
};

export function isOvernightEvent(event: CalendarEvent): boolean {
    return event.endMinutes <= event.startMinutes;
}

export function isOngoingEvent(event: CalendarEvent, nowMinutes: number): boolean {
    if (!isOvernightEvent(event)) {
        return event.startMinutes <= nowMinutes && nowMinutes < event.endMinutes;
    }

    return event.startMinutes <= nowMinutes || nowMinutes < event.endMinutes;
}

export function isFutureEvent(event: CalendarEvent, nowMinutes: number): boolean {
    if (!isOvernightEvent(event)) {
        return event.startMinutes > nowMinutes;
    }

    return nowMinutes < event.startMinutes && nowMinutes >= event.endMinutes;
}

function toMinutes(time: string): number {
    const [hoursText, minutesText] = time.split(':');
    const hours = Number(hoursText);
    const minutes = Number(minutesText);
    return hours * 60 + minutes;
}

function buildExecPath(): string {
    const cargoBin = path.join(os.homedir(), '.cargo', 'bin');
    const extraPaths = [cargoBin, '/opt/homebrew/bin', '/usr/local/bin'];
    const currentPath = process.env.PATH ?? '';
    return [...extraPaths, currentPath].filter(Boolean).join(path.delimiter);
}

export async function runGcalTodayEvents(): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(
            'gcal',
            ['events', '--date=today'],
            {
                env: {
                    ...process.env,
                    PATH: buildExecPath(),
                },
            },
            (error, stdout, stderr) => {
                if (error) {
                    let errorMessage = stderr?.trim() || error.message;
                    if (error.message.includes('ENOENT') || errorMessage.includes('not found')) {
                        errorMessage = 'gcal コマンドが見つかりません。Cargoでインストールされているか確認してください。';
                    }

                    reject(new Error(errorMessage));
                    return;
                }
                resolve(stdout);
            }
        );
    });
}

export function parseGcalEvents(output: string): CalendarEvent[] {
    const lines = output.split(/\r?\n/);
    const events: CalendarEvent[] = [];
    const eventPattern = /^\s*>?\s*(\d{2}:\d{2})-(\d{2}:\d{2})\s{2,}(.+)$/;

    for (const line of lines) {
        const match = line.match(eventPattern);
        if (!match) {
            continue;
        }

        const [, startTime, endTime, title] = match;
        const startMinutes = toMinutes(startTime);
        const endMinutes = toMinutes(endTime);

        events.push({
            startTime,
            endTime,
            title: title.trim(),
            startMinutes,
            endMinutes,
        });
    }

    return events.sort((a, b) => a.startMinutes - b.startMinutes);
}

export function findCurrentOrNextEvent(events: CalendarEvent[], now: Date = new Date()): NextEventResult {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    for (const event of events) {
        if (isOngoingEvent(event, nowMinutes)) {
            return {
                event,
                status: 'ongoing',
            };
        }
    }

    for (const event of events) {
        if (isFutureEvent(event, nowMinutes)) {
            return {
                event,
                status: 'next',
            };
        }
    }

    return {
        event: null,
        status: 'none',
    };
}
