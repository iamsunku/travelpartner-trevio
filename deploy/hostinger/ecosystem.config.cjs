/** PM2 ecosystem for Hostinger VPS — /var/www/treviogobal */
const APP_ROOT = process.env.TREVIO_APP_ROOT || "/var/www/treviogobal";

module.exports = {
  apps: [
    {
      name: "trevio-api",
      cwd: `${APP_ROOT}/backend`,
      script: "dist/server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "4000",
      },
      max_memory_restart: "512M",
      time: true,
    },
    {
      name: "trevio-web",
      cwd: `${APP_ROOT}/frontend`,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3100",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3100",
      },
      max_memory_restart: "768M",
      time: true,
    },
  ],
};
