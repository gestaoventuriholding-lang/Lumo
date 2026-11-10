import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["client/src/**/*.test.tsx"],
    globals: true,
    // as telas usam listas do Radix e ficam lentas quando a suíte inteira roda em paralelo
    testTimeout: 20000,
    setupFiles: ["./vitest.setup.ts"],
  },
});
