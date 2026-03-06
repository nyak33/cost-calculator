import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const isGitHubActions = process.env.GITHUB_ACTIONS === "true";
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const ghBase = isGitHubActions && repoName ? `/${repoName}/` : "/";

export default defineConfig({
  base: ghBase,
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/tests/setup.ts",
  },
});
