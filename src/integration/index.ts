/**
 * Integration layer: T20 roll interception and BG3 cinematic overlay.
 *
 * Flow:
 *   createChatMessage → parse T20 flavor → show overlay immediately
 *   Overlay auto-dismisses after 3 s or on click, whichever comes first.
 */

import { parseT20 } from "@/parser/t20";
import {
    BG3_MODULE_ID,
    BG3_ALERT_HOOK,
    BG3_REGISTER_HOOK,
    BG3_READY_HOOK,
    MODULE_ID,
    SYSTEM_ID,
} from "@/constants";
import { log } from "@/utils/logging";
import { BG3Overlay } from "@/overlay/BG3Overlay";

// ── Public entry point ────────────────────────────────────────────────────────

export function setupIntegration(): void {
    installOverlayHook();

    const bg3 = game.modules.get(BG3_MODULE_ID);
    if (!bg3?.active) {
        log(`"${BG3_MODULE_ID}" não está ativo — modo standalone.`);
        return;
    }

    log("aeris-bg3-rolls detectado — registrando parser T20…");

    Hooks.on(BG3_READY_HOOK, (...args: unknown[]) => {
        const api = args[0] as AerisBG3RollsAPI | undefined;
        if (typeof api?.registerParser === "function") {
            api.registerParser(SYSTEM_ID, parseT20);
            log("Parser T20 registrado via aeris-bg3-rolls.ready hook.");
        }
    });

    Hooks.callAll(BG3_REGISTER_HOOK, SYSTEM_ID, parseT20);

    Hooks.once("ready", () => {
        if (tryGlobalApiRegistration()) return;
        tryLibWrapperPatch();
    });
}

// ── Core overlay hook ─────────────────────────────────────────────────────────

function installOverlayHook(): void {
    Hooks.on("createChatMessage", (...args: unknown[]): void => {
        const message = args[0] as ChatMessage;

        if (game.system.id !== SYSTEM_ID) return;

        const rolls = getRolls(message);
        if (!rolls.length) {
            log("Sem rolagens na mensagem — ignorada.");
            return;
        }

        const flavor = resolveFlavorText(message);
        log(`Rolagem detectada — flavor: "${flavor}", total: ${String(rolls[0]?.total)}`);

        const rollMeta = parseT20({ flavor });
        if (!rollMeta) {
            log(`Tipo não reconhecido para: "${flavor.slice(0, 80)}"`);
            return;
        }

        const roll = rolls[0];
        if (!roll) return;

        setTimeout(() => BG3Overlay.show(rollMeta, roll), 1000);

        const bg3 = game.modules.get(BG3_MODULE_ID);
        if (bg3?.active) {
            Hooks.callAll(BG3_ALERT_HOOK, {
                message,
                rollMeta,
                roll,
                userId: args[2] as string,
            });
        }
    });

    log("Overlay cinemático T20 instalado.");
}

// ── Roll extraction ───────────────────────────────────────────────────────────

/**
 * Extract Roll objects from a ChatMessage.
 * ChatMessageTormenta20 uses the standard Foundry rolls field, but we also
 * check the raw _source in case the getter fails.
 */
function getRolls(message: ChatMessage): Roll[] {
    // Standard path
    if (message.rolls?.length) return message.rolls;

    // Fallback: access _source directly (Foundry internal, but reliable)
    const raw = (message as unknown as Record<string, unknown>);
    const src = raw["_source"] as Record<string, unknown> | undefined;
    const srcRolls = src?.["rolls"];
    if (Array.isArray(srcRolls) && srcRolls.length > 0) {
        try {
            const deserialized = (srcRolls as unknown[]).map((r) => Roll.fromData(r as Record<string, unknown>));
            if (deserialized.length) return deserialized;
        } catch { /* ignore deserialization errors */ }
    }

    return [];
}

// ── Flavor text resolution ────────────────────────────────────────────────────

/**
 * Resolve the roll label for a ChatMessage.
 *
 * t20 creates messages with flavor='' and embeds the item/skill name
 * inside the content HTML (typically in <h3 class="item-name">).
 * We try multiple sources in order.
 */
export function resolveFlavorText(message: ChatMessage): string {
    // 1. Direct flavor property
    const direct = message.flavor?.trim();
    if (direct) return direct;

    const content = message.content ?? "";

    // 2. data-* attribute with the item or ability name
    const dataNameMatch = content.match(/data-(?:item-name|ability-name|pericia|name)="([^"]+)"/i);
    if (dataNameMatch?.[1]) return decodeHtmlEntities(dataNameMatch[1]);

    // 3. Heading elements (h1–h6), stripping inner tags, skipping pure-numeric text
    const headingRe = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
    let m: RegExpExecArray | null;
    while ((m = headingRe.exec(content)) !== null) {
        const text = m[1].replace(/<[^>]*>/g, "").replace(/&[a-z]+;/gi, " ").trim();
        if (text && !/^\d+$/.test(text)) return text;
    }

    // 4. Elements with class names indicating a label / title
    const labelRe = /class="[^"]*\b(?:item-name|card-title|ability-name|roll-label|skill-name|pericia-name)\b[^"]*"[^>]*>([\s\S]*?)</gi;
    while ((m = labelRe.exec(content)) !== null) {
        const text = m[1].replace(/<[^>]*>/g, "").trim();
        if (text && !/^\d+$/.test(text)) return text;
    }

    // 5. First meaningful plain-text line from the content
    const lines = content
        .replace(/<[^>]*>/g, "\n")
        .split("\n")
        .map((l) => l.replace(/&[a-z]+;/gi, " ").trim())
        .filter((l) => l.length > 1 && !/^\d+$/.test(l));
    if (lines[0]) return lines[0].slice(0, 200);

    return "";
}

function decodeHtmlEntities(s: string): string {
    return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// ── Strategy 2: game.bg3rolls global API ─────────────────────────────────────

function tryGlobalApiRegistration(): boolean {
    const api = game.bg3rolls;
    if (typeof api?.registerParser !== "function") return false;
    api.registerParser(SYSTEM_ID, parseT20);
    log("Parser T20 registrado via game.bg3rolls.registerParser().");
    return true;
}

// ── Strategy 3: libWrapper ────────────────────────────────────────────────────

function tryLibWrapperPatch(): boolean {
    if (typeof libWrapper === "undefined") return false;

    const target = `game.modules.get("${BG3_MODULE_ID}").api.parseRollMeta`;
    try {
        libWrapper.register(
            MODULE_ID,
            target,
            function (this: unknown, wrapped, ...args: unknown[]) {
                const chatMessage = args[0] as ChatMessage;
                if (game.system.id !== SYSTEM_ID) {
                    return (wrapped as (msg: ChatMessage) => RollMeta | null)(chatMessage);
                }
                return (
                    parseT20({ flavor: chatMessage.flavor }) ??
                    (wrapped as (msg: ChatMessage) => RollMeta | null)(chatMessage)
                );
            },
            "MIXED",
        );
        log("parseRollMeta sobrescrito via libWrapper.");
        return true;
    } catch {
        return false;
    }
}
