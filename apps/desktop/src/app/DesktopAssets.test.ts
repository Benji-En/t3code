import * as NodePath from "@effect/platform-node/NodePath";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import * as DesktopAssets from "./DesktopAssets.ts";
import * as DesktopConfig from "./DesktopConfig.ts";
import * as DesktopEnvironment from "./DesktopEnvironment.ts";

describe("DesktopAssets", () => {
  it.effect.each([
    { identity: "com.benji.t3code.fork", hasForkIcon: true, expected: "benji-fork/icon.ico" },
    {
      identity: "com.benji.t3code.fork",
      hasForkIcon: false,
      expected: "prod/t3-black-windows.ico",
    },
    { identity: "com.t3tools.t3code", hasForkIcon: true, expected: "prod/t3-black-windows.ico" },
  ])("resolves Windows icon for $identity, fork asset $hasForkIcon", (scenario) =>
    Effect.gen(function* () {
      const environment = DesktopEnvironment.layer({
        dirname: "/repo/apps/desktop/dist-electron",
        homeDirectory: "/Users/alice",
        platform: "win32",
        processArch: "x64",
        appVersion: "1.2.3",
        appPath: "/repo",
        isPackaged: false,
        resourcesPath: "/repo/apps/desktop/resources",
        runningUnderArm64Translation: false,
      }).pipe(
        Layer.provide(
          Layer.mergeAll(
            NodeServices.layer,
            NodePath.layerPosix,
            DesktopConfig.layerTest({ T3CODE_DESKTOP_APP_USER_MODEL_ID: scenario.identity }),
          ),
        ),
      );
      const filesystem = FileSystem.layerNoop({
        exists: (path) =>
          Effect.succeed(
            String(path).includes("/assets/prod/") ||
              (scenario.hasForkIcon && String(path).includes("/assets/benji-fork/")),
          ),
      });
      const assets = yield* DesktopAssets.DesktopAssets.pipe(
        Effect.provide(
          DesktopAssets.layer.pipe(Layer.provide(Layer.merge(filesystem, environment))),
        ),
      );
      const icons = yield* assets.iconPaths;
      assert.equal(Option.getOrThrow(icons.ico), `/repo/assets/${scenario.expected}`);
      assert.match(Option.getOrThrow(icons.png), /assets\/prod\/black-universal-1024\.png$/);
    }),
  );
});
