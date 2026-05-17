/**
 * Area Spells — handlers de magias persistentes com template de área.
 * Cada magia de área tem seu próprio arquivo (consagrar.ts, etc.).
 */

import { setupConsagrar } from "./consagrar";

export function setupAreaSpells(): void {
    setupConsagrar();
}
