import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["supabase/live/**/*.test.ts"],
    hookTimeout: 60000,
    testTimeout: 30000,
    fileParallelism: false,
  },
});
