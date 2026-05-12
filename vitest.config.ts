import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
    test: {
        environment: "node",
        globals: false,
        setupFiles: ["./src/tests/setup.ts"],
    },
    resolve: {
        alias: {
            "@": resolve(__dirname, "src"),
        },
    },
});
