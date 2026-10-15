import { ChevronRightIcon } from "lucide-react";
import { Fragment, useId, type ReactNode } from "react";
import type {
  HierarchyThread,
  ThreadHierarchyNode,
} from "@t3tools/client-runtime/state/threadHierarchy";
import { cn } from "../../lib/utils";

interface SidebarThreadTreeProps<T extends HierarchyThread> {
  readonly nodes: readonly ThreadHierarchyNode<T>[];
  readonly expandedByKey: Readonly<Record<string, boolean>>;
  readonly onExpandedChange: (threadKey: string, expanded: boolean) => void;
  readonly renderThread: (thread: T, depth: number) => ReactNode;
  readonly depth?: number;
}

/** Children occupy a distinct inset group; collapse controls are outside task rows. */
export function SidebarThreadTree<T extends HierarchyThread>({
  nodes,
  expandedByKey,
  onExpandedChange,
  renderThread,
  depth = 0,
}: SidebarThreadTreeProps<T>) {
  const id = useId();
  return nodes.map(({ thread, children }, index) => {
    const key = `${thread.environmentId}:${thread.id}`;
    const expanded = expandedByKey[key] !== false;
    const groupId = `${id}-${index}`;
    return (
      <Fragment key={key}>
        {renderThread(thread, depth)}
        {children.length > 0 && (
          <li
            className="my-0.5 min-w-0 list-none"
            style={{ marginLeft: depth < 5 ? 28 : 0 }}
            data-thread-subtask-group={key}
          >
            <button
              type="button"
              aria-label={`${expanded ? "Collapse" : "Expand"} subtasks`}
              aria-expanded={expanded}
              aria-controls={expanded ? groupId : undefined}
              className="flex h-5 w-full cursor-pointer items-center gap-1 rounded-sm px-2 text-left text-2xs text-sidebar-muted-foreground/60 hover:text-sidebar-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring max-sm:h-8"
              onClick={() => onExpandedChange(key, !expanded)}
            >
              <ChevronRightIcon
                aria-hidden
                className={cn("size-2.5 shrink-0", expanded && "rotate-90")}
              />
              <span>Subtasks</span>
              <span className="tabular-nums">({children.length})</span>
            </button>
            {expanded && (
              <ul
                id={groupId}
                role="group"
                aria-label="Subtasks"
                className="flex min-w-0 flex-col gap-px"
              >
                <SidebarThreadTree
                  nodes={children}
                  expandedByKey={expandedByKey}
                  onExpandedChange={onExpandedChange}
                  renderThread={renderThread}
                  depth={depth + 1}
                />
              </ul>
            )}
          </li>
        )}
      </Fragment>
    );
  });
}
