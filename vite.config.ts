import { defineConfig } from "vite";
import { resolve } from "path";

// Local dev: override via env var to deploy directly to Foundry's module folder.
// CI/release: leave unset so the build goes to dist/ and the release workflow can zip it.
const FOUNDRY_OUT = process.env["FOUNDRY_OUT"] ?? "dist";

export default defineConfig({
    // publicDir: tudo dentro de `public/` é copiado AS-IS pra outDir/.
    // Usamos pra distribuir assets do módulo (PNGs de textura, ícones).
    publicDir: resolve(__dirname, "public"),
    build: {
        lib: {
            entry: resolve(__dirname, "src/main.ts"),
            fileName: "main.bundle",
            formats: ["es"],
        },
        outDir: FOUNDRY_OUT,
        minify: false,
        sourcemap: true,
        // Não esvazia outDir antes do build — protege main.bundle.js e assets
        // contra deleção parcial em modo watch / dev.
        emptyOutDir: false,
        rollupOptions: {
            // All Foundry VTT globals are provided by the host environment
            external: [],
            output: {
                globals: {},
            },
        },
        target: "es2022",
    },
    resolve: {
        alias: {
            "@": resolve(__dirname, "src"),
        },
    },
});
