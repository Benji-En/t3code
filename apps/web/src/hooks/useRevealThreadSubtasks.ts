import { useEffect } from "react";
import {
  threadHierarchyAncestorKeys,
  type HierarchyThread,
} from "@t3tools/client-runtime/state/threadHierarchy";
import { useUiStateStore } from "../uiStateStore";

/** Navigation opens the selected task's ancestors without overriding later manual folds. */
export function useRevealThreadSubtasks(
  threads: readonly HierarchyThread[],
  selectedKey: string | null,
) {
  const ancestorsJson = JSON.stringify(threadHierarchyAncestorKeys(threads, selectedKey));
  const setExpanded = useUiStateStore((state) => state.setThreadSubtasksExpanded);
  useEffect(() => {
    if (selectedKey === null) return;
    setExpanded(JSON.parse(ancestorsJson) as string[], true);
  }, [ancestorsJson, selectedKey, setExpanded]);
}
