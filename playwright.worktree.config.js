import base from "/home/user/dashboardmodern-v2/.claude/worktrees/agent-a7b1adfd5cd5a685b/playwright.config.js";
export default {
  ...base,
  testDir:
    "/home/user/dashboardmodern-v2/.claude/worktrees/agent-a7b1adfd5cd5a685b/custom_components/dashboardmodern/frontend/e2e",
  workers: 2,
  use: { ...base.use, baseURL: "http://127.0.0.1:4174" },
  webServer: {
    command:
      "python3 /tmp/claude-0/-home-user-dashboardmodern-v2/6ca0831c-80c6-5d00-9099-5a63de90c0a2/scratchpad/servi-svelto.py 4174 /home/user/dashboardmodern-v2/.claude/worktrees/agent-a7b1adfd5cd5a685b/custom_components/dashboardmodern/frontend",
    port: 4174,
    reuseExistingServer: false,
  },
  projects: base.projects
    .filter((p) => p.name !== "webkit-ipad")
    .map((p) => ({ ...p, use: { ...p.use, launchOptions: { executablePath: "/opt/pw-browsers/chromium" } } })),
};
