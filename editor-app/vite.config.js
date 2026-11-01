import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Builds the editor page straight into the extension folder.
export default defineConfig({
    plugins: [react()],
    base: "./",
    build: {
        outDir: "../extension/editor",
        emptyOutDir: true,
        chunkSizeWarningLimit: 5000,
    },
    worker: { format: "es" },
});
