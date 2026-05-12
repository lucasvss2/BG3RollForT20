/**
 * Minimal Foundry VTT global stubs for the test environment.
 * Only the globals actually referenced by the tested modules are declared.
 */

// The parser uses RollMeta as a return type — it's declared as a global
// interface in src/types/global.d.ts. Vitest picks this up via tsconfig.
// No runtime stub needed for interfaces.

// Ensure JQuery type is satisfied at runtime (parser receives it but never
// calls any jQuery methods in its current implementation).
// Nothing to stub: the parser only reads input.flavor.
