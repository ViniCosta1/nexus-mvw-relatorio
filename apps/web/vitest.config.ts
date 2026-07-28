import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// Mirrors the path aliases declared in tsconfig.json so modules under test
// that use "@/..." internal imports (e.g. lib/queries/overview.ts importing
// "@/lib/db") resolve correctly under vitest, which does not read tsconfig
// paths on its own.
export default defineConfig({
  resolve: {
    alias: {
      "@workspace/ui": path.resolve(rootDir, "../../packages/ui/src"),
      "@": rootDir,
    },
  },
})
