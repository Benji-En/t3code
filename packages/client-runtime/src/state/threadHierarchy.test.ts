import { describe, expect, it } from "vite-plus/test";
import { ThreadId } from "@t3tools/contracts";
import {
  buildThreadHierarchy,
  threadHierarchyRoots,
  threadHierarchyOwnerKey,
  threadHierarchyAncestorKeys,
  buildThreadHierarchyTree,
  threadHierarchyPreviewRoots,
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
  it("pages whole parent groups and keeps an opened child's owner visible", () => {
    const threads = [
      thread("first"),
      thread("child", "first"),
      thread("second"),
      thread("opened", "second"),
    ];
    const roots = threadHierarchyRoots(threads);
    const preview = threadHierarchyPreviewRoots(roots, threads, 1, null);
    expect(buildThreadHierarchy(preview, threads).map(({ thread }) => thread.id)).toEqual([
      "first",
      "child",
    ]);
    expect(
      threadHierarchyPreviewRoots(roots, threads, 1, "local:opened").map((thread) => thread.id),
    ).toEqual(["first", "second"]);
    expect(threadHierarchyPreviewRoots(roots, threads, 1, "remote:opened")).toEqual(preview);
  });
  it("folds only the owner's subtree and preserves sibling order and depth", () => {
    const threads = [
      thread("parent"),
      thread("child", "parent"),
      thread("grandchild", "child"),
      thread("sibling", "parent"),
      thread("other"),
    ];
    const rows = (expanded: Record<string, boolean>) =>
      buildThreadHierarchy(threadHierarchyRoots(threads), threads, expanded).map(
        ({ thread, depth }) => [thread.id, depth],
      );
    expect(rows({ "local:child": false })).toEqual([
      ["parent", 0],
      ["child", 1],
      ["sibling", 1],
      ["other", 0],
    ]);
    expect(rows({ "local:parent": false })).toEqual([
      ["parent", 0],
      ["other", 0],
    ]);
    expect(rows({ "remote:parent": false })).toHaveLength(5);
    const tree = buildThreadHierarchyTree(threadHierarchyRoots(threads), threads);
    expect(tree[0]?.children.map((node) => node.thread.id)).toEqual(["child", "sibling"]);
    expect(tree[0]?.children[0]?.children[0]?.thread.id).toBe("grandchild");
  });
  it("reveals every visible ancestor without crossing environments or archived parents", () => {
    const threads = [thread("parent"), thread("child", "parent"), thread("grandchild", "child")];
    expect(threadHierarchyAncestorKeys(threads, "local:grandchild")).toEqual([
      "local:child",
      "local:parent",
    ]);
    expect(threadHierarchyAncestorKeys(threads, "remote:grandchild")).toEqual([]);
    expect(
      threadHierarchyAncestorKeys(
        [{ ...threads[0]!, archivedAt: "today" }, ...threads.slice(1)],
        "local:grandchild",
      ),
    ).toEqual(["local:child"]);
    expect(threadHierarchyAncestorKeys([thread("a", "b"), thread("b", "a")], "local:a")).toEqual([
      "local:b",
    ]);
  });
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
