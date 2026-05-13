import { defineConfig } from "vite";
import { resolve } from "path";

// Local dev: override via env var to deploy directly to Foundry's module folder.
// CI/release: leave unset so the build goes to dist/ and the release workflow can zip it.
const FOUNDRY_OUT = process.env["FOUNDRY_OUT"] ?? "dist";

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, "src/main.ts"),
            fileName: "main.bundle",
            formats: ["es"],
        },
        outDir: FOUNDRY_OUT,
        minify: false,
        sourcemap: true,
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
