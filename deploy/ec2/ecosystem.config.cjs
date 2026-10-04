const path = require("path");

const root = process.env.BROKERVERSE_ROOT || "/home/ubuntu/appdata/brokerverse";
// release.sh points this at <root>/current/backend (the artefact built by CI); deploy.sh (git checkout) at <root>/backend
const appDir = process.env.BROKERVERSE_APP_DIR || path.join(root, "backend");

module.exports = {
  apps: [
    {
      name: "brokerverse-api",
      cwd: appDir,
      script: "src/server.js",
      interpreter: process.env.BROKERVERSE_NODE || "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "700M",
      kill_timeout: 30000,
      env: {
        NODE_ENV: "production",
        PORT: process.env.BROKERVERSE_PORT || "8001",
      },
    },
  ],
};
