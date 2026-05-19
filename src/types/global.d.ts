/**
 * Minimal Foundry VTT v13 ambient type declarations needed by this module.
 * For full types, install @league-of-foundry-developers/foundry-vtt-types.
 */

// ── Foundry globals ──────────────────────────────────────────────────────────

declare const Hooks: {
    once(event: string, fn: (...args: unknown[]) => void): number;
    on(event: string, fn: (...args: unknown[]) => unknown): number;
    off(event: string, id: number): void;
    callAll(event: string, ...args: unknown[]): boolean;
};

declare const game: {
    system: { id: string; version: string };
    modules: {
        get(id: string): FoundryModule | undefined;
    };
    actors?: {
        get(id: string): FoundryActor | undefined;
        contents?: Array<{ id: string }>;
    };
    messages?: {
        get(id: string): ChatMessage | undefined;
        contents?: ChatMessage[];
    };
    users?: {
        find(fn: (u: FoundryUser) => boolean): FoundryUser | undefined;
        get(id: string): FoundryUser | undefined;
        contents: FoundryUser[];
    };
    user: {
        id: string;
        name: string;
        isGM: boolean;
        targets: Set<FoundryToken>;
    } | null;
    socket?: {
        emit(event: string, data: unknown): void;
        on(event: string, handler: (data: unknown) => void): void;
    };
    i18n: {
        localize(key: string): string;
        format(key: string, data?: Record<string, unknown>): string;
    };
    settings: {
        register(
            namespace: string,
            key: string,
            data: SettingConfig,
        ): void;
        get(namespace: string, key: string): unknown;
        set(namespace: string, key: string, value: unknown): Promise<unknown>;
    };
};

declare interface FoundryModule {
    id: string;
    active: boolean;
    version: string;
    api?: Record<string, unknown>;
}

declare interface FoundryUser {
    id: string;
    name: string;
    isGM: boolean;
    active: boolean;
}

declare interface FoundryToken {
    id: string;
    name: string;
    actor: FoundryActor | null;
}

declare interface FoundryItemEffect {
    id: string;
    name: string;
    disabled: boolean;
    changes: Array<{ key: string; value: string; mode: number; priority?: number | null }>;
    flags: Record<string, Record<string, unknown>>;
}

declare interface FoundryItem {
    id: string;
    name: string;
    type: string;
    system: Record<string, unknown>;
    effects?: { contents: FoundryItemEffect[] };
}

declare interface FoundryActor {
    id: string;
    /**
     * Full UUID, e.g.
     *  - "Actor.{id}" for world actors
     *  - "Scene.{sceneId}.Token.{tokenId}.Actor.{id}" for token-synthetic actors
     */
    uuid: string;
    name: string;
    type?: string;
    img?: string;
    ownership: Record<string, number>;
    items?: {
        contents: FoundryItem[];
        /** Look up a single item by id */
        get(id: string): FoundryItem | null;
    };
    effects?: { contents: FoundryItemEffect[] };
    update(data: Record<string, unknown>): Promise<void>;
    /**
     * Create embedded child documents (e.g. ActiveEffect) on this actor.
     * `toChat: true` triggers the T20 status notification card in chat.
     */
    createEmbeddedDocuments(
        type: string,
        data: Record<string, unknown>[],
        options?: Record<string, unknown>,
    ): Promise<unknown[]>;
    /**
     * Toggle a status effect on the actor.
     * Pass `{ active: true }` to force-enable without toggling off.
     */
    toggleStatusEffect(
        statusId: string,
        opts?: { active?: boolean; overlay?: boolean },
    ): Promise<void>;
    system?: {
        pericias?: Record<string, {
            total?: number; label?: string; value?: number;
            outros?: number; condi?: number; atributo?: string;
        }>;
        atributos?: Record<string, { value?: number }>;
        nivel?: { value?: number };
        attributes?: {
            pm?:     { value?: number; max?: number; temp?: number };
            pv?:     { value?: number; max?: number; temp?: number };
            defesa?: { value?: number; base?: number };
            [key: string]: unknown;
        };
        [key: string]: unknown;
    };
}

declare interface SettingConfig {
    name: string;
    hint?: string;
    scope: "world" | "client";
    config: boolean;
    type: BooleanConstructor | StringConstructor | NumberConstructor;
    default: unknown;
    onChange?: (value: unknown) => void;
}

// ── Chat message ─────────────────────────────────────────────────────────────

declare class ChatMessage {
    id: string;
    flavor: string;
    content: string;
    speaker: { actor?: string; alias?: string };
    rolls: Roll[];
    isRoll: boolean;
    flags: Record<string, Record<string, unknown>>;
    user: string | { id: string };
    /** Foundry v13 alias for user */
    author?: { id: string };

    getFlag(scope: string, key: string): unknown;
    setFlag(scope: string, key: string, value: unknown): Promise<this>;
    unsetFlag(scope: string, key: string): Promise<this>;
    updateSource(data: Record<string, unknown>): void;
    update(data: Record<string, unknown>): Promise<this>;
    toObject(): Record<string, unknown>;

    static create(data: Record<string, unknown>): Promise<ChatMessage | undefined>;
    static getSpeaker(options?: { actor?: FoundryActor | null; token?: FoundryToken }): Record<string, unknown>;
}

// ── Dialog ───────────────────────────────────────────────────────────────────

declare interface DialogButtonConfig {
    icon?: string;
    label: string;
    callback?: ($html: JQuery) => void | Promise<void>;
}

declare interface DialogData {
    title: string;
    content: string;
    buttons?: Record<string, DialogButtonConfig>;
    default?: string;
    render?: ($html: JQuery) => void;
    close?: () => void;
}

declare interface DialogOptions {
    classes?: string[];
    width?: number;
    height?: number | string;
    id?: string;
    resizable?: boolean;
}

declare class Dialog {
    constructor(data: DialogData, options?: DialogOptions);
    render(force: boolean): this;
    close(): Promise<void>;
}

// ── Utility ──────────────────────────────────────────────────────────────────

declare function mergeObject<T extends object, U extends object>(original: T, other: U): T & U;
declare function randomID(length?: number): string;
/** Synchronously resolve a document by its UUID (Foundry v11+) */
declare function fromUuidSync(uuid: string): FoundryActor | null;

// ── Roll ─────────────────────────────────────────────────────────────────────

declare class Roll {
    constructor(formula: string, data?: Record<string, unknown>, options?: Record<string, unknown>);
    formula: string;
    total: number | null;
    terms: RollTerm[];
    dice: DiceTerm[];
    /** Arbitrary options stored on the roll — T20 uses `options.type: "attack" | "damage"` */
    options: Record<string, unknown>;
    evaluate(options?: { async?: boolean }): Promise<Roll>;
    /** Returns rendered HTML for this roll (includes dice visuals and total) */
    render(options?: { flavor?: string; template?: string; isPrivate?: boolean }): Promise<string>;
    toJSON(): Record<string, unknown>;
    static fromData(data: Record<string, unknown>): Roll;
}

declare interface RollTerm {
    expression: string;
}

declare interface DiceTerm extends RollTerm {
    faces: number;
    results: Array<{ result: number; active: boolean }>;
}

// ── UI ───────────────────────────────────────────────────────────────────────

declare const canvas: {
    tokens?: {
        controlled?: FoundryToken[];
    };
} | undefined;

declare const ui: {
    notifications: {
        info(msg: string, options?: { permanent?: boolean }): void;
        warn(msg: string, options?: { permanent?: boolean }): void;
        error(msg: string, options?: { permanent?: boolean }): void;
    };
};

// ── socketlib (required peer) ─────────────────────────────────────────────────

declare interface SocketlibSocket {
    /** Register a named handler that other clients can invoke. */
    register(name: string, handler: (...args: unknown[]) => unknown): void;
    /** Run `name` on one active GM. Resolves with the handler's return value. */
    executeAsGM<T = unknown>(name: string, ...args: unknown[]): Promise<T>;
    /** Run `name` on a specific user. Resolves with the handler's return value. */
    executeAsUser<T = unknown>(name: string, userId: string, ...args: unknown[]): Promise<T>;
    /** Broadcast `name` to all connected clients (including self). */
    executeForEveryone(name: string, ...args: unknown[]): Promise<void>;
    /** Broadcast `name` to all clients except self. */
    executeForOthers(name: string, ...args: unknown[]): Promise<void>;
    /** Run `name` on every connected GM (including self if GM). */
    executeForAllGMs(name: string, ...args: unknown[]): Promise<void>;
    /** Run `name` on every connected GM except self. */
    executeForOtherGMs(name: string, ...args: unknown[]): Promise<void>;
    /** Run `name` on a specified list of users. */
    executeForUsers(name: string, recipients: string[], ...args: unknown[]): Promise<void>;
}

declare const socketlib:
    | {
          registerModule(moduleId: string): SocketlibSocket;
          registerSystem(systemId: string): SocketlibSocket;
      }
    | undefined;

// ── Roll metadata (used by the cinematic overlay) ─────────────────────────────

/** Metadata returned by the T20 parser so the overlay knows what to display */
declare interface RollMeta {
    /** Primary label shown in the overlay (e.g. "Fortitude", "Teste de Percepção") */
    category: string;
    /** Optional secondary label (e.g. skill name within the category) */
    subcategory?: string;
    /** Difficulty class / target number, if known */
    target?: number;
    /** "advantage" | "disadvantage" | undefined */
    rollType?: string;
}

// ── Foundry CONFIG (partial — only what this module uses) ────────────────────

declare const CONFIG: {
    statusEffects: Array<{
        id: string;
        name: string;
        icon?: string;
        /** Status IDs this effect applies (usually just [id]) */
        statuses?: string[];
        duration?: { rounds?: number };
        flags?: Record<string, Record<string, unknown>>;
    }>;
    [key: string]: unknown;
};

// ── jQuery (provided by Foundry) ──────────────────────────────────────────────
declare const $: JQueryStatic;
declare type JQuery<T extends Node = HTMLElement> = import("jquery").JQuery<T>;
declare type JQueryStatic = import("jquery").JQueryStatic;
