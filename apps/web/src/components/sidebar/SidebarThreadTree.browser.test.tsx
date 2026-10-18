import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vite-plus/test";
import {
  buildThreadHierarchy,
  buildThreadHierarchyTree,
  threadHierarchyRoots,
} from "@t3tools/client-runtime/state/threadHierarchy";
import { useUiStateStore, parsePersistedState } from "../../uiStateStore";
import { useRevealThreadSubtasks } from "../../hooks/useRevealThreadSubtasks";
import { SidebarThreadTree } from "./SidebarThreadTree";

const task = (id: string, parent: string | null = null) => ({
  id,
  environmentId: "local",
  archivedAt: null,
  lineage: { parentThreadId: parent, relationshipToParent: parent ? "subagent" : null },
});
const threads = [task("owner"), task("child", "owner"), task("grandchild", "child"), task("other")];
const roots = threadHierarchyRoots(threads);
const nodes = buildThreadHierarchyTree(roots, threads);

function TaskList({ selected }: { selected: string | null }) {
  const expandedByKey = useUiStateStore((state) => state.threadSubtasksExpandedByKey);
  const setExpanded = useUiStateStore((state) => state.setThreadSubtasksExpanded);
  useRevealThreadSubtasks(threads, selected);
  const visible = buildThreadHierarchy(roots, threads, expandedByKey);
  return (
    <>
      <ul>
        <SidebarThreadTree
          nodes={nodes}
          expandedByKey={expandedByKey}
          onExpandedChange={setExpanded}
          renderThread={(thread) => (
            <li data-task={thread.id}>
              <button>{thread.id} Working</button>
            </li>
          )}
        />
      </ul>
      <output>{visible.map(({ thread }) => thread.id).join(",")}</output>
    </>
  );
}

afterEach(() => {
  useUiStateStore.setState({ threadSubtasksExpandedByKey: {} });
  vi.unstubAllGlobals();
});

it("folds a subtree, remembers nested folds, and reveals a child opened through navigation", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const group = (key: string) =>
    container.querySelector(`[data-thread-subtask-group="local:${key}"]`)!;
  try {
    await act(() => root.render(<TaskList selected="local:grandchild" />));
    expect(container.querySelector('[data-task="grandchild"]')).not.toBeNull();
    await act(() => (group("child").querySelector("button") as HTMLButtonElement).click());
    expect(container.querySelector('[data-task="grandchild"]')).toBeNull();
    expect(container.querySelector("output")?.textContent).toBe("owner,child,other");
    await act(() => (group("owner").querySelector("button") as HTMLButtonElement).click());
    expect(container.querySelector('[data-task="child"]')).toBeNull();
    expect(container.querySelector('[data-task="owner"]')?.textContent).toContain("Working");
    expect(container.querySelector('[data-task="other"]')).not.toBeNull();
    expect(container.querySelector("output")?.textContent).toBe("owner,other");
    const persisted = JSON.stringify({
      threadSubtasksExpandedByKey: useUiStateStore.getState().threadSubtasksExpandedByKey,
    });
    await act(() => {
      useUiStateStore.setState(parsePersistedState(JSON.parse(persisted)));
      root.render(<TaskList selected="local:other" />);
    });
    expect(container.querySelector('[data-task="child"]')).toBeNull();
    await act(() => (group("owner").querySelector("button") as HTMLButtonElement).click());
    expect(container.querySelector('[data-task="child"]')).not.toBeNull();
    expect(container.querySelector('[data-task="grandchild"]')).toBeNull();
    await act(() => root.render(<TaskList selected="local:grandchild" />));
    expect(container.querySelector('[data-task="grandchild"]')).not.toBeNull();
    expect(container.querySelector("output")?.textContent).toBe("owner,child,grandchild,other");
  } finally {
    await act(() => root.unmount());
    container.remove();
  }
});
