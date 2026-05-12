import { MODULE_ID } from "@/constants";

const PREFIX = `[${MODULE_ID}]`;

export function log(...args: unknown[]): void {
    console.log(PREFIX, ...args);
}

export function warn(...args: unknown[]): void {
    console.warn(PREFIX, ...args);
}

export function error(...args: unknown[]): void {
    console.error(PREFIX, ...args);
}

export function notifyWarn(msg: string): void {
    ui.notifications.warn(`${PREFIX} ${msg}`);
}
