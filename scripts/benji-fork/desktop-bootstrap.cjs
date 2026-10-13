const { createRequire } = require("node:module");
const { join, resolve } = require("node:path");
const repo = resolve(__dirname, "../..");
const { app, Tray, Menu } = createRequire(join(repo, "apps/desktop/package.json"))("electron");
const icon = join(repo, "assets/benji-fork/icon.ico");
const launcher = join(repo, "assets/benji-fork/bin/T3 Code Benji Fast.exe");
if (require("node:os").platform() === "win32") {
  require("./warm-launch.cjs").installWarmLaunch({
    app,
    Tray,
    Menu,
    icon,
    home: process.env.T3CODE_HOME,
    diagnostic: Boolean(process.env.T3_BENJI_AUDIT_PIPE),
  });
}

// Keep the fork's window, taskbar group and relaunch target consistent without
// changing the upstream shell or its official launch path.
app.on("browser-window-created", (_event, window) => {
  window.setIcon(icon);
  window.setAppDetails({
    appId: "com.benji.t3code.fork",
    appIconPath: icon,
    relaunchCommand: `"${launcher}"`,
    relaunchDisplayName: "T3 Code — Benji Fork",
  });
});
require(join(repo, "apps/desktop/dist-electron/main.cjs"));
