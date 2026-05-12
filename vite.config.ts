import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, "src/main.ts"),
            fileName: "main.bundle",
            formats: ["es"],
        },
        outDir: "dist",
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
