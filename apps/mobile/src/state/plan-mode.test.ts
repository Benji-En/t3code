import { PlanId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { resolveImplementablePlanId, resolveProviderInteractionMode } from "./plan-mode";

describe("resolveProviderInteractionMode", () => {
  it.each([
    [{ showInteractionModeToggle: true }, "plan", "plan"],
    [undefined, "plan", "plan"],
    [{ showInteractionModeToggle: false }, "plan", "default"],
    [{ showInteractionModeToggle: true }, undefined, "default"],
  ] as const)("%j with %s -> %s", (provider, mode, expected) => {
    expect(resolveProviderInteractionMode(provider, mode)).toBe(expected);
  });
});

describe("resolveImplementablePlanId", () => {
  const plans = [
    { id: PlanId.make("old"), kind: "proposed_plan", status: "superseded" },
    { id: PlanId.make("todo"), kind: "todo_list", status: "active" },
    { id: PlanId.make("ready"), kind: "proposed_plan", status: "active" },
  ] as const;

  it("offers the active proposed plan while plan mode is idle", () => {
    expect(resolveImplementablePlanId({ interactionMode: "plan", idle: true, plans })).toBe(
      "ready",
    );
  });

  it.each([
    { name: "in build mode", interactionMode: "default", idle: true },
    { name: "while a run is going", interactionMode: "plan", idle: false },
  ] as const)("offers nothing $name", ({ interactionMode, idle }) => {
    expect(resolveImplementablePlanId({ interactionMode, idle, plans })).toBeNull();
  });
});
