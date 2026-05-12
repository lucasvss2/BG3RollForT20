export const MODULE_ID = "aeris-bg3-rolls-t20" as const;
export const BG3_MODULE_ID = "aeris-bg3-rolls" as const;
export const SYSTEM_ID = "tormenta20" as const;

/** Hook fired by aeris-bg3-rolls when a roll message is ready to be grouped */
export const BG3_ALERT_HOOK = `${BG3_MODULE_ID}.alertChatMessage` as const;

/** Hook aeris-bg3-rolls may fire so external modules can register parsers */
export const BG3_REGISTER_HOOK = `${BG3_MODULE_ID}.registerParser` as const;

/** Hook aeris-bg3-rolls fires when fully initialised */
export const BG3_READY_HOOK = `${BG3_MODULE_ID}.ready` as const;
