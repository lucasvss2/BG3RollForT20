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
    /** Exposed by aeris-bg3-rolls on the global game object */
    bg3rolls?: AerisBG3RollsAPI;
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

declare interface FoundryItem {
    id: string;
    name: string;
    type: string;
    system: Record<string, unknown>;
}

declare interface FoundryActor {
    id: string;
    name: string;
    img?: string;
    ownership: Record<string, number>;
    items?: { contents: FoundryItem[] };
    system?: {
        pericias?: Record<string, {
            total?: number; label?: string; value?: number;
            outros?: number; condi?: number; atributo?: string;
        }>;
        atributos?: Record<string, { value?: number }>;
        nivel?: { value?: number };
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
    user: string;

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

// ── Roll ─────────────────────────────────────────────────────────────────────

declare class Roll {
    constructor(formula: string, data?: Record<string, unknown>);
    formula: string;
    total: number | null;
    terms: RollTerm[];
    dice: DiceTerm[];
    evaluate(options?: { async?: boolean }): Promise<Roll>;
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

declare const ui: {
    notifications: {
        info(msg: string, options?: { permanent?: boolean }): void;
        warn(msg: string, options?: { permanent?: boolean }): void;
        error(msg: string, options?: { permanent?: boolean }): void;
    };
};

// ── libWrapper (optional peer) ────────────────────────────────────────────────

declare const libWrapper:
    | {
          register(
              moduleId: string,
              target: string,
              fn: (this: unknown, wrapped: (...args: unknown[]) => unknown, ...args: unknown[]) => unknown,
              type?: "WRAPPER" | "MIXED" | "OVERRIDE",
          ): void;
          unregister(moduleId: string, target: string): void;
      }
    | undefined;

// ── aeris-bg3-rolls public API ────────────────────────────────────────────────

declare interface AerisBG3RollsAPI {
    /**
     * Request a coordinated group roll.
     * This is the only API officially documented in the aeris-bg3-rolls README.
     */
    requestGroupRoll(config: GroupRollConfig): void;

    /**
     * Register a system-specific roll parser.
     * May not exist depending on aeris-bg3-rolls version — check before calling.
     */
    registerParser?(systemId: string, parser: RollParserFn): void;
}

/** Metadata returned by a roll parser so the orchestrator knows what to display */
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

declare type RollParserFn = (input: { flavor?: string; html?: JQuery }) => RollMeta | null;

declare interface GroupRollConfig {
    key: string;
    title?: string;
    dc?: number;
    actors?: string[];
}

// ── jQuery (provided by Foundry) ──────────────────────────────────────────────
declare const $: JQueryStatic;
declare type JQuery<T extends Node = HTMLElement> = import("jquery").JQuery<T>;
declare type JQueryStatic = import("jquery").JQueryStatic;
