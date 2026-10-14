interface HierarchyThread {
  readonly id: string;
  readonly environmentId: string;
  readonly archivedAt: unknown;
  readonly lineage: {
    readonly parentThreadId: string | null;
    readonly relationshipToParent: string | null;
  };
}

const keyOf = (thread: HierarchyThread) => `${thread.environmentId}:${thread.id}`;

/** Opening a child reveals its owner when that owner's shelf is collapsed. */
export function threadHierarchyOwnerKey(
  threads: readonly HierarchyThread[],
  selectedKey: string | null,
): string | null {
  const byKey = new Map(
    threads.filter((thread) => thread.archivedAt === null).map((thread) => [keyOf(thread), thread]),
  );
  const visited = new Set<string>();
  let key = selectedKey;
  while (key !== null && !visited.has(key)) {
    visited.add(key);
    const thread = byKey.get(key);
    if (
      !thread ||
      thread.lineage.relationshipToParent !== "subagent" ||
      thread.lineage.parentThreadId === null
    )
      break;
    const parentKey = `${thread.environmentId}:${thread.lineage.parentThreadId}`;
    if (!byKey.has(parentKey)) break;
    key = parentKey;
  }
  return key;
}

/** Keep children beside their owner, preserving the supplied sibling order. */
export function buildThreadHierarchy<T extends HierarchyThread>(
  roots: readonly T[],
  threads: readonly T[],
): Array<{ thread: T; depth: number }> {
  const children = new Map<string, T[]>();
  for (const thread of threads) {
    if (
      thread.archivedAt !== null ||
      thread.lineage.relationshipToParent !== "subagent" ||
      thread.lineage.parentThreadId === null
    )
      continue;
    const key = `${thread.environmentId}:${thread.lineage.parentThreadId}`;
    const siblings = children.get(key);
    if (siblings) siblings.push(thread);
    else children.set(key, [thread]);
  }
  const rows: Array<{ thread: T; depth: number }> = [];
  const visited = new Set<string>();
  const pending: Array<{ thread: T; depth: number }> = [];
  for (let index = roots.length - 1; index >= 0; index -= 1)
    pending.push({ thread: roots[index]!, depth: 0 });
  while (pending.length > 0) {
    const row = pending.pop()!;
    const key = keyOf(row.thread);
    if (visited.has(key)) continue;
    visited.add(key);
    rows.push(row);
    const siblings = children.get(key) ?? [];
    for (let index = siblings.length - 1; index >= 0; index -= 1) {
      pending.push({ thread: siblings[index]!, depth: row.depth + 1 });
    }
  }
  return rows;
}

/** Missing or archived owners must not hide an otherwise visible child. */
export function threadHierarchyRoots<T extends HierarchyThread>(threads: readonly T[]): T[] {
  const visible = threads.filter((thread) => thread.archivedAt === null);
  const keys = new Set(visible.map(keyOf));
  return visible.filter(
    (thread) =>
      thread.lineage.relationshipToParent !== "subagent" ||
      thread.lineage.parentThreadId === null ||
      !keys.has(`${thread.environmentId}:${thread.lineage.parentThreadId}`),
  );
}
