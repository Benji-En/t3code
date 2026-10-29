import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { useCallback, useEffect, useEffectEvent } from "react";
import {
  threadHierarchyAncestorKeys,
  type HierarchyThread,
} from "@t3tools/client-runtime/state/threadHierarchy";
import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";

const EMPTY_EXPANSION: Readonly<Record<string, boolean>> = {};

/** Device-local folds are shared by Home and the navigation sidebar. */
export function useThreadSubtaskPreferences(
  threads: readonly HierarchyThread[],
  selectedKey: string | null,
) {
  const preferences = useAtomValue(mobilePreferencesAtom);
  const savePreferences = useAtomSet(updateMobilePreferencesAtom);
  const loaded = AsyncResult.isSuccess(preferences);
  const expandedByKey = loaded
    ? (preferences.value.threadSubtasksExpandedByKey ?? EMPTY_EXPANSION)
    : EMPTY_EXPANSION;
  const revealAncestors = useEffectEvent((ancestors: readonly string[]) => {
    if (!ancestors.some((key) => expandedByKey[key] === false)) return;
    savePreferences({
      transform: (current) => {
        const next = { ...current.threadSubtasksExpandedByKey };
        for (const key of ancestors) delete next[key];
        return { threadSubtasksExpandedByKey: next };
      },
    });
  });
  const ancestorsJson = JSON.stringify(threadHierarchyAncestorKeys(threads, selectedKey));
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Navigation from either screen or history must open the selected task's persisted ancestor groups.
  useEffect(() => {
    if (!loaded || selectedKey === null) return;
    revealAncestors(JSON.parse(ancestorsJson) as string[]);
  }, [ancestorsJson, selectedKey, loaded]);
  const toggleSubtasks = useCallback(
    (key: string) => {
      if (!loaded) return;
      savePreferences({
        transform: (current) => {
          const next = { ...current.threadSubtasksExpandedByKey };
          if (next[key] === false) delete next[key];
          else next[key] = false;
          return { threadSubtasksExpandedByKey: next };
        },
      });
    },
    [loaded, savePreferences],
  );
  return { expandedByKey, toggleSubtasks, loaded };
}
