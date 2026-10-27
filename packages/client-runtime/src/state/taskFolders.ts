import type { ProjectTaskFolder } from "@t3tools/contracts";

export interface TaskFolderProject {
  readonly id: string;
  readonly environmentId: string;
  readonly taskFolders?: ReadonlyArray<ProjectTaskFolder> | undefined;
}

interface FolderThread {
  readonly projectId: string;
  readonly environmentId: string;
  readonly taskFolderId?: string | null;
}

export function taskFolderKey(project: TaskFolderProject, folderId: string): string {
  return `${project.environmentId}:${project.id}:${folderId}`;
}

export function groupTaskFolderRoots<T extends FolderThread>(
  roots: ReadonlyArray<T>,
  projects: ReadonlyArray<TaskFolderProject>,
) {
  const folders = projects
    .flatMap((project) =>
      (project.taskFolders ?? []).map((folder) => ({
        project,
        folder,
        key: taskFolderKey(project, folder.id),
        threads: [] as T[],
      })),
    )
    .sort((a, b) => a.folder.name.localeCompare(b.folder.name) || a.key.localeCompare(b.key));
  const byKey = new Map(folders.map((group) => [group.key, group]));
  const unfiled: T[] = [];
  for (const thread of roots) {
    const group =
      thread.taskFolderId == null
        ? undefined
        : byKey.get(`${thread.environmentId}:${thread.projectId}:${thread.taskFolderId}`);
    if (group === undefined) unfiled.push(thread);
    else group.threads.push(thread);
  }
  return { folders, unfiled };
}
