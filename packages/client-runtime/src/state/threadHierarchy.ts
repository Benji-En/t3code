export interface HierarchyThread {
  readonly id: string;
  readonly environmentId: string;
  readonly archivedAt: unknown;
  readonly lineage: {
    readonly parentThreadId: string | null;
    readonly relationshipToParent: string | null;
  };
}

const keyOf = (thread: HierarchyThread) => `${thread.environmentId}:${thread.id}`;

/** Ancestors to expand when navigation opens a task inside a folded group. */
export function threadHierarchyAncestorKeys(
  threads: readonly HierarchyThread[],
  selectedKey: string | null,
): string[] {
  const byKey = new Map(
    threads.filter((thread) => thread.archivedAt === null).map((thread) => [keyOf(thread), thread]),
  );
  const ancestors: string[] = [];
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
    if (!byKey.has(parentKey) || visited.has(parentKey)) break;
    ancestors.push(parentKey);
    key = parentKey;
  }
  return ancestors;
}

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
  expandedByKey: Readonly<Record<string, boolean>> = {},
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
    if (expandedByKey[key] === false) continue;
    const siblings = children.get(key) ?? [];
    for (let index = siblings.length - 1; index >= 0; index -= 1) {
      pending.push({ thread: siblings[index]!, depth: row.depth + 1 });
    }
  }
  return rows;
}

export interface ThreadHierarchyNode<T extends HierarchyThread> {
  readonly thread: T;
  readonly children: ThreadHierarchyNode<T>[];
}

/** Nested groups retain their children so folded groups still show their count. */
export function buildThreadHierarchyTree<T extends HierarchyThread>(
  roots: readonly T[],
  threads: readonly T[],
): ThreadHierarchyNode<T>[] {
  const tree: ThreadHierarchyNode<T>[] = [];
  const parents: ThreadHierarchyNode<T>[] = [];
  for (const { thread, depth } of buildThreadHierarchy(roots, threads)) {
    const node: ThreadHierarchyNode<T> = { thread, children: [] };
    if (depth === 0) tree.push(node);
    else parents[depth - 1]!.children.push(node);
    parents[depth] = node;
  }
  return tree;
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

/** Page parent groups as a unit and retain the owner of a task opened by navigation. */
export function threadHierarchyPreviewRoots<T extends HierarchyThread>(
  roots: readonly T[],
  threads: readonly T[],
  limit: number,
  selectedKey: string | null,
): T[] {
  const ownerKey = threadHierarchyOwnerKey(threads, selectedKey);
  return roots.filter((thread, index) => index < limit || keyOf(thread) === ownerKey);
}
