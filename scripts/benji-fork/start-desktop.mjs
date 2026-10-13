import * as NodeChildProcess from "node:child_process";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import {
  desktopDir,
  resolveElectronLaunchCommand,
} from "../../apps/desktop/scripts/electron-launcher.mjs";

NodeChildProcess.execFileSync(
  process.execPath,
  [NodePath.resolve(desktopDir, "scripts/build-browser-secret.mjs")],
  {
    stdio: "inherit",
  },
);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const entry =
  env.T3_BENJI_AUDIT_ENTRY ||
  NodePath.resolve(
    NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)),
    "desktop-bootstrap.cjs",
  );
const command = resolveElectronLaunchCommand([entry]);
const child = NodeChildProcess.spawn(command.electronPath, command.args, {
  cwd: desktopDir,
  env,
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 0));
