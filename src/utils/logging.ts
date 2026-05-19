/**
 * Console / notification prefix. Decoupled from `MODULE_ID` so the prefix
 * stays short and stable even if the technical module ID ever changes —
 * users filter the browser console by this exact string.
 */
const PREFIX = "[t20-theme-overhaul]";

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
