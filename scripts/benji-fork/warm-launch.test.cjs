const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter, once } = require("node:events");
const net = require("node:net");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { installWarmLaunch, launchPipeName } = require("./warm-launch.cjs");

test("close preserves the window, activation reuses it, Quit permits shutdown", async () => {
  const app = new EventEmitter();
  const home = path.join(os.tmpdir(), "t3-warm-test-" + randomUUID());
  const counts = { hide: 0, show: 0, focus: 0, restore: 0, prevent: 0 };
  const window = Object.assign(new EventEmitter(), {
    webContents: new EventEmitter(),
    isDestroyed: () => false,
    isMinimized: () => true,
    hide: () => counts.hide++,
    show: () => counts.show++,
    focus: () => counts.focus++,
    restore: () => counts.restore++,
  });
  const warm = installWarmLaunch({ app, home, diagnostic: true });
  await once(warm.server, "listening");
  try {
    app.emit("browser-window-created", {}, window);
    // Auxiliary windows retain their normal close behavior.
    window.emit("close", { preventDefault: () => counts.prevent++ });
    assert.equal(counts.prevent, 0);
    window.webContents.emit("did-start-navigation", {}, "t3code://app/", false, true);
    const auxiliary = Object.assign(new EventEmitter(), { webContents: new EventEmitter() });
    app.emit("browser-window-created", {}, auxiliary);
    auxiliary.webContents.emit("did-start-navigation", {}, "t3code://app/preview", false, true);
    auxiliary.emit("close", {
      preventDefault: () => assert.fail("auxiliary close was intercepted"),
    });
    window.emit("close", { preventDefault: () => counts.prevent++ });
    assert.equal(counts.hide, 1);
    assert.equal(counts.prevent, 1);
    const reply = await new Promise((resolve, reject) => {
      const socket = net.connect("\\\\.\\pipe\\" + launchPipeName(home));
      socket.on("error", reject);
      socket.on("connect", () => socket.write('{"action":"activate"}\n'));
      socket.on("data", (data) => {
        resolve(JSON.parse(data));
        socket.end();
      });
    });
    assert.deepEqual(reply, { ok: true, ready: true });
    assert.deepEqual(counts, { hide: 1, prevent: 1, show: 1, focus: 1, restore: 1 });
    app.emit("before-quit");
    window.emit("close", { preventDefault: () => counts.prevent++ });
    assert.equal(counts.prevent, 1);
    assert.equal(warm.activate(), false);
  } finally {
    const closed = once(warm.server, "close");
    app.emit("will-quit");
    await closed;
  }
});

test("a destroyed window cannot be reactivated", async () => {
  const app = new EventEmitter();
  const warm = installWarmLaunch({
    app,
    home: path.join(os.tmpdir(), randomUUID()),
    diagnostic: true,
  });
  await once(warm.server, "listening");
  const window = Object.assign(new EventEmitter(), {
    webContents: new EventEmitter(),
    isDestroyed: () => true,
    show: () => assert.fail("destroyed window was shown"),
  });
  app.emit("browser-window-created", {}, window);
  window.webContents.emit("did-start-navigation", {}, "t3code://app/", false, true);
  assert.equal(warm.activate(), false);
  const closed = once(warm.server, "close");
  app.emit("will-quit");
  await closed;
});
