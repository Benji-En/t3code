import { useEffect, useState } from "react";
import { create } from "zustand";
import { FolderPlusIcon } from "lucide-react";
import { randomUUID } from "../../lib/utils";
import type { ThreadActionMenuId } from "../threadActionMenu.logic";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/models";
import type {
  ContextMenuItem,
  ProjectTaskFolder,
  ProjectTaskFolderOperation,
  ScopedThreadRef,
} from "@t3tools/contracts";
import { AuthOrchestrationOperateScope } from "@t3tools/contracts";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { projectEnvironment } from "../../state/projects";
import { threadEnvironment } from "../../state/threads";
import { readEnvironmentScope } from "../../state/session";
import { useServerConfigs, readProject } from "../../state/entities";
import { useNewThreadHandler } from "../../hooks/useHandleNewThread";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { readLocalApi } from "../../localApi";
import { SidebarHeaderIconButton } from "./SidebarThreadHeader";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogPanel,
  DialogFooter,
} from "../ui/dialog";

type NameRequest = {
  readonly title: string;
  readonly initialName: string;
  readonly otherNames: readonly string[];
  readonly resolve: (name: string | null) => void;
};
const useNameRequest = create<{ request: NameRequest | null }>(() => ({ request: null }));
function finishName(name: string | null) {
  const request = useNameRequest.getState().request;
  useNameRequest.setState({ request: null });
  request?.resolve(name);
}
function requestName(input: Omit<NameRequest, "resolve">): Promise<string | null> {
  finishName(null);
  return new Promise((resolve) => useNameRequest.setState({ request: { ...input, resolve } }));
}

export function TaskFolderDialogHost() {
  const request = useNameRequest((state) => state.request);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Release pending dialog requests when the application unmounts.
  useEffect(() => () => finishName(null), []);
  return request ? <TaskFolderNameDialog request={request} /> : null;
}

function TaskFolderNameDialog({ request }: { request: NameRequest }) {
  const [name, setName] = useState(request.initialName);
  const normalized = name.trim();
  const duplicate = request.otherNames.some(
    (other) => other.toLowerCase() === normalized.toLowerCase(),
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) finishName(null);
      }}
    >
      <DialogPopup>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (normalized && !duplicate) finishName(normalized);
          }}
        >
          <DialogHeader>
            <DialogTitle>{request.title}</DialogTitle>
          </DialogHeader>
          <DialogPanel>
            <label htmlFor="task-folder-name">Folder name</label>
            <Input
              id="task-folder-name"
              autoFocus
              required
              maxLength={128}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            {duplicate && <p role="alert">A folder with this name already exists.</p>}
          </DialogPanel>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => finishName(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!normalized || duplicate}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}

export function useTaskFolderActions() {
  const configs = useServerConfigs();
  const updateProject = useOrchestrationCommand(projectEnvironment.update);
  const updateThread = useOrchestrationCommand(threadEnvironment.updateMetadata);
  const newThread = useNewThreadHandler();
  const canEdit = (project: EnvironmentProject) =>
    configs.get(project.environmentId)?.environment.capabilities.taskFolders === true &&
    readEnvironmentScope(project.environmentId, AuthOrchestrationOperateScope);
  const mutate = (project: EnvironmentProject, taskFolderOperation: ProjectTaskFolderOperation) =>
    updateProject({
      environmentId: project.environmentId,
      input: { projectId: project.id, taskFolderOperation },
    });
  return {
    canEdit,
    moveMenu: (
      project: EnvironmentProject | null,
      isSubtask = false,
    ): ContextMenuItem<ThreadActionMenuId>[] =>
      !project || isSubtask || !canEdit(project)
        ? []
        : [
            {
              id: "move-task-folder",
              label: "Move to folder",
              children: [
                { id: "task-folder:", label: "Project root" },
                ...(project.taskFolders ?? [])
                  .toSorted((a, b) => a.name.localeCompare(b.name))
                  .map((folder) => ({
                    id: `task-folder:${folder.id}` as const,
                    label: folder.name,
                  })),
              ],
            },
          ],
    create: async (project: EnvironmentProject) => {
      if (!canEdit(project)) return;
      const current = readProject(scopeProjectRef(project.environmentId, project.id)) ?? project;
      const name = await requestName({
        title: "New task folder",
        initialName: "",
        otherNames: (current.taskFolders ?? []).map((folder) => folder.name),
      });
      if (name !== null) await mutate(project, { action: "create", id: randomUUID(), name });
    },
    rename: async (project: EnvironmentProject, folder: ProjectTaskFolder) => {
      if (!canEdit(project)) return;
      const name = await requestName({
        title: "Rename task folder",
        initialName: folder.name,
        otherNames: (project.taskFolders ?? [])
          .filter((other) => other.id !== folder.id)
          .map((other) => other.name),
      });
      if (name !== null) await mutate(project, { action: "rename", id: folder.id, name });
    },
    remove: (project: EnvironmentProject, folder: ProjectTaskFolder) =>
      canEdit(project) ? mutate(project, { action: "delete", id: folder.id }) : undefined,
    move: (thread: ScopedThreadRef, taskFolderId: string | null) =>
      updateThread({
        environmentId: thread.environmentId,
        input: { threadId: thread.threadId, taskFolderId },
      }),
    newTask: (project: EnvironmentProject, taskFolderId: string) =>
      newThread(scopeProjectRef(project.environmentId, project.id), { taskFolderId }),
  };
}

export function NewTaskFolderButton(props: {
  projects: readonly (EnvironmentProject & { environmentLabel?: string | null })[];
  className?: string;
  onCreate?: () => void;
}) {
  const actions = useTaskFolderActions();
  const projects = props.projects.filter(actions.canEdit);
  if (projects.length === 0) return null;
  const createFolder = (project: EnvironmentProject) => {
    props.onCreate?.();
    void actions.create(project);
  };
  return (
    <SidebarHeaderIconButton
      label="New folder"
      data-testid="new-folder-button"
      className={props.className}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (projects.length === 1) {
          createFolder(projects[0]!);
          return;
        }
        const api = readLocalApi();
        if (!api) return;
        void api.contextMenu
          .show(
            projects.map((project) => ({
              id: `${project.environmentId}:${project.id}`,
              label: `${project.title} · ${project.environmentLabel ?? project.workspaceRoot}`,
            })),
            { x: event.clientX, y: event.clientY },
          )
          .then((selected) => {
            const project = projects.find(
              (candidate) => `${candidate.environmentId}:${candidate.id}` === selected,
            );
            if (project) createFolder(project);
          });
      }}
    >
      <FolderPlusIcon />
    </SidebarHeaderIconButton>
  );
}
