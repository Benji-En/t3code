import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { useEffect, useEffectEvent } from "react";
import { Pressable } from "react-native";
import type { MenuAction } from "@react-native-menu/menu";
import {
  AuthOrchestrationOperateScope,
  type ProjectTaskFolder,
  type ProjectTaskFolderOperation,
} from "@t3tools/contracts";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import { groupTaskFolderRoots, taskFolderKey } from "@t3tools/client-runtime/state/taskFolders";
import { threadHierarchyOwnerKey } from "@t3tools/client-runtime/state/threadHierarchy";
import { Menu } from "../../components/ui/Menu";
import { AppText as Text } from "../../components/ui/AppText";
import { SymbolView } from "../../components/ui/AppSymbol";
import * as Dialog from "../../components/ui/Dialog";
import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";
import { projectEnvironment } from "../../state/projects";
import { threadEnvironment } from "../../state/threads";
import { useProjects, useServerConfigs } from "../../state/entities";
import { useAtomCommand } from "../../state/use-atom-command";
import { readEnvironmentScope } from "../../state/session";
import { createNewTaskDraft } from "../../state/use-composer-drafts";
import { useSelectWorkspaceDetail } from "../workspace/useSelectWorkspaceDetail";
import { uuidv4 } from "../../lib/uuid";
import { useActiveNewTask } from "../../state/active-new-task";
import type { ThreadListV2ListItem } from "./threadListV2";

const EMPTY_EXPANSION: Readonly<Record<string, boolean>> = {};

export function useTaskFolderActions() {
  const configs = useServerConfigs();
  const updateProject = useAtomCommand(projectEnvironment.update);
  const updateThread = useAtomCommand(threadEnvironment.updateMetadata);
  const selectDetail = useSelectWorkspaceDetail();
  const savePreferences = useAtomSet(updateMobilePreferencesAtom);
  const canEdit = (project: EnvironmentProject) =>
    configs.get(project.environmentId)?.environment.capabilities.taskFolders === true &&
    readEnvironmentScope(project.environmentId, AuthOrchestrationOperateScope);
  const mutate = (project: EnvironmentProject, taskFolderOperation: ProjectTaskFolderOperation) =>
    updateProject({
      environmentId: project.environmentId,
      input: { projectId: project.id, taskFolderOperation },
    });
  const name = (project: EnvironmentProject, folder?: ProjectTaskFolder) => {
    if (!canEdit(project)) return;
    Dialog.prompt({
      title: folder ? "Rename folder" : "New task folder",
      initialValue: folder?.name ?? "",
      confirmText: "Save",
      onConfirm: (value) => {
        const name = value.trim();
        if (
          !name ||
          name.length > 128 ||
          project.taskFolders?.some(
            (other) => other.id !== folder?.id && other.name.toLowerCase() === name.toLowerCase(),
          )
        ) {
          Dialog.alert("Invalid folder name", "Use a unique name between 1 and 128 characters.");
          return;
        }
        void mutate(project, {
          action: folder ? "rename" : "create",
          id: folder?.id ?? uuidv4(),
          name,
        });
      },
    });
  };
  return {
    canEdit,
    name,
    remove: (project: EnvironmentProject, folder: ProjectTaskFolder) => {
      if (canEdit(project)) void mutate(project, { action: "delete", id: folder.id });
    },
    newTask: (project: EnvironmentProject, taskFolderId: string) => {
      savePreferences({
        transform: (current) => ({
          taskFoldersExpandedByKey: {
            ...current.taskFoldersExpandedByKey,
            [taskFolderKey(project, taskFolderId)]: true,
          },
        }),
      });
      const draftId = createNewTaskDraft({
        environmentId: project.environmentId,
        projectId: project.id,
        taskFolderId,
      });
      selectDetail({
        name: "Thread",
        params: { draft: { environmentId: project.environmentId, projectId: project.id, draftId } },
      });
    },
    move: (thread: EnvironmentThreadShell, taskFolderId: string | null) =>
      updateThread({
        environmentId: thread.environmentId,
        input: { threadId: thread.id, taskFolderId },
      }),
    moveMenu: (project: EnvironmentProject | null): MenuAction[] =>
      !project || !canEdit(project)
        ? []
        : [
            {
              id: "task-folder",
              title: "Move to folder",
              subactions: [
                { id: "task-folder:", title: "Project root" },
                ...[...(project.taskFolders ?? [])]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((folder) => ({ id: `task-folder:${folder.id}`, title: folder.name })),
              ],
            },
          ],
  };
}

export function TaskFolderRow({
  item,
}: {
  item: Extract<ThreadListV2ListItem, { type: "v2-folder" }>;
}) {
  const actions = useTaskFolderActions();
  const save = useAtomSet(updateMobilePreferencesAtom);
  const folder = item.folder;
  const toggle = () =>
    save({
      transform: (current) => ({
        taskFoldersExpandedByKey: {
          ...current.taskFoldersExpandedByKey,
          [item.key]: !item.expanded,
        },
      }),
    });
  if (!folder)
    return actions.canEdit(item.project) ? (
      <Pressable
        accessibilityRole="button"
        onPress={() => actions.name(item.project)}
        className="min-h-11 justify-center px-3"
      >
        <Text className="text-xs text-muted-foreground">New folder</Text>
      </Pressable>
    ) : null;
  return (
    <Menu
      actions={
        actions.canEdit(item.project)
          ? [
              { id: "new-task", title: "New task" },
              { id: "rename", title: "Rename folder" },
              { id: "delete", title: "Delete folder", attributes: { destructive: true } },
            ]
          : []
      }
      shouldOpenOnLongPress
      onPressAction={({ nativeEvent }) => {
        if (nativeEvent.event === "new-task") actions.newTask(item.project, folder.id);
        if (nativeEvent.event === "rename") actions.name(item.project, folder);
        if (nativeEvent.event === "delete") actions.remove(item.project, folder);
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={folder.name}
        accessibilityState={{ expanded: item.expanded }}
        onPress={toggle}
        className="min-h-11 flex-row items-center gap-1 px-3"
      >
        <SymbolView
          name={item.expanded ? "chevron.down" : "chevron.right"}
          size={11}
          tintColorClassName="accent-muted-foreground"
        />
        <Text className="text-xs text-muted-foreground">{folder.name}</Text>
      </Pressable>
    </Menu>
  );
}

export function useTaskFolderItems(input: {
  items: readonly ThreadListV2ListItem[];
  threads: readonly EnvironmentThreadShell[];
  projectRefs: readonly { environmentId: string; projectId: string }[] | null | undefined;
  selectedKey: string | null;
}) {
  const projects = useProjects();
  const activeNewTask = useActiveNewTask();
  const preferences = useAtomValue(mobilePreferencesAtom);
  const save = useAtomSet(updateMobilePreferencesAtom);
  const loaded = AsyncResult.isSuccess(preferences);
  const expanded = AsyncResult.isSuccess(preferences)
    ? (preferences.value.taskFoldersExpandedByKey ?? EMPTY_EXPANSION)
    : EMPTY_EXPANSION;
  const scoped =
    input.projectRefs == null
      ? []
      : projects.filter((project) =>
          input.projectRefs!.some(
            (ref) => ref.projectId === project.id && ref.environmentId === project.environmentId,
          ),
        );
  const ownerKey = threadHierarchyOwnerKey(input.threads, input.selectedKey);
  const threadOwner = input.threads.find(
    (thread) => `${thread.environmentId}:${thread.id}` === ownerKey,
  );
  const pending = input.items.find(
    (item) => item.type === "v2-pending" && item.pendingTask.key === activeNewTask?.pendingKey,
  );
  const pendingTask = pending?.type === "v2-pending" ? pending.pendingTask : null;
  const owner = pendingTask
    ? {
        ...pendingTask,
        taskFolderId:
          pendingTask.kind === "draft"
            ? pendingTask.draft.project?.taskFolderId
            : pendingTask.creation.taskFolderId,
      }
    : threadOwner;
  const selectedKey = input.selectedKey ?? activeNewTask?.pendingKey ?? null;
  const selectedFolder =
    owner?.taskFolderId &&
    scoped.find(
      (project) =>
        project.id === owner.projectId &&
        project.environmentId === owner.environmentId &&
        project.taskFolders?.some((folder) => folder.id === owner.taskFolderId),
    );
  const revealKey =
    selectedFolder && owner?.taskFolderId
      ? taskFolderKey(selectedFolder, owner.taskFolderId)
      : null;
  const reveal = useEffectEvent((key: string) => {
    if (expanded[key] === false)
      save({
        transform: (current) => ({
          taskFoldersExpandedByKey: { ...current.taskFoldersExpandedByKey, [key]: true },
        }),
      });
  });
  // oxlint-disable-next-line t3code/react-effect-budget -- Navigation reveals the selected task's folder once without overriding later manual folds.
  useEffect(() => {
    if (loaded && selectedKey !== null && revealKey) reveal(revealKey);
  }, [revealKey, selectedKey, loaded]);
  if (input.projectRefs == null) return input.items;
  const family: { current: EnvironmentThreadShell | null } = { current: null };
  const groups = groupTaskFolderRoots(
    input.items.flatMap<{
      projectId: string;
      environmentId: string;
      taskFolderId: string | null;
      row: ThreadListV2ListItem;
    }>((item) => {
      if (item.type === "v2-thread") {
        const thread = item.item.thread;
        if ((item.item.depth ?? 0) === 0) family.current = thread;
        const root = family.current ?? thread;
        return [
          {
            projectId: root.projectId,
            environmentId: root.environmentId,
            taskFolderId: root.taskFolderId ?? null,
            row: item,
          },
        ];
      }
      if (item.type === "v2-pending") {
        const pending = item.pendingTask;
        return [
          {
            projectId: pending.projectId,
            environmentId: pending.environmentId,
            taskFolderId:
              pending.kind === "draft"
                ? (pending.draft.project?.taskFolderId ?? null)
                : (pending.creation.taskFolderId ?? null),
            row: item,
          },
        ];
      }
      return [];
    }),
    scoped,
  );
  const rows: ThreadListV2ListItem[] = groups.unfiled.map((thread) => thread.row);
  for (const group of groups.folders) {
    const project = scoped.find(
      (project) =>
        project.id === group.project.id && project.environmentId === group.project.environmentId,
    )!;
    rows.push({
      type: "v2-folder",
      key: group.key,
      project,
      folder: group.folder,
      expanded: expanded[group.key] !== false,
    });
    if (expanded[group.key] !== false)
      rows.push(
        ...group.threads.map(({ row }) =>
          row.type === "v2-thread"
            ? { ...row, item: { ...row.item, depth: (row.item.depth ?? 0) + 1 } }
            : row,
        ),
      );
  }
  for (const project of scoped)
    rows.push({
      type: "v2-folder",
      key: `new-folder:${project.environmentId}:${project.id}`,
      project,
      folder: null,
      expanded: true,
    });
  rows.push(
    ...input.items.filter(
      (item) => item.type === "v2-settled-shelf" || item.type === "v2-snoozed-shelf",
    ),
  );
  return rows;
}
