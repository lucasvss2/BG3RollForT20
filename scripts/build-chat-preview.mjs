#!/usr/bin/env node
/**
 * Lê o CSS do chatStyles.ts (template literal de CHAT_STYLES) e gera um
 * HTML expandido em public/preview/chat-demo-built.html.
 *
 * Esse arquivo é servido pelo preview estático localhost:3000 e usado para
 * verificar visualmente o tema antes de fazer deploy no Foundry.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO       = resolve(__dirname, "..");

const styles  = readFileSync(resolve(REPO, "src/chat/chatStyles.ts"), "utf-8");
const tpl     = readFileSync(resolve(REPO, "public/preview/chat-demo.html"), "utf-8");

// Extrai o conteúdo do template literal CHAT_STYLES = ` ... `;
const match = styles.match(/const CHAT_STYLES\s*=\s*`([\s\S]*?)`;\s*\n/);
if (!match) {
    console.error("Não achei o template CHAT_STYLES no chatStyles.ts");
    process.exit(1);
}
const cssText = match[1];

const out = tpl.replace("PLACEHOLDER_CSS", cssText);
const outPath = resolve(REPO, "public/preview/chat-demo-built.html");
writeFileSync(outPath, out, "utf-8");
console.log(`✓ Preview gerado: ${outPath} (${(out.length / 1024).toFixed(1)} KB)`);
