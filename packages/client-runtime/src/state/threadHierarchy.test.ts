import { describe, expect, it } from "vite-plus/test";
import { ThreadId } from "@t3tools/contracts";
import {
  buildThreadHierarchy,
  threadHierarchyRoots,
  threadHierarchyOwnerKey,
} from "./threadHierarchy.ts";

function thread(id: string, parent: string | null = null, environmentId = "local") {
  return {
    id: ThreadId.make(id),
    environmentId,
    archivedAt: null as string | null,
    lineage: {
      parentThreadId: parent === null ? null : ThreadId.make(parent),
      relationshipToParent: parent === null ? null : "subagent",
    },
  };
}

describe("sidebar task hierarchy", () => {
  it("reveals the nearest sidebar owner when opening a nested child", () => {
    const threads = [thread("parent"), thread("child", "parent"), thread("grandchild", "child")];
    expect(threadHierarchyOwnerKey(threads, "local:grandchild")).toBe("local:parent");
    expect(
      threadHierarchyOwnerKey(
        [{ ...threads[0]!, archivedAt: "today" }, ...threads.slice(1)],
        "local:grandchild",
      ),
    ).toBe("local:child");
  });
  it("keeps nested children with their owner regardless of activity order", () => {
    const threads = [
      thread("grandchild", "child"),
      thread("other"),
      thread("child", "parent"),
      thread("parent"),
    ];
    expect(
      buildThreadHierarchy(threadHierarchyRoots(threads), threads).map(({ thread, depth }) => [
        thread.id,
        depth,
      ]),
    ).toEqual([
      ["other", 0],
      ["parent", 0],
      ["child", 1],
      ["grandchild", 2],
    ]);
  });

  it("scopes ownership by environment and exposes children of archived owners", () => {
    const threads = [
      thread("parent"),
      thread("child", "parent", "remote"),
      { ...thread("old"), archivedAt: "today" },
      thread("orphan", "old"),
    ];
    expect(threadHierarchyRoots(threads).map((thread) => thread.id)).toEqual([
      "parent",
      "child",
      "orphan",
    ]);
  });

  it("excludes archived children and visits cyclic or duplicate inputs once", () => {
    const parent = thread("parent", "child");
    const threads = [
      parent,
      thread("child", "parent"),
      { ...thread("archived", "parent"), archivedAt: "today" },
    ];
    expect(buildThreadHierarchy([parent, parent], threads).map(({ thread }) => thread.id)).toEqual([
      "parent",
      "child",
    ]);
  });
});
