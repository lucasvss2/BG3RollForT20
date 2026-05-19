/**
 * Central socketlib bootstrap for the module.
 *
 * socketlib is a hard dependency declared in module.json. It fires the
 * `socketlib.ready` hook once during boot — we register our module then,
 * collect a single `SocketlibSocket` instance, and let subsystems register
 * their handlers on it via `onSocketReady()`.
 *
 * Subsystems should NEVER access `game.socket` directly. They:
 *
 * ```
 * onSocketReady((socket) => {
 *     socket.register("openDamagePrompt", openDamagePrompt);
 * });
 *
 * // To invoke remotely:
 * await getSocket()?.executeAsUser("openDamagePrompt", targetUserId, payload);
 * ```
 *
 * `getSocket()` returns `null` until `socketlib.ready` has fired. After the
 * hook fires, all queued `onSocketReady` callbacks run synchronously.
 */

import { MODULE_ID } from "@/constants";
import { log, warn } from "@/utils/logging";

let socket: SocketlibSocket | null = null;
const pending: Array<(s: SocketlibSocket) => void> = [];

/** Run `fn` once socketlib is ready and our module is registered. */
export function onSocketReady(fn: (socket: SocketlibSocket) => void): void {
    if (socket) {
        fn(socket);
        return;
    }
    pending.push(fn);
}

/** Returns the live socket or `null` if socketlib has not finished booting. */
export function getSocket(): SocketlibSocket | null {
    return socket;
}

/** Install the `socketlib.ready` listener. Call once from `Hooks.once("init", ...)`. */
export function setupSocketlib(): void {
    Hooks.once("socketlib.ready", () => {
        if (typeof socketlib === "undefined") {
            warn("socketlib hook fired but global is undefined — abortando.");
            return;
        }
        socket = socketlib.registerModule(MODULE_ID);
        log(`socketlib registrado (${pending.length} handler set(s) pendente(s)).`);
        for (const fn of pending) {
            try { fn(socket); } catch (err) {
                console.error(`[${MODULE_ID}] erro registrando handler de socket:`, err);
            }
        }
        pending.length = 0;
    });
}
