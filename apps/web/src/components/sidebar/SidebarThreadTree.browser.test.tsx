import { expect, it } from "vite-plus/test";
import { act, render } from "../../../test/render";
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
          renderThread={(thread, _depth, toggle) => (
            <li data-task={thread.id} data-testid={thread.id}>
              <button>{thread.id} Working</button>
              {toggle}
            </li>
          )}
        />
      </ul>
      <output data-testid="visible-tasks">
        {visible.map(({ thread }) => thread.id).join(",")}
      </output>
    </>
  );
}

function setup() {
  useUiStateStore.setState({ threadSubtasksExpandedByKey: {} });
  return {
    [Symbol.dispose]: () => useUiStateStore.setState({ threadSubtasksExpandedByKey: {} }),
  };
}

it("folds a subtree, remembers nested folds, and reveals a child opened through navigation", async () => {
  using _state = setup();
  await using screen = await render(<TaskList selected="local:grandchild" />);
  await expect.element(screen.getByTestId("grandchild")).toBeInTheDocument();
  await screen.getByTestId("child").getByRole("button", { name: "Collapse subtasks" }).click();
  await expect.element(screen.getByTestId("grandchild")).not.toBeInTheDocument();
  await expect.element(screen.getByTestId("visible-tasks")).toHaveTextContent("owner,child,other");
  await screen.getByTestId("owner").getByRole("button", { name: "Collapse subtasks" }).click();
  await expect.element(screen.getByTestId("child")).not.toBeInTheDocument();
  await expect.element(screen.getByTestId("owner")).toHaveTextContent("Working");
  await expect.element(screen.getByTestId("other")).toBeInTheDocument();
  await expect.element(screen.getByTestId("visible-tasks")).toHaveTextContent("owner,other");
  const persisted = JSON.stringify({
    threadSubtasksExpandedByKey: useUiStateStore.getState().threadSubtasksExpandedByKey,
  });
  await act(() => useUiStateStore.setState(parsePersistedState(JSON.parse(persisted))));
  await screen.rerender(<TaskList selected="local:other" />);
  await expect.element(screen.getByTestId("child")).not.toBeInTheDocument();
  await screen.getByTestId("owner").getByRole("button", { name: "Expand subtasks" }).click();
  await expect.element(screen.getByTestId("child")).toBeInTheDocument();
  await expect.element(screen.getByTestId("grandchild")).not.toBeInTheDocument();
  await screen.rerender(<TaskList selected="local:grandchild" />);
  await expect.element(screen.getByTestId("grandchild")).toBeInTheDocument();
  await expect
    .element(screen.getByTestId("visible-tasks"))
    .toHaveTextContent("owner,child,grandchild,other");
});
