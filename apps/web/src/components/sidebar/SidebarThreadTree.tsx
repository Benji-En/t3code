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
  readonly renderThread: (thread: T, depth: number, subtaskToggle: ReactNode) => ReactNode;
  readonly depth?: number;
}

/** Disclosure belongs to the parent row; only children consume indented list space. */
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
        {renderThread(
          thread,
          depth,
          children.length > 0 ? (
            <button
              type="button"
              aria-label={`${expanded ? "Collapse" : "Expand"} subtasks`}
              aria-description={`${children.length} subtasks`}
              aria-expanded={expanded}
              aria-controls={expanded ? groupId : undefined}
              className="inline-flex h-5 shrink-0 cursor-pointer items-center gap-0.5 rounded-sm px-0.5 text-2xs text-sidebar-muted-foreground/60 hover:text-sidebar-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring max-sm:min-h-8 max-sm:min-w-8"
              onPointerDown={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onExpandedChange(key, !expanded);
              }}
            >
              <ChevronRightIcon
                aria-hidden
                className={cn("size-2.5 shrink-0", expanded && "rotate-90")}
              />
              <span className="tabular-nums">{children.length}</span>
            </button>
          ) : null,
        )}
        {children.length > 0 && (
          <li
            className="min-w-0 list-none"
            style={{ marginLeft: depth < 5 ? 28 : 0 }}
            data-thread-subtask-group={key}
          >
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
