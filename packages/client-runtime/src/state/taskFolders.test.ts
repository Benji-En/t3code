import { describe, expect, it } from "vite-plus/test";
import { groupTaskFolderRoots } from "./taskFolders.ts";

describe("project task folders", () => {
  const projects = [
    {
      environmentId: "local",
      id: "a",
      taskFolders: [
        { id: "z", name: "Research" },
        { id: "b", name: "Build" },
      ],
    },
    { environmentId: "remote", id: "a", taskFolders: [{ id: "z", name: "Research" }] },
  ];
  it("keeps empty folders, sorts names, and preserves the supplied task order", () => {
    const roots = ["second", "first"].map((id) => ({
      id,
      environmentId: "local",
      projectId: "a",
      taskFolderId: "z",
    }));
    const grouped = groupTaskFolderRoots(roots, projects);
    expect(grouped.folders.map((group) => group.folder.name)).toEqual([
      "Build",
      "Research",
      "Research",
    ]);
    expect(grouped.folders[1]?.threads).toEqual(roots);
    expect(grouped.folders[0]?.threads).toEqual([]);
  });
  it("isolates projects and environments and returns deleted-folder tasks to the root", () => {
    const roots = [
      { id: "remote-task", environmentId: "remote", projectId: "a", taskFolderId: "z" },
      { id: "other-project", environmentId: "local", projectId: "b", taskFolderId: "z" },
      { id: "deleted", environmentId: "local", projectId: "a", taskFolderId: "gone" },
      { id: "unfiled", environmentId: "local", projectId: "a" },
    ];
    const grouped = groupTaskFolderRoots(roots, projects);
    expect(grouped.folders[2]?.threads).toEqual([roots[0]]);
    expect(grouped.unfiled).toEqual(roots.slice(1));
  });
});
