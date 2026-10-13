const crypto = require("node:crypto");
const net = require("node:net");
const path = require("node:path");

function launchPipeName(home) {
  const canonical = path.resolve(home).replaceAll("/", "\\").toLowerCase();
  return "T3Code-Benji-" + crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

function installWarmLaunch({ app, icon, home, Tray, Menu, diagnostic = false }) {
  let mainWindow = null;
  let quitting = false;
  let tray = null;
  const activate = () => {
    if (quitting || !mainWindow || mainWindow.isDestroyed()) return false;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return true;
  };
  const isMainUrl = (url) => url.startsWith("t3code://app/");
  app.on("browser-window-created", (_event, window) => {
    window.webContents.on("did-start-navigation", (_event, url, _inPlace, mainFrame) => {
      if (mainFrame === false || !isMainUrl(url)) return;
      if (mainWindow && mainWindow !== window && !mainWindow.isDestroyed()) return;
      mainWindow = window;
      if (!tray && !diagnostic) {
        tray = new Tray(icon);
        tray.setToolTip("T3 Code — Benji Fork");
        tray.setContextMenu(
          Menu.buildFromTemplate([
            { label: "Open T3 Code", click: activate },
            { type: "separator" },
            { label: "Quit T3 Code", click: () => app.quit() },
          ]),
        );
        tray.on("click", activate);
      }
    });
    window.on("close", (event) => {
      if (quitting || window !== mainWindow) return;
      event.preventDefault();
      window.hide();
    });
    window.on("closed", () => {
      if (window === mainWindow) mainWindow = null;
    });
  });
  const server = net.createServer((socket) => {
    let buffer = "";
    socket.setEncoding("utf8");
    socket.setTimeout(1000, () => socket.destroy());
    socket.on("error", () => {});
    socket.on("data", (chunk) => {
      buffer += chunk;
      if (buffer.length > 1024) return socket.destroy();
      if (!buffer.includes("\n")) return;
      try {
        const request = JSON.parse(buffer.slice(0, buffer.indexOf("\n")));
        const ready = request.action === "activate" && activate();
        socket.end(JSON.stringify({ ok: true, ready }) + "\n");
      } catch {
        socket.destroy();
      }
    });
  });
  server.on("error", (error) => {
    if (error.code !== "EADDRINUSE") console.error("Fork launch pipe:", error.message);
  });
  server.listen("\\\\.\\pipe\\" + launchPipeName(home));
  app.on("before-quit", () => {
    quitting = true;
  });
  app.on("will-quit", () => {
    if (server.listening) server.close();
    tray?.destroy();
  });
  return { activate, server };
}

module.exports = { launchPipeName, installWarmLaunch };
