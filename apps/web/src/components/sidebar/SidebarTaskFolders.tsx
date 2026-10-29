import { useEffect, useEffectEvent, useId, useState, type ReactNode } from "react";
import * as Schema from "effect/Schema";
import { DndContext, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { ChevronRightIcon } from "lucide-react";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/models";
import type { EnvironmentId, ProjectId, ProjectTaskFolder, ThreadId } from "@t3tools/contracts";
import { groupTaskFolderRoots } from "@t3tools/client-runtime/state/taskFolders";
import {
  buildThreadHierarchyTree,
  threadHierarchyOwnerKey,
  type HierarchyThread,
} from "@t3tools/client-runtime/state/threadHierarchy";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { readLocalApi } from "../../localApi";
import { cn } from "../../lib/utils";
import { SidebarThreadTree } from "./SidebarThreadTree";
import { useTaskFolderActions } from "./TaskFolderControls";
import { LegacySidebarDrafts } from "./LegacySidebarDrafts";
import { useThreadRouteTarget } from "../../hooks/useThreadRouteTarget";
import { useComposerDraftStore } from "../../composerDraftStore";

const EMPTY_EXPANSION: Record<string, boolean> = {};
const EXPANSION_SCHEMA = Schema.Record(Schema.String, Schema.Boolean);
type FolderThread = HierarchyThread & {
  readonly id: ThreadId;
  readonly projectId: ProjectId;
  readonly environmentId: EnvironmentId;
  readonly taskFolderId?: string | null;
};

function FolderDropTarget(props: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: props.id });
  return (
    <li
      ref={setNodeRef}
      className={cn("min-w-0 list-none rounded-sm", isOver && "bg-sidebar-row-active")}
    >
      {props.children}
    </li>
  );
}

function FolderHeader(props: {
  project: EnvironmentProject;
  folder: ProjectTaskFolder;
  expanded: boolean;
  controlsId: string;
  toggle: () => void;
}) {
  const actions = useTaskFolderActions();
  return (
    <button
      type="button"
      aria-expanded={props.expanded}
      aria-controls={props.controlsId}
      className="flex h-7 w-full cursor-pointer items-center gap-1 px-2 text-left text-xs text-sidebar-muted-foreground hover:text-sidebar-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
      onClick={props.toggle}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const api = readLocalApi();
        if (!api || !actions.canEdit(props.project)) return;
        void api.contextMenu
          .show(
            [
              { id: "new-task", label: "New task" },
              { id: "rename", label: "Rename folder" },
              { id: "delete", label: "Delete folder", destructive: true },
            ],
            { x: event.clientX, y: event.clientY },
          )
          .then((action) => {
            if (action === "new-task") void actions.newTask(props.project, props.folder.id);
            if (action === "rename") void actions.rename(props.project, props.folder);
            if (action === "delete") void actions.remove(props.project, props.folder);
          });
      }}
    >
      <ChevronRightIcon
        aria-hidden
        className={cn("size-3 shrink-0", props.expanded && "rotate-90")}
      />
      <span className="truncate">{props.folder.name}</span>
    </button>
  );
}

export function SidebarTaskFolders<T extends FolderThread>(props: {
  roots: readonly T[];
  threads: readonly T[];
  projects: readonly EnvironmentProject[];
  selectedKey: string | null;
  showDrafts?: boolean;
  showEmptyFolders?: boolean;
  expandedSubtasks: Readonly<Record<string, boolean>>;
  onSubtasksChange: (key: string, expanded: boolean) => void;
  renderThread: (thread: T, depth: number, toggle: ReactNode) => ReactNode;
}) {
  const id = useId();
  const groups = groupTaskFolderRoots(props.roots, props.projects);
  const actions = useTaskFolderActions();
  const [expanded, setExpanded] = useLocalStorage(
    "t3code:task-folder-expansion:v1",
    EMPTY_EXPANSION,
    EXPANSION_SCHEMA,
  );
  const [dragging, setDragging] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const ownerKey = threadHierarchyOwnerKey(props.threads, props.selectedKey);
  const owner = props.threads.find((thread) => `${thread.environmentId}:${thread.id}` === ownerKey);
  const route = useThreadRouteTarget();
  const draft = useComposerDraftStore((state) =>
    route?.kind === "draft" ? state.draftThreadsByThreadKey[route.draftId] : undefined,
  );
  const selected = draft ?? owner;
  const selectedFolderKey =
    groups.folders.find(
      (group) =>
        selected &&
        group.project.id === selected.projectId &&
        group.project.environmentId === selected.environmentId &&
        group.folder.id === selected.taskFolderId,
    )?.key ?? null;
  const reveal = useEffectEvent((key: string) =>
    setExpanded((current) => ({ ...current, [key]: true })),
  );
  const navigationKey = props.selectedKey ?? (route?.kind === "draft" ? route.draftId : null);
  // oxlint-disable-next-line t3code/react-effect-budget -- Route navigation must reveal the selected task's persisted folder.
  useEffect(() => {
    if (navigationKey !== null && selectedFolderKey !== null) reveal(selectedFolderKey);
  }, [navigationKey, selectedFolderKey]);
  const tree = (roots: readonly T[]) => (
    <SidebarThreadTree
      nodes={buildThreadHierarchyTree(roots, props.threads)}
      expandedByKey={props.expandedSubtasks}
      onExpandedChange={props.onSubtasksChange}
      renderThread={props.renderThread}
    />
  );
  return (
    <DndContext
      sensors={sensors}
      onDragStart={() => setDragging(true)}
      onDragCancel={() => setDragging(false)}
      onDragEnd={(event) => {
        setDragging(false);
        const thread = props.roots.find(
          (candidate) => `${candidate.environmentId}:${candidate.id}` === String(event.active.id),
        );
        if (!thread || !event.over) return;
        const target = String(event.over.id);
        const group = groups.folders.find(
          (candidate) => `task-folder-drop:${candidate.key}` === target,
        );
        if (
          group &&
          group.project.id === thread.projectId &&
          group.project.environmentId === thread.environmentId
        )
          void actions.move(scopeThreadRef(thread.environmentId, thread.id), group.folder.id);
        else if (target === "task-folder-drop:root")
          void actions.move(scopeThreadRef(thread.environmentId, thread.id), null);
      }}
    >
      {dragging && (
        <FolderDropTarget id="task-folder-drop:root">
          <span className="block px-2 py-1 text-xs text-sidebar-muted-foreground">
            Project root
          </span>
        </FolderDropTarget>
      )}
      {tree(groups.unfiled)}
      {props.showDrafts !== false && <li className="list-none"><LegacySidebarDrafts projects={props.projects} taskFolderId={null} /></li>}
      {groups.folders.filter((group) => props.showEmptyFolders !== false || group.threads.length > 0).map((group, index) => {
        const open = expanded[group.key] !== false;
        const controlsId = `${id}-${index}`;
        const project = props.projects.find(
          (candidate) =>
            candidate.id === group.project.id &&
            candidate.environmentId === group.project.environmentId,
        )!;
        return (
          <FolderDropTarget key={group.key} id={`task-folder-drop:${group.key}`}>
            <FolderHeader
              project={project}
              folder={group.folder}
              expanded={open}
              controlsId={controlsId}
              toggle={() => setExpanded((current) => ({ ...current, [group.key]: !open }))}
            />
            {open && (
              <ul id={controlsId} aria-label={group.folder.name} className="ml-3 min-w-0">
                {props.showDrafts !== false && <li className="list-none"><LegacySidebarDrafts projects={[project]} taskFolderId={group.folder.id} /></li>}
                {tree(group.threads)}
              </ul>
            )}
          </FolderDropTarget>
        );
      })}
    </DndContext>
  );
}
