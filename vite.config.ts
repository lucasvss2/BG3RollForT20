import { defineConfig } from "vite";
import { resolve } from "path";

const FOUNDRY_OUT = process.env["FOUNDRY_OUT"] ??
    "C:/Users/lucas/AppData/Local/FoundryVTT/Data/modules/aeris-bg3-rolls-t20";

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
