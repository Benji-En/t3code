import { useAtomValue } from "@effect/atom-react";
import { parseScopedThreadKey } from "@t3tools/client-runtime/environment";
import { resolveListedAncestorThreadRef } from "@t3tools/client-runtime/state/threads";

import { scopedThreadKey } from "../../lib/scopedEntities";
import { environmentThreadShells } from "../../state/threads";

/** Side chats and delegated tasks select their listed ancestor; local subtasks own rows. */
export function useSidebarRowThreadKey(openThreadKey: string | null): string | null {
  const threads = useAtomValue(environmentThreadShells.quietThreadShellsAtom);
  const openThreadRef = openThreadKey === null ? null : parseScopedThreadKey(openThreadKey);
  if (openThreadRef === null) return openThreadKey;
  const openThread = threads.find(
    (thread) =>
      thread.id === openThreadRef.threadId && thread.environmentId === openThreadRef.environmentId,
  );
  if (openThread?.lineage.relationshipToParent === "subagent") return openThreadKey;
  const rowRef = resolveListedAncestorThreadRef(openThreadRef, threads);
  return scopedThreadKey(rowRef.environmentId, rowRef.threadId);
}
